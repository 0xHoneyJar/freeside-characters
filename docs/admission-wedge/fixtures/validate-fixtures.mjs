#!/usr/bin/env node
// Phase 43C Admission Wedge fixture/operator-contract validator.
// Deterministic, dependency-free, Node-built-ins only.
//
// Companion to docs/ADMISSION-WEDGE-MVP-DESIGN.md (Phase 43B design) and
// the accepted Recall Wedge fixture validator
// (docs/recall-wedge/fixtures/validate-fixtures.mjs).
//
// Scope: this is fixture / operator-contract validation ONLY. It proves
// the Admission Wedge core invariant against a small deterministic
// fixture graph (candidate -> transition -> admitted -> recall-proof).
// It is NOT a live admission route, NOT production admission, NOT
// production storage, NOT a Discord command, NOT a renderer, NOT a live
// Dixie/Straylight client. It admits nothing and stores nothing; it
// reads JSON fixtures and asserts the invariant holds.
//
// The invariant proved (docs/ADMISSION-WEDGE-MVP-DESIGN.md §D):
//   1. candidate memory is not admitted memory;
//   2. candidate memory is not recallable before admission;
//   3. a candidate becomes recall-eligible only after an explicit
//      admission transition accepts it;
//   4. a rejected candidate never becomes recallable;
//   5. a superseded/corrected candidate does not leak the wrong prior
//      state into ordinary recall;
//   6. the proof is deterministic, local, and operator/fixture-only.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;

const CANDIDATES_DIR = join(FIXTURES_DIR, "candidates");
const TRANSITIONS_DIR = join(FIXTURES_DIR, "transitions");
const ADMITTED_DIR = join(FIXTURES_DIR, "admitted");
const RECALL_PROOFS_DIR = join(FIXTURES_DIR, "recall-proofs");

// --- required fixture files (by directory) ---------------------------------

const REQUIRED = {
  candidates: [
    "cand-001-accepted-pending.json",
    "cand-002-rejected-pending.json",
    "cand-010-original-pending.json",
    "cand-011-correction-pending.json",
  ],
  transitions: [
    "trans-001-accept.json",
    "trans-002-reject.json",
    "trans-010-accept-original.json",
    "trans-011-supersede.json",
  ],
  admitted: [
    "assn-001-active.json",
    "assn-010-superseded.json",
    "assn-011-active-correction.json",
  ],
  "recall-proofs": [
    "proof-001-before-admission-excluded.json",
    "proof-002-after-admission-included.json",
    "proof-003-rejected-excluded.json",
    "proof-004-supersession-corrected.json",
  ],
};

const DIR_BY_KEY = {
  candidates: CANDIDATES_DIR,
  transitions: TRANSITIONS_DIR,
  admitted: ADMITTED_DIR,
  "recall-proofs": RECALL_PROOFS_DIR,
};

// --- banned raw material (check 11) ----------------------------------------
//
// No fixture may contain real secrets / raw long IDs / live URLs /
// binary-evidence references. Each entry is [label, regexp].
const BANNED_MATERIAL = [
  ["discord snowflake / raw long id (17+ digit run)", /\d{17,}/],
  ["jwt", /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/],
  ["openai-style secret token", /\bsk-[A-Za-z0-9]{12,}/],
  ["github token", /\bgh[pousr]_[A-Za-z0-9]{20,}/],
  ["slack token", /\bxox[baprs]-[A-Za-z0-9-]{8,}/],
  ["bearer token", /\bBearer\s+[A-Za-z0-9._-]{12,}/],
  ["pem private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["hex private key / 0x address (40+ hex)", /0x[a-fA-F0-9]{40,}/],
  ["postgres url", /postgres(?:ql)?:\/\//i],
  ["http(s) url", /https?:\/\//i],
  ["railway url", /railway\.app/i],
  [
    "screenshot / image / binary evidence reference",
    /\.(?:png|jpe?g|gif|webp|bmp|svg|mp4|mov|avi|pdf|zip|bin)\b/i,
  ],
  ["inline image data uri", /data:image\//i],
];

// --- forbidden claims (check 12) -------------------------------------------
//
// No fixture may *claim* production admission, production storage,
// production auth/consent, public remember-this, Discord history
// ingestion, or user chat becoming memory. Some of these phrases legitly
// appear in fixtures ONLY as disclaimers (e.g. "no production storage").
// So each occurrence is allowed only when negated by a nearby negation
// token; an un-negated occurrence is treated as a forbidden claim.
const FORBIDDEN_CLAIM_PHRASES = [
  "production storage",
  "production admission",
  "production auth",
  "production consent",
  "public remember-this",
  "remember-this",
  "discord history",
  "message history",
  "history ingestion",
  "discord chat becomes memory",
  "chat becomes memory",
  "chat becoming memory",
  "user chat",
  "production-wired",
  "production wired",
];

const NEGATION_RE = /\b(?:no|not|never|without|neither|nor|cannot)\b|n['’]t\b/i;

// --- private body sentinels (no-leak gate over recall proofs) --------------
//
// Candidate / admitted / superseded private bodies and source material
// carry these sentinels. Ordinary recall output (the recall-proof
// fixtures) must contain NONE of them: the no-leak boundary holds.
const PRIVATE_BODY_SENTINELS = [
  "CANDIDATE_PRIVATE_SENTINEL",
  "SOURCE_SENTINEL",
  "ADMITTED_PRIVATE_SENTINEL",
  "SUPERSEDED_PRIVATE_SENTINEL",
];

const EXPECTED_ACTOR_ID = "freeside-characters:shared-substrate";

// --- accumulators ----------------------------------------------------------

const failures = [];
const successes = [];
let checksChecked = 0;

function fail(msg) {
  failures.push(msg);
}
function ok(msg) {
  successes.push(msg);
}
function check(cond, okMsg, failMsg) {
  checksChecked += 1;
  if (cond) ok(okMsg);
  else fail(failMsg);
  return cond;
}

function loadJson(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return { raw, parsed: JSON.parse(raw) };
  } catch (err) {
    fail(`could not parse ${rel(path)}: ${err.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(dir, name))
      .filter((p) => statSync(p).isFile());
  } catch {
    return [];
  }
}

function rel(p) {
  return p.replace(FIXTURES_DIR + "/", "");
}

function dirExists(dir) {
  try {
    return statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

function fieldsPresent(obj, fields, label) {
  for (const f of fields) {
    const present = obj != null && Object.prototype.hasOwnProperty.call(obj, f);
    check(
      present,
      `${label}: field "${f}" present`,
      `${label}: required field "${f}" missing`,
    );
  }
}

function hasNegationBefore(haystack, idx, window = 36) {
  const start = Math.max(0, idx - window);
  return NEGATION_RE.test(haystack.slice(start, idx));
}

// === 1. required directories + files exist =================================

for (const [key, dir] of Object.entries(DIR_BY_KEY)) {
  check(
    dirExists(dir),
    `dir: ${key}/ present`,
    `dir: required directory ${key}/ is missing`,
  );
}

for (const [key, files] of Object.entries(REQUIRED)) {
  const dir = DIR_BY_KEY[key];
  for (const fname of files) {
    const path = join(dir, fname);
    let present = false;
    try {
      present = statSync(path).isFile();
    } catch {
      present = false;
    }
    check(
      present,
      `file: ${key}/${fname} present`,
      `file: required fixture ${key}/${fname} is missing`,
    );
  }
}

// === 2. every fixture JSON parses ==========================================

const allJsonFiles = [
  ...listJsonFiles(CANDIDATES_DIR),
  ...listJsonFiles(TRANSITIONS_DIR),
  ...listJsonFiles(ADMITTED_DIR),
  ...listJsonFiles(RECALL_PROOFS_DIR),
];

const rawByPath = new Map();
for (const f of allJsonFiles) {
  const loaded = loadJson(f);
  if (loaded) {
    rawByPath.set(f, loaded.raw);
    ok(`parsed ${rel(f)}`);
  }
  checksChecked += 1;
}

// Load the known fixtures by exact path so relationships can be asserted.
const cand001 = loadJson(join(CANDIDATES_DIR, "cand-001-accepted-pending.json"))?.parsed;
const cand002 = loadJson(join(CANDIDATES_DIR, "cand-002-rejected-pending.json"))?.parsed;
const cand010 = loadJson(join(CANDIDATES_DIR, "cand-010-original-pending.json"))?.parsed;
const cand011 = loadJson(join(CANDIDATES_DIR, "cand-011-correction-pending.json"))?.parsed;

const trans001 = loadJson(join(TRANSITIONS_DIR, "trans-001-accept.json"))?.parsed;
const trans002 = loadJson(join(TRANSITIONS_DIR, "trans-002-reject.json"))?.parsed;
const trans010 = loadJson(join(TRANSITIONS_DIR, "trans-010-accept-original.json"))?.parsed;
const trans011 = loadJson(join(TRANSITIONS_DIR, "trans-011-supersede.json"))?.parsed;

const assn001 = loadJson(join(ADMITTED_DIR, "assn-001-active.json"))?.parsed;
const assn010 = loadJson(join(ADMITTED_DIR, "assn-010-superseded.json"))?.parsed;
const assn011 = loadJson(join(ADMITTED_DIR, "assn-011-active-correction.json"))?.parsed;

const proof001 = loadJson(join(RECALL_PROOFS_DIR, "proof-001-before-admission-excluded.json"))?.parsed;
const proof002 = loadJson(join(RECALL_PROOFS_DIR, "proof-002-after-admission-included.json"))?.parsed;
const proof003 = loadJson(join(RECALL_PROOFS_DIR, "proof-003-rejected-excluded.json"))?.parsed;
const proof004 = loadJson(join(RECALL_PROOFS_DIR, "proof-004-supersession-corrected.json"))?.parsed;

// === 3. required fields per fixture kind ===================================

const CANDIDATE_FIELDS = [
  "fixture_kind",
  "fixture_version",
  "candidate_id",
  "actor_id",
  "estate_id",
  "source_kind",
  "source_ref",
  "proposed_assertion_class",
  "candidate_payload",
  "admission_state",
  "visibility_class",
  "created_at",
  "provenance",
];
const TRANSITION_FIELDS = [
  "transition_kind",
  "transition_version",
  "transition_id",
  "candidate_id",
  "actor_id",
  "estate_id",
  "admission_authority",
  "admission_decision",
  "admitted_assertion_id", // present (may be null on reject)
  "reason_code",
  "decided_at",
];
const ADMITTED_FIELDS = [
  "assertion_id",
  "actor_id",
  "estate_id",
  "assertion_class",
  "assertion_status",
  "admission_state",
  "source_candidate_id",
  "admission_transition_id",
  "recall_eligibility",
  "visibility_class",
  "provenance",
  "created_at",
  "admitted_at",
];
const PROOF_FIELDS = [
  "fixture_kind",
  "proof_id",
  "proof_phase",
  "actor_id",
  "estate_id",
  "recall_route",
  "recall_result",
];

for (const [label, c] of [
  ["cand-001", cand001],
  ["cand-002", cand002],
  ["cand-010", cand010],
  ["cand-011", cand011],
]) {
  if (c) fieldsPresent(c, CANDIDATE_FIELDS, label);
}
for (const [label, t] of [
  ["trans-001", trans001],
  ["trans-002", trans002],
  ["trans-010", trans010],
  ["trans-011", trans011],
]) {
  if (t) {
    fieldsPresent(t, TRANSITION_FIELDS, label);
    // receipt_ref OR audit_ref must be present.
    const hasReceipt =
      Object.prototype.hasOwnProperty.call(t, "receipt_ref") ||
      Object.prototype.hasOwnProperty.call(t, "audit_ref");
    check(
      hasReceipt,
      `${label}: receipt_ref/audit_ref present`,
      `${label}: must carry receipt_ref or audit_ref`,
    );
  }
}
for (const [label, a] of [
  ["assn-001", assn001],
  ["assn-010", assn010],
  ["assn-011", assn011],
]) {
  if (a) fieldsPresent(a, ADMITTED_FIELDS, label);
}
for (const [label, p] of [
  ["proof-001", proof001],
  ["proof-002", proof002],
  ["proof-003", proof003],
  ["proof-004", proof004],
]) {
  if (p) fieldsPresent(p, PROOF_FIELDS, label);
}

// Shared invariants: synthetic === true, consistent actor id.
for (const [label, o] of [
  ["cand-001", cand001],
  ["cand-002", cand002],
  ["cand-010", cand010],
  ["cand-011", cand011],
  ["trans-001", trans001],
  ["trans-002", trans002],
  ["trans-010", trans010],
  ["trans-011", trans011],
  ["assn-001", assn001],
  ["assn-010", assn010],
  ["assn-011", assn011],
  ["proof-001", proof001],
  ["proof-002", proof002],
  ["proof-003", proof003],
  ["proof-004", proof004],
]) {
  if (!o) continue;
  check(
    o.synthetic === true,
    `${label}: synthetic === true`,
    `${label}: synthetic must be true (fixtures are synthetic/operator-only)`,
  );
  check(
    o.actor_id === EXPECTED_ACTOR_ID,
    `${label}: actor_id === ${EXPECTED_ACTOR_ID}`,
    `${label}: actor_id must be ${EXPECTED_ACTOR_ID}, got ${o.actor_id}`,
  );
}

// === 4. candidate-pending fixture is not recallable ========================

if (cand001) {
  check(
    cand001.admission_state === "candidate_pending",
    "candidate cand-001: admission_state === candidate_pending",
    `candidate cand-001: admission_state must be candidate_pending, got ${cand001.admission_state}`,
  );
  check(
    cand001.recall_eligibility === "ineligible",
    "candidate cand-001: recall_eligibility === ineligible (not recallable)",
    `candidate cand-001: recall_eligibility must be ineligible, got ${cand001.recall_eligibility}`,
  );
}
// All candidate fixtures must be pending + ineligible.
for (const [label, c] of [
  ["cand-001", cand001],
  ["cand-002", cand002],
  ["cand-010", cand010],
  ["cand-011", cand011],
]) {
  if (!c) continue;
  check(
    c.admission_state === "candidate_pending",
    `candidate ${label}: admission_state === candidate_pending`,
    `candidate ${label}: admission_state must be candidate_pending, got ${c.admission_state}`,
  );
  check(
    c.recall_eligibility === "ineligible",
    `candidate ${label}: recall_eligibility === ineligible`,
    `candidate ${label}: recall_eligibility must be ineligible, got ${c.recall_eligibility}`,
  );
}

// === 5. accepted transition references the candidate =======================

if (trans001) {
  check(
    trans001.admission_decision === "accepted",
    "transition trans-001: admission_decision === accepted",
    `transition trans-001: admission_decision must be accepted, got ${trans001.admission_decision}`,
  );
  check(
    trans001.candidate_id === "cand-001",
    "transition trans-001: candidate_id references cand-001",
    `transition trans-001: candidate_id must be cand-001, got ${trans001.candidate_id}`,
  );
  check(
    typeof trans001.admitted_assertion_id === "string" &&
      trans001.admitted_assertion_id === "assn-001",
    "transition trans-001: mints admitted_assertion_id assn-001",
    `transition trans-001: admitted_assertion_id must be assn-001, got ${trans001.admitted_assertion_id}`,
  );
}

// === 6. admitted packet references the accepted transition and candidate ===

if (assn001) {
  check(
    assn001.assertion_id === "assn-001",
    "admitted assn-001: assertion_id === assn-001",
    `admitted assn-001: assertion_id must be assn-001, got ${assn001.assertion_id}`,
  );
  check(
    assn001.admission_transition_id === "trans-001",
    "admitted assn-001: admission_transition_id references trans-001",
    `admitted assn-001: admission_transition_id must be trans-001, got ${assn001.admission_transition_id}`,
  );
  check(
    assn001.source_candidate_id === "cand-001",
    "admitted assn-001: source_candidate_id references cand-001",
    `admitted assn-001: source_candidate_id must be cand-001, got ${assn001.source_candidate_id}`,
  );
  check(
    assn001.admission_state === "admitted" &&
      assn001.assertion_status === "active" &&
      assn001.recall_eligibility === "eligible",
    "admitted assn-001: admitted + active + recall-eligible",
    `admitted assn-001: must be admitted/active/eligible, got state=${assn001.admission_state} status=${assn001.assertion_status} elig=${assn001.recall_eligibility}`,
  );
}

// === 7. before-admission recall proof excludes the candidate ===============

if (proof001) {
  check(
    proof001.recall_result === "excluded",
    "proof-001 (before admission): recall_result === excluded",
    `proof-001: recall_result must be excluded, got ${proof001.recall_result}`,
  );
  check(
    proof001.exclusion_reason === "candidate_not_admitted",
    "proof-001: exclusion_reason === candidate_not_admitted",
    `proof-001: exclusion_reason must be candidate_not_admitted, got ${proof001.exclusion_reason}`,
  );
  check(
    proof001.considered_admission_state === "candidate_pending",
    "proof-001: considered_admission_state === candidate_pending",
    `proof-001: considered_admission_state must be candidate_pending, got ${proof001.considered_admission_state}`,
  );
  const included = Array.isArray(proof001.included_assertion_ids)
    ? proof001.included_assertion_ids
    : null;
  check(
    included !== null && included.length === 0,
    "proof-001: included_assertion_ids is empty",
    `proof-001: included_assertion_ids must be empty, got ${JSON.stringify(proof001.included_assertion_ids)}`,
  );
  check(
    included !== null && !included.includes(cand001?.candidate_id ?? "cand-001"),
    "proof-001: candidate not present in included_assertion_ids",
    "proof-001: candidate must not appear in included_assertion_ids",
  );
  check(
    proof001.recall_classification !== "served",
    "proof-001: classification is not 'served' (safe not-found family)",
    "proof-001: classification must not be 'served' before admission",
  );
  check(
    proof001.public_recall_output?.rendered_candidate_payload === false,
    "proof-001: no candidate payload rendered in recall output",
    "proof-001: public_recall_output.rendered_candidate_payload must be false",
  );
}

// === 8. after-admission recall proof includes ONLY the admitted assertion ==

if (proof002) {
  check(
    proof002.recall_result === "included",
    "proof-002 (after admission): recall_result === included",
    `proof-002: recall_result must be included, got ${proof002.recall_result}`,
  );
  check(
    proof002.inclusion_reason === "admitted_active_assertion",
    "proof-002: inclusion_reason === admitted_active_assertion",
    `proof-002: inclusion_reason must be admitted_active_assertion, got ${proof002.inclusion_reason}`,
  );
  check(
    proof002.recall_classification === "served",
    "proof-002: classification === served (reuses accepted recall path)",
    `proof-002: classification must be served, got ${proof002.recall_classification}`,
  );
  const included = Array.isArray(proof002.included_assertion_ids)
    ? proof002.included_assertion_ids
    : [];
  check(
    included.length === 1 && included[0] === "assn-001",
    "proof-002: included_assertion_ids === [assn-001] (only the admitted assertion)",
    `proof-002: included_assertion_ids must be exactly [assn-001], got ${JSON.stringify(proof002.included_assertion_ids)}`,
  );
  check(
    !included.includes("cand-001"),
    "proof-002: raw candidate NOT in included_assertion_ids",
    "proof-002: raw candidate must not be treated as ordinary recall material",
  );
  check(
    proof002.audit_links?.source_candidate_id === "cand-001",
    "proof-002: source candidate linked under audit_links only",
    "proof-002: audit_links.source_candidate_id must reference cand-001",
  );
  check(
    proof002.audit_links?.admission_transition_id === "trans-001" &&
      proof002.audit_links?.admission_receipt_ref === "rcpt-001",
    "proof-002: admission transition + receipt reference preserved",
    "proof-002: audit_links must preserve admission_transition_id trans-001 and admission_receipt_ref rcpt-001",
  );
  check(
    proof002.public_recall_output?.rendered_candidate_payload === false,
    "proof-002: no candidate payload rendered in recall output",
    "proof-002: public_recall_output.rendered_candidate_payload must be false",
  );
}

// === 9. rejected candidate: no admitted assertion, excluded from recall ====

if (trans002) {
  check(
    trans002.admission_decision === "rejected",
    "transition trans-002: admission_decision === rejected",
    `transition trans-002: admission_decision must be rejected, got ${trans002.admission_decision}`,
  );
  check(
    trans002.candidate_id === "cand-002",
    "transition trans-002: candidate_id references cand-002",
    `transition trans-002: candidate_id must be cand-002, got ${trans002.candidate_id}`,
  );
  check(
    trans002.admitted_assertion_id === null,
    "transition trans-002: no admitted_assertion_id minted (null)",
    `transition trans-002: admitted_assertion_id must be null on reject, got ${JSON.stringify(trans002.admitted_assertion_id)}`,
  );
}
if (proof003) {
  check(
    proof003.recall_result === "excluded",
    "proof-003 (rejected): recall_result === excluded",
    `proof-003: recall_result must be excluded, got ${proof003.recall_result}`,
  );
  check(
    proof003.exclusion_reason === "candidate_rejected",
    "proof-003: exclusion_reason === candidate_rejected",
    `proof-003: exclusion_reason must be candidate_rejected, got ${proof003.exclusion_reason}`,
  );
  check(
    proof003.admitted_assertion_id === null,
    "proof-003: no admitted_assertion_id (null)",
    `proof-003: admitted_assertion_id must be null, got ${JSON.stringify(proof003.admitted_assertion_id)}`,
  );
  const included = Array.isArray(proof003.included_assertion_ids)
    ? proof003.included_assertion_ids
    : [];
  check(
    included.length === 0,
    "proof-003: included_assertion_ids is empty",
    `proof-003: included_assertion_ids must be empty, got ${JSON.stringify(proof003.included_assertion_ids)}`,
  );
  check(
    proof003.recall_classification !== "served",
    "proof-003: classification is not 'served' (rejection is terminal)",
    "proof-003: rejected candidate must never classify as served",
  );
  // No admitted assertion fixture may ever cite cand-002 as its source.
  const rejectedAdmitted = [assn001, assn010, assn011].some(
    (a) => a && a.source_candidate_id === "cand-002",
  );
  check(
    !rejectedAdmitted,
    "proof-003: no admitted packet derives from rejected cand-002",
    "proof-003: a rejected candidate must not back any admitted assertion",
  );
}

// === 10. supersession: corrected active included, wrong prior excluded =====

if (trans011) {
  check(
    trans011.admission_decision === "accepted" &&
      trans011.supersedes_assertion_id === "assn-010",
    "transition trans-011: accepted supersede of assn-010",
    `transition trans-011: must be accepted with supersedes_assertion_id assn-010, got decision=${trans011.admission_decision} supersedes=${trans011.supersedes_assertion_id}`,
  );
}
if (assn010) {
  check(
    assn010.admission_state === "superseded" &&
      assn010.assertion_status === "superseded",
    "admitted assn-010: marked superseded",
    `admitted assn-010: must be superseded, got state=${assn010.admission_state} status=${assn010.assertion_status}`,
  );
  check(
    assn010.recall_eligibility === "ineligible",
    "admitted assn-010: recall_eligibility === ineligible (wrong prior state)",
    `admitted assn-010: superseded record must be recall-ineligible, got ${assn010.recall_eligibility}`,
  );
  check(
    assn010.superseded_by_assertion_id === "assn-011",
    "admitted assn-010: superseded_by references assn-011 (audit link preserved)",
    `admitted assn-010: superseded_by_assertion_id must be assn-011, got ${assn010.superseded_by_assertion_id}`,
  );
}
if (assn011) {
  check(
    assn011.admission_state === "admitted" &&
      assn011.assertion_status === "active" &&
      assn011.recall_eligibility === "eligible",
    "admitted assn-011: corrected state is admitted/active/eligible",
    `admitted assn-011: corrected state must be admitted/active/eligible, got state=${assn011.admission_state} status=${assn011.assertion_status} elig=${assn011.recall_eligibility}`,
  );
  check(
    assn011.supersedes_assertion_id === "assn-010",
    "admitted assn-011: supersedes assn-010 (audit link preserved)",
    `admitted assn-011: supersedes_assertion_id must be assn-010, got ${assn011.supersedes_assertion_id}`,
  );
}
if (proof004) {
  const included = Array.isArray(proof004.included_assertion_ids)
    ? proof004.included_assertion_ids
    : [];
  const excluded = Array.isArray(proof004.excluded_assertion_ids)
    ? proof004.excluded_assertion_ids
    : [];
  check(
    included.length === 1 && included[0] === "assn-011",
    "proof-004 (supersession): includes only corrected active assn-011",
    `proof-004: included_assertion_ids must be exactly [assn-011], got ${JSON.stringify(proof004.included_assertion_ids)}`,
  );
  check(
    !included.includes("assn-010"),
    "proof-004: wrong prior state assn-010 NOT included",
    "proof-004: superseded assn-010 must not appear in ordinary recall",
  );
  check(
    excluded.includes("assn-010"),
    "proof-004: superseded assn-010 explicitly excluded",
    "proof-004: excluded_assertion_ids must contain superseded assn-010",
  );
  check(
    proof004.recall_classification === "served" &&
      proof004.inclusion_reason === "admitted_active_assertion",
    "proof-004: corrected state served as admitted active assertion",
    `proof-004: must be served/admitted_active_assertion, got classification=${proof004.recall_classification} reason=${proof004.inclusion_reason}`,
  );
  check(
    proof004.audit_links?.supersedes_assertion_id === "assn-010",
    "proof-004: supersedes link preserved for audit reconstruction",
    "proof-004: audit_links.supersedes_assertion_id must be assn-010",
  );
  check(
    proof004.public_recall_output?.rendered_prior_state === false,
    "proof-004: wrong prior state NOT rendered in recall output",
    "proof-004: public_recall_output.rendered_prior_state must be false",
  );
}

// === 11. no banned raw material in any fixture =============================

for (const [path, raw] of rawByPath) {
  for (const [label, re] of BANNED_MATERIAL) {
    checksChecked += 1;
    if (re.test(raw)) {
      fail(`banned material: ${rel(path)} matches ${label}`);
    }
  }
  ok(`${rel(path)}: no banned raw material`);
}

// === 12. no forbidden production / ingestion / remember-this claims ========

for (const [path, raw] of rawByPath) {
  const hay = raw.toLowerCase();
  let clean = true;
  for (const phrase of FORBIDDEN_CLAIM_PHRASES) {
    let from = 0;
    while (true) {
      const idx = hay.indexOf(phrase, from);
      if (idx === -1) break;
      checksChecked += 1;
      if (!hasNegationBefore(hay, idx)) {
        fail(
          `forbidden claim: ${rel(path)} asserts "${phrase}" without a negation (only negated disclaimers are allowed)`,
        );
        clean = false;
      }
      from = idx + phrase.length;
    }
  }
  if (clean) ok(`${rel(path)}: no forbidden production/ingestion claims`);
}

// === no-leak gate: recall proofs never carry private bodies ================

for (const f of listJsonFiles(RECALL_PROOFS_DIR)) {
  const raw = rawByPath.get(f);
  if (raw == null) continue;
  for (const sentinel of PRIVATE_BODY_SENTINELS) {
    checksChecked += 1;
    if (raw.includes(sentinel)) {
      fail(
        `no-leak: recall proof ${rel(f)} leaks private body sentinel "${sentinel}"`,
      );
    }
  }
  ok(`${rel(f)}: no private body sentinels (ordinary recall is no-leak)`);
}

// === report ================================================================

const fixtureLines = allJsonFiles
  .map((f) => `  ${rel(f)}`)
  .sort();

console.log("admission-wedge phase 43c fixture/operator-contract validator");
console.log("-------------------------------------------------------------");
console.log("fixtures checked:");
for (const line of fixtureLines) console.log(line);
console.log("");
console.log(`assertions evaluated: ${checksChecked}`);
console.log(`checks passed: ${successes.length}`);
console.log(`checks failed: ${failures.length}`);

if (failures.length > 0) {
  console.log("");
  console.log("failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

console.log("");
console.log(
  "ok — admission wedge invariant holds: candidate is not admitted memory, " +
    "is not recallable before admission, becomes recallable only after an " +
    "explicit accept, rejected never recalls, and supersession does not leak " +
    "the wrong prior state into ordinary recall. fixture/operator-only.",
);
process.exit(0);
