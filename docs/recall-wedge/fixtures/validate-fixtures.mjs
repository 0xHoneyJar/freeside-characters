#!/usr/bin/env node
// Phase 33B no-leak fixture validator for the Recall Wedge memory MVP.
// Phase 35D extends this validator to also check recorded Dixie-safe
// recall envelope fixtures under `dixie-envelope/`.
// Deterministic, dependency-free, Node-compatible.
//
// Scope: parses the seed memory packet, the projected DTO fixtures, and
// the recorded Dixie envelope fixtures; verifies same continuity actor
// across frames; grep-enforces that public-safe DTOs carry no private
// sentinel strings or banned fields; verifies recorded Dixie envelopes
// declare a known envelope_version (or, for the unknown-version fixture,
// remain syntactically valid but unsupported). This is fixture
// validation only — not the renderer (33C), not the cross-interface
// demo (33D), and not the adapter (35D adapter unit tests cover
// adapter behavior).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = __dirname;
const SEED_DIR = join(FIXTURES_DIR, "seed-memory");
const PROJECTED_DIR = join(FIXTURES_DIR, "projected-dto");
const DIXIE_ENVELOPE_DIR = join(FIXTURES_DIR, "dixie-envelope");

const SEED_FILE = "shared-substrate-demo.memory.json";
const OPERATOR_PRIVATE_FILE = "operator-private-view.dto.json";
const PUBLIC_DISCORD_FILE = "public-discord-view.dto.json";
const REFERRAL_FILE = "character-boundary-referral.dto.json";

const PUBLIC_SAFE_DTOS = [PUBLIC_DISCORD_FILE, REFERRAL_FILE];

const DIXIE_PUBLIC_ENVELOPE_FILE =
  "recorded-public-discord-recall-envelope.v0.json";
const DIXIE_REFERRAL_ENVELOPE_FILE =
  "recorded-referral-recall-envelope.v0.json";
const DIXIE_UNKNOWN_VERSION_ENVELOPE_FILE =
  "recorded-unknown-version-envelope.json";

const SUPPORTED_DIXIE_ENVELOPE_VERSIONS = [
  "recall_wedge.dixie_envelope.v0",
];

const BANNED_PUBLIC_SUBSTRINGS = [
  "PRIVATE_SENTINEL",
  "raw_reasons",
  "debug",
  "private_assertion_id",
  "private assertion",
  "source_material",
  "hidden estate",
  "assertion_id",
  "full assertion bodies",
  "private identifiers",
];

const failures = [];
const successes = [];

function fail(msg) {
  failures.push(msg);
}
function ok(msg) {
  successes.push(msg);
}

function loadJson(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return { raw, parsed: JSON.parse(raw) };
  } catch (err) {
    fail(`could not parse ${path}: ${err.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(dir, name))
      .filter((p) => statSync(p).isFile());
  } catch (err) {
    fail(`could not list ${dir}: ${err.message}`);
    return [];
  }
}

// --- 1. parse all fixture JSON files ---------------------------------------

const seedFiles = listJsonFiles(SEED_DIR);
const projectedFiles = listJsonFiles(PROJECTED_DIR);

if (seedFiles.length === 0) fail("no seed-memory fixtures found");
if (projectedFiles.length < 3)
  fail(`expected at least 3 projected DTO fixtures, found ${projectedFiles.length}`);

for (const f of [...seedFiles, ...projectedFiles]) {
  const loaded = loadJson(f);
  if (loaded) ok(`parsed ${f}`);
}

const seed = loadJson(join(SEED_DIR, SEED_FILE));
const opPriv = loadJson(join(PROJECTED_DIR, OPERATOR_PRIVATE_FILE));
const pubDisc = loadJson(join(PROJECTED_DIR, PUBLIC_DISCORD_FILE));
const referral = loadJson(join(PROJECTED_DIR, REFERRAL_FILE));

// --- 2. seed memory invariants ---------------------------------------------

if (seed?.parsed) {
  const s = seed.parsed;
  if (s.synthetic !== true) fail("seed: synthetic must be true");
  else ok("seed: synthetic === true");

  if (s.fixture_kind !== "reviewed_seed_memory_packet")
    fail(`seed: fixture_kind must be reviewed_seed_memory_packet, got ${s.fixture_kind}`);
  else ok("seed: fixture_kind === reviewed_seed_memory_packet");

  if (s.admission_state !== "already_admitted")
    fail(`seed: admission_state must be already_admitted, got ${s.admission_state}`);
  else ok("seed: admission_state === already_admitted");

  if (!s.continuity_actor_id) fail("seed: continuity_actor_id missing");
  else ok(`seed: continuity_actor_id === ${s.continuity_actor_id}`);

  if (!s.fixture_id) fail("seed: fixture_id missing");
  else ok(`seed: fixture_id === ${s.fixture_id}`);

  if (!s.source_authority_note || !/Straylight/i.test(s.source_authority_note))
    fail("seed: source_authority_note missing or does not name Straylight");
  else ok("seed: source_authority_note names Straylight");

  if (!s.non_production_authorization_note)
    fail("seed: non_production_authorization_note missing");
  else ok("seed: non_production_authorization_note present");

  if (!Array.isArray(s.assertions) || s.assertions.length < 1)
    fail("seed: assertions array missing or empty");
  else ok(`seed: ${s.assertions.length} assertions present`);
}

// --- 3. cross-DTO continuity invariants ------------------------------------

const expectedActor = seed?.parsed?.continuity_actor_id;
const expectedSeedId = seed?.parsed?.fixture_id;

for (const [label, dto] of [
  ["operator-private", opPriv],
  ["public-discord", pubDisc],
  ["referral", referral],
]) {
  if (!dto?.parsed) continue;
  const d = dto.parsed;
  if (expectedActor && d.continuity_actor_id !== expectedActor)
    fail(`${label}: continuity_actor_id mismatch (expected ${expectedActor}, got ${d.continuity_actor_id})`);
  else if (expectedActor)
    ok(`${label}: continuity_actor_id matches seed (${expectedActor})`);

  if (expectedSeedId && d.source_seed_fixture !== expectedSeedId)
    fail(`${label}: source_seed_fixture must reference seed (expected ${expectedSeedId}, got ${d.source_seed_fixture})`);
  else if (expectedSeedId)
    ok(`${label}: source_seed_fixture references seed`);
}

// --- 4. operator-private frame invariants ----------------------------------

if (opPriv?.parsed) {
  const d = opPriv.parsed;
  if (d.recall_interface !== "operator_private")
    fail(`operator-private: recall_interface must be operator_private, got ${d.recall_interface}`);
  else ok("operator-private: recall_interface === operator_private");

  if (d.render_surface !== "operator_debug")
    fail(`operator-private: render_surface must be operator_debug, got ${d.render_surface}`);
  else ok("operator-private: render_surface === operator_debug");
}

// --- 5. public-discord + referral frame invariants -------------------------

for (const [label, dto] of [
  ["public-discord", pubDisc],
  ["referral", referral],
]) {
  if (!dto?.parsed) continue;
  const d = dto.parsed;
  if (d.recall_interface !== "public_discord")
    fail(`${label}: recall_interface must be public_discord, got ${d.recall_interface}`);
  else ok(`${label}: recall_interface === public_discord`);

  if (d.render_surface !== "discord_public_character")
    fail(`${label}: render_surface must be discord_public_character, got ${d.render_surface}`);
  else ok(`${label}: render_surface === discord_public_character`);
}

// --- 6. referral-specific invariants ---------------------------------------

if (referral?.parsed) {
  const d = referral.parsed;
  if (!d.safe_referral_target)
    fail("referral: safe_referral_target missing");
  else ok(`referral: safe_referral_target === ${d.safe_referral_target}`);

  if (!d.public_referral_message || d.public_referral_message.length < 4)
    fail("referral: public_referral_message missing or too short");
  else ok("referral: public_referral_message present");

  if (d.outcome !== "referral")
    fail(`referral: outcome must be referral, got ${d.outcome}`);
  else ok("referral: outcome === referral");

  if (d.denied_or_refused !== true)
    fail("referral: denied_or_refused must be true");
  else ok("referral: denied_or_refused === true");
}

// --- 7. public-safe leak grep ----------------------------------------------

for (const fname of PUBLIC_SAFE_DTOS) {
  const path = join(PROJECTED_DIR, fname);
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    fail(`could not read ${fname}: ${err.message}`);
    continue;
  }

  for (const banned of BANNED_PUBLIC_SUBSTRINGS) {
    if (raw.includes(banned)) {
      fail(`leak: ${fname} contains banned public substring "${banned}"`);
    }
  }
  ok(`${fname}: no banned public substrings`);
}

// --- 8. phase 35d recorded dixie envelope fixtures -------------------------
//
// As of phase 35d these fixtures are part of the recall-wedge fixture
// contract. The validator must FAIL if the dixie-envelope directory or
// any of the three required fixtures go missing — silently skipping
// section 8 would let a future deletion regress the multi-surface
// contract without warning.
//
// The unknown-version fixture is intentionally valid-JSON but tagged
// with an unsupported envelope_version so adapter fail-closed tests
// have something to bite on. Validator behavior: it must EXIST and
// PARSE; its envelope_version must be PRESENT but NOT in the supported
// list. Its unsupported-ness is the point — the validator does not
// downgrade the run because of it.
//
// No leak-grep is run over raw Dixie envelope files: those intentionally
// contain raw_dixie_debug / raw_session_trace / source_material /
// PRIVATE_SENTINEL_* / session_id / message_id / continuity_actor_id
// because the adapter is responsible for stripping that material before
// it ever reaches a renderer. Public no-leak validation continues to
// gate only the public-safe projected DTOs (section 7); adapter unit
// tests cover the Dixie stripping behavior end-to-end.

let dixieDirExists = false;
try {
  const st = statSync(DIXIE_ENVELOPE_DIR);
  dixieDirExists = st.isDirectory();
} catch {
  dixieDirExists = false;
}

if (!dixieDirExists) {
  fail(
    `dixie-envelope: directory ${DIXIE_ENVELOPE_DIR} is required as of phase 35d but is missing`,
  );
} else {
  ok("dixie-envelope: directory present");

  const dixieFilesListed = listJsonFiles(DIXIE_ENVELOPE_DIR);
  for (const f of dixieFilesListed) {
    const loaded = loadJson(f);
    if (loaded) ok(`parsed ${f}`);
  }

  const REQUIRED_DIXIE_FILES = [
    DIXIE_PUBLIC_ENVELOPE_FILE,
    DIXIE_REFERRAL_ENVELOPE_FILE,
    DIXIE_UNKNOWN_VERSION_ENVELOPE_FILE,
  ];

  for (const fname of REQUIRED_DIXIE_FILES) {
    const path = join(DIXIE_ENVELOPE_DIR, fname);
    let present = false;
    try {
      present = statSync(path).isFile();
    } catch {
      present = false;
    }
    if (!present)
      fail(`dixie-envelope: required fixture ${fname} is missing`);
    else ok(`dixie-envelope: required fixture ${fname} present`);
  }

  const dixiePublic = loadJson(
    join(DIXIE_ENVELOPE_DIR, DIXIE_PUBLIC_ENVELOPE_FILE),
  );
  const dixieReferral = loadJson(
    join(DIXIE_ENVELOPE_DIR, DIXIE_REFERRAL_ENVELOPE_FILE),
  );
  const dixieUnknown = loadJson(
    join(DIXIE_ENVELOPE_DIR, DIXIE_UNKNOWN_VERSION_ENVELOPE_FILE),
  );

  // Shared invariants run on ALL three fixtures (including the
  // unknown-version one): synthetic, fixture_kind, input_envelope_kind,
  // non_production_authorization_note. The unknown-version fixture is
  // unsupported only on envelope_version — every other phase-35d
  // invariant still applies.
  const allDixie = [
    ["dixie-public", dixiePublic],
    ["dixie-referral", dixieReferral],
    ["dixie-unknown-version", dixieUnknown],
  ];

  for (const [label, env] of allDixie) {
    if (!env?.parsed) {
      fail(`${label}: fixture failed to parse`);
      continue;
    }
    const e = env.parsed;
    if (e.synthetic !== true) fail(`${label}: synthetic must be true`);
    else ok(`${label}: synthetic === true`);

    if (e.fixture_kind !== "recorded_dixie_recall_envelope")
      fail(
        `${label}: fixture_kind must be recorded_dixie_recall_envelope, got ${e.fixture_kind}`,
      );
    else ok(`${label}: fixture_kind === recorded_dixie_recall_envelope`);

    if (e.input_envelope_kind !== "recorded_dixie_recall_envelope")
      fail(
        `${label}: input_envelope_kind must be recorded_dixie_recall_envelope, got ${e.input_envelope_kind}`,
      );
    else ok(`${label}: input_envelope_kind === recorded_dixie_recall_envelope`);

    if (!e.non_production_authorization_note)
      fail(`${label}: non_production_authorization_note missing`);
    else ok(`${label}: non_production_authorization_note present`);
  }

  // envelope_version: v0 fixtures must be SUPPORTED; the unknown-version
  // fixture must be PRESENT but NOT SUPPORTED.
  const supportedExpected = [
    ["dixie-public", dixiePublic],
    ["dixie-referral", dixieReferral],
  ];
  for (const [label, env] of supportedExpected) {
    if (!env?.parsed) continue;
    const e = env.parsed;
    if (
      typeof e.envelope_version !== "string" ||
      !SUPPORTED_DIXIE_ENVELOPE_VERSIONS.includes(e.envelope_version)
    )
      fail(
        `${label}: envelope_version must be one of [${SUPPORTED_DIXIE_ENVELOPE_VERSIONS.join("|")}], got ${e.envelope_version}`,
      );
    else ok(`${label}: envelope_version === ${e.envelope_version}`);
  }

  if (dixieUnknown?.parsed) {
    const e = dixieUnknown.parsed;
    if (
      typeof e.envelope_version !== "string" ||
      e.envelope_version.length === 0
    )
      fail(
        "dixie-unknown-version: envelope_version must be present (it is meant to be syntactically valid but unsupported)",
      );
    else if (SUPPORTED_DIXIE_ENVELOPE_VERSIONS.includes(e.envelope_version))
      fail(
        `dixie-unknown-version: envelope_version must NOT be in the supported list, got ${e.envelope_version} (it is meant to drive adapter fail-closed tests)`,
      );
    else
      ok(
        `dixie-unknown-version: envelope_version present and intentionally unsupported (${e.envelope_version})`,
      );
  }
}

// --- report ----------------------------------------------------------------

const dixieFilesForReport = dixieDirExists
  ? listJsonFiles(DIXIE_ENVELOPE_DIR)
  : [];

const fixtures = [
  ...seedFiles.map((f) => `  seed:      ${f.replace(FIXTURES_DIR + "/", "")}`),
  ...projectedFiles.map((f) => `  projected: ${f.replace(FIXTURES_DIR + "/", "")}`),
  ...dixieFilesForReport.map(
    (f) => `  dixie-env: ${f.replace(FIXTURES_DIR + "/", "")}`,
  ),
].sort();

console.log("recall-wedge phase 33b fixture validator");
console.log("----------------------------------------");
console.log("fixtures:");
for (const line of fixtures) console.log(line);
console.log("");
console.log(`checks passed: ${successes.length}`);
console.log(`checks failed: ${failures.length}`);

if (failures.length > 0) {
  console.log("");
  console.log("failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

console.log("");
console.log("ok — all phase 33b fixture invariants hold; no public-side leaks detected.");
process.exit(0);
