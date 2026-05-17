#!/usr/bin/env bun
// cycle-006 follow-up · substrate-native local trace dashboard.
// cycle-007 S5 extensions: layer-color borders (T5.2) · layer-split detail panel (T5.3) ·
// visual-regression-ready safe-render (T5.4) · SSE-behind-flag + cookie auth + Host check +
// max-clients + heartbeat + truncation (T5.5).
//
// Reads (delegated to scripts/lib/trace-readers.ts · T5.1 dedup):
//   - .run/llm-trace.jsonl                 (LLM call: prompt + response + tokens)
//   - .run/voice-memory/<stream>/*.jsonl   (cross-week voice memory entries)
//   - .run/score-snapshot-rejections.jsonl (RT-008 plausibility rejections)
//   - .run/voice-memory-deletions.jsonl    (SKP-004 forget-user audit)
//   - .run/score-baselines/<zone>.jsonl    (rolling-window baseline state)
//   - .run/sanitize-violations.jsonl       (presentation-layer FR-1 hook · cycle-007 S6)
//
// Serves (cookie-authenticated when DASHBOARD_AUTH=1 · default ON):
//   GET  /                  → single-page HTML viewer
//   POST /api/auth          → exchange X-Loa-Dash-Token header for HttpOnly cookie
//   GET  /api/llm-trace     → array of LlmTraceEntry, newest first
//   GET  /api/voice-memory  → grouped by stream/key, newest entries
//   GET  /api/rejections    → score-snapshot rejection log
//   GET  /api/baselines     → per-zone baseline snapshot count
//   GET  /api/violations    → presentation-layer sanitize violations (cycle-007 S6)
//   GET  /sse               → server-sent events stream of new rows (when LOA_DASH_SSE=1)
//
// Usage:
//   bun run scripts/dashboard.ts
//   → http://localhost:3001 (token printed to stderr · copy into curl to bootstrap cookie)
//
// Override port: DASHBOARD_PORT=4000 bun run scripts/dashboard.ts
// Enable SSE:    LOA_DASH_SSE=1 bun run scripts/dashboard.ts
// Disable auth:  DASHBOARD_AUTH=0 (NOT recommended · only for test fixtures)

import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import {
  resolveTraceFilePath,
  readJsonl,
  allTraceFilePaths,
} from './lib/trace-readers.ts';
import { sanitizeForTerminal } from './lib/safe-render.ts';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3001);
const HOSTNAME = '127.0.0.1'; // Flatline IMP-005 (855) · NEVER '0.0.0.0'
const AUTH_ENABLED = process.env.DASHBOARD_AUTH !== '0';
const SSE_ENABLED = process.env.LOA_DASH_SSE === '1';
const MAX_CLIENTS = Number(process.env.DASHBOARD_SSE_MAX_CLIENTS ?? 5); // BB MEDIUM-2
const HEARTBEAT_MS = 60_000; // BB MEDIUM-2
const PAYLOAD_TRUNCATE_AT = 500; // BB MEDIUM-3
const COOKIE_NAME = 'loa_dash_token';
const SSE_POLL_MS = 2_000; // server-side scan cadence for fresh rows

// AC-RT-001 · per-session bearer token printed to stderr. Operator copies into
// `curl -H "X-Loa-Dash-Token: ..." http://127.0.0.1:3001/api/auth` to bootstrap
// the HttpOnly cookie. Defends against DNS-rebinding (token unknown to attacker
// page) + closes the un-tokened-SSE attack surface.
const LOA_DASH_TOKEN = process.env.LOA_DASH_TOKEN || randomUUID();
const TOKEN_BUFFER = Buffer.from(LOA_DASH_TOKEN, 'utf-8');

// AC-RT-001 · Host header allowlist (DNS-rebinding defense). The port portion
// is server-bound so we compute the allowed set at startup.
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);

// ──────────────────────────────────────────────────────────────────────
// Trace row shapes · API endpoint contracts (preserved across cycle-007 S5)
// ──────────────────────────────────────────────────────────────────────

interface LlmTraceEntry {
  at: string;
  duration_ms: number;
  model_id: string;
  region: string;
  path: 'sdk' | 'fetch';
  zone?: string;
  post_type?: string;
  character_id?: string;
  system_prompt: string;
  user_message: string;
  output: string;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  error?: string;
  run_id?: string;
  // cycle-007 envelope (S2/T2.3 · optional · readers tolerate absence)
  layer?: string;
  layer_op?: string;
  emitted_at?: string;
}

interface VoiceMemoryEntry { key: string; entry: unknown }
interface RejectionEntry { zone?: string; rejected_at?: string; reason?: string; [k: string]: unknown }
interface BaselineEntry { zone: string; snapshot_count: number }
interface ViolationEntry { violations?: unknown; sample?: string; emitted_at?: string; [k: string]: unknown }

function readLlmTrace(): LlmTraceEntry[] {
  return readJsonl<LlmTraceEntry>(resolveTraceFilePath('llm-trace.jsonl')).reverse();
}

function readVoiceMemory(): Record<string, VoiceMemoryEntry[]> {
  const dir = resolveTraceFilePath('voice-memory');
  if (!existsSync(dir)) return {};
  const grouped: Record<string, VoiceMemoryEntry[]> = {};
  for (const stream of readdirSync(dir)) {
    const streamDir = resolve(dir, stream);
    if (!statSync(streamDir).isDirectory()) continue;
    grouped[stream] = [];
    for (const file of readdirSync(streamDir)) {
      if (!file.endsWith('.jsonl')) continue;
      const key = file.replace(/\.jsonl$/, '');
      const entries = readJsonl<unknown>(resolve(streamDir, file));
      const latest = entries[entries.length - 1];
      if (latest) grouped[stream]!.push({ key, entry: latest });
    }
  }
  return grouped;
}

function readRejections(): RejectionEntry[] {
  return readJsonl<RejectionEntry>(resolveTraceFilePath('score-snapshot-rejections.jsonl')).reverse();
}

function readBaselines(): BaselineEntry[] {
  const dir = resolveTraceFilePath('score-baselines');
  if (!existsSync(dir)) return [];
  const out: BaselineEntry[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.jsonl')) continue;
    const zone = file.replace(/\.jsonl$/, '');
    const entries = readJsonl<unknown>(resolve(dir, file));
    out.push({ zone, snapshot_count: entries.length });
  }
  return out;
}

function readViolations(): ViolationEntry[] {
  return readJsonl<ViolationEntry>(resolveTraceFilePath('sanitize-violations.jsonl')).reverse();
}

// ──────────────────────────────────────────────────────────────────────
// Auth + Host validation · cycle-007 S5/T5.5 (Phase 6 SKP-002 cookie bootstrap)
// ──────────────────────────────────────────────────────────────────────

function constantTimeTokenMatch(candidate: string): boolean {
  const buf = Buffer.from(candidate, 'utf-8');
  if (buf.length !== TOKEN_BUFFER.length) return false;
  try {
    return timingSafeEqual(buf, TOKEN_BUFFER);
  } catch {
    return false;
  }
}

function hostAllowed(req: Request): boolean {
  const host = req.headers.get('host') ?? '';
  return ALLOWED_HOSTS.has(host);
}

function originAllowed(req: Request): boolean {
  // Origin is only set on cross-origin / fetch / EventSource requests; same-origin
  // navigations may omit it. When absent, treat as same-origin (allowed).
  const origin = req.headers.get('origin');
  if (!origin) return true;
  return origin === `http://127.0.0.1:${PORT}` || origin === `http://localhost:${PORT}`;
}

function parseCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function authenticated(req: Request): boolean {
  if (!AUTH_ENABLED) return true;
  // Either: valid X-Loa-Dash-Token header OR valid cookie. Both are timing-safe-compared.
  const headerToken = req.headers.get('x-loa-dash-token');
  if (headerToken && constantTimeTokenMatch(headerToken)) return true;
  const cookieToken = parseCookie(req, COOKIE_NAME);
  if (cookieToken && constantTimeTokenMatch(cookieToken)) return true;
  return false;
}

function bootstrapHelpResponse(): Response {
  const body = JSON.stringify({
    error: 'auth-required',
    hint: 'copy the LOA_DASH_TOKEN printed to stderr at server start',
    bootstrap_curl: `curl -i -X POST -H 'X-Loa-Dash-Token: <token>' -H 'Host: localhost:${PORT}' http://localhost:${PORT}/api/auth`,
    then: `open http://localhost:${PORT} in browser (cookie is now set)`,
  }, null, 2);
  return new Response(body, {
    status: 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function setCookieHeader(): string {
  // No Secure on localhost HTTP. HttpOnly + SameSite=Strict close XSS-exfiltration + CSRF.
  return `${COOKIE_NAME}=${encodeURIComponent(LOA_DASH_TOKEN)}; Path=/; HttpOnly; SameSite=Strict`;
}

// ──────────────────────────────────────────────────────────────────────
// SSE state · cycle-007 S5/T5.5 (BB MEDIUM-2 cap+heartbeat · AC-RT-010 evict-prior)
// ──────────────────────────────────────────────────────────────────────

interface SseClient {
  id: string;
  controller: ReadableStreamDefaultController<Uint8Array>;
  token_match: string; // hashed token to detect "same token, new conn" without storing raw token
  heartbeat: ReturnType<typeof setInterval>;
}

const sseClients = new Map<string, SseClient>();
const encoder = new TextEncoder();

function tokenFingerprint(req: Request): string {
  // Stable per-token fingerprint that NEVER leaks token material. SHA-256 → 12 hex chars.
  // Same token always produces the same fingerprint (eviction key for AC-RT-010); different
  // tokens collide only with cryptographic improbability. Pre-image resistance closes the
  // information-leak class if the fingerprint surfaces in logs (sprint-5 r2 review ISSUE-4).
  const headerToken = req.headers.get('x-loa-dash-token');
  const cookieToken = parseCookie(req, COOKIE_NAME);
  const raw = headerToken ?? cookieToken ?? '';
  if (!raw) return '';
  return createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

function evictSameTokenConnections(fingerprint: string): number {
  let evicted = 0;
  for (const [id, client] of sseClients) {
    if (client.token_match === fingerprint) {
      try { client.controller.close(); } catch { /* already closed */ }
      clearInterval(client.heartbeat);
      sseClients.delete(id);
      evicted++;
    }
  }
  return evicted;
}

function broadcastSse(event: { type: string; row: unknown }): void {
  if (sseClients.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const bytes = encoder.encode(payload);
  for (const [id, client] of sseClients) {
    try {
      client.controller.enqueue(bytes);
    } catch {
      // Client gone; reap.
      clearInterval(client.heartbeat);
      sseClients.delete(id);
    }
  }
}

// BB MEDIUM-3 · truncate large payload string fields before transmission so the
// browser doesn't main-thread-jank parsing 50KB LLM responses. Full row remains
// available via REST `/api/llm-trace`.
function truncatePayloadFields(row: LlmTraceEntry): LlmTraceEntry {
  const out = { ...row };
  for (const field of ['system_prompt', 'user_message', 'output', 'error'] as const) {
    const v = out[field];
    if (typeof v === 'string' && v.length > PAYLOAD_TRUNCATE_AT) {
      out[field] = v.slice(0, PAYLOAD_TRUNCATE_AT) + '…[truncated]';
    }
  }
  return out;
}

// AC-RT-003 (INV-18) · server pre-sanitizes payload string values before SSE
// transmission. Browser-side renderer also uses textContent (defense in depth).
function sanitizePayloadFields(row: LlmTraceEntry): LlmTraceEntry {
  const out = { ...row };
  for (const field of ['system_prompt', 'user_message', 'output', 'error'] as const) {
    const v = out[field];
    if (typeof v === 'string') out[field] = sanitizeForTerminal(v);
  }
  return out;
}

function shapeRowForSse(row: LlmTraceEntry): LlmTraceEntry {
  return sanitizePayloadFields(truncatePayloadFields(row));
}

// ──────────────────────────────────────────────────────────────────────
// HTML / CSS / client JS (single-page viewer) · cycle-007 S5/T5.2 + T5.3
// ──────────────────────────────────────────────────────────────────────

const HTML = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<title>freeside · trace dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #0d0e10;
    --bg-elev: #16181c;
    --bg-hover: #1e2126;
    --border: #2a2d33;
    --text: #e4e6eb;
    --text-dim: #8b8f99;
    --accent: #c9a44c;
    --error: #e74c3c;
    --success: #2ecc71;
    --mono: ui-monospace, 'SF Mono', Consolas, 'Liberation Mono', monospace;

    /* cycle-007 S5/T5.2 · Alexander oklch layer palette (INV-10).
       Layer encoding is teachable in <3 min — colors map directly to
       substrate / voice / presentation / medium-render / orchestrator. */
    --layer-substrate:     oklch(64% 0.10 230);   /* cool blue */
    --layer-voice:         oklch(72% 0.14 80);    /* warm gold */
    --layer-presentation:  oklch(70% 0.10 160);   /* sage green */
    --layer-medium-render: oklch(68% 0.10 320);   /* lavender */
    --layer-orchestrator:  oklch(66% 0.08 280);   /* dim purple */
    --layer-unknown:       oklch(50% 0.04 0);     /* neutral grey */
    /* Brighter variants for selection / flash (oklch lightness +10%). */
    --layer-substrate-bright:     oklch(74% 0.12 230);
    --layer-voice-bright:         oklch(82% 0.16 80);
    --layer-presentation-bright:  oklch(80% 0.12 160);
    --layer-medium-render-bright: oklch(78% 0.12 320);
    --layer-orchestrator-bright:  oklch(76% 0.10 280);
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font: 14px/1.5 -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; height: 100%; }
  body { display: grid; grid-template-columns: 320px 1fr; grid-template-rows: 56px 1fr; }
  header { grid-column: 1 / -1; padding: 0 20px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev); }
  header h1 { margin: 0; font-size: 14px; font-weight: 600; color: var(--accent); }
  header .tabs { display: flex; gap: 4px; margin-left: auto; }
  header .tab { padding: 6px 12px; border-radius: 4px; cursor: pointer; color: var(--text-dim); font-size: 13px; }
  header .tab:hover { background: var(--bg-hover); color: var(--text); }
  header .tab.active { background: var(--bg-hover); color: var(--accent); }
  header .status { font-size: 12px; color: var(--text-dim); font-family: var(--mono); }
  header .status .dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--success); margin-right: 6px; animation: pulse 2s infinite; }
  header .status.live .dot { background: var(--accent); }
  @keyframes pulse { 50% { opacity: .4; } }
  aside { border-right: 1px solid var(--border); overflow-y: auto; background: var(--bg-elev); }

  /* cycle-007 S5/T5.2 · per-row 3px left-border colored by layer.
     Hover: 80ms ease-out background fade (NOT translate-y · Alexander spec).
     Selection: instant border-left activation, no animation. */
  .run { padding: 12px 16px; border-bottom: 1px solid var(--border); border-left: 3px solid var(--layer-unknown); cursor: pointer; transition: background 80ms ease-out; }
  .run:hover { background: var(--bg-hover); }
  .run.active { background: var(--bg-hover); }
  .run.layer-substrate     { border-left-color: var(--layer-substrate); }
  .run.layer-voice         { border-left-color: var(--layer-voice); }
  .run.layer-presentation  { border-left-color: var(--layer-presentation); }
  .run.layer-medium-render { border-left-color: var(--layer-medium-render); }
  .run.layer-orchestrator  { border-left-color: var(--layer-orchestrator); }
  /* Live-flash · 200ms ease-out brightness boost when SSE pushes a new row. */
  .run.flash.layer-substrate     { border-left-color: var(--layer-substrate-bright); }
  .run.flash.layer-voice         { border-left-color: var(--layer-voice-bright); }
  .run.flash.layer-presentation  { border-left-color: var(--layer-presentation-bright); }
  .run.flash.layer-medium-render { border-left-color: var(--layer-medium-render-bright); }
  .run.flash.layer-orchestrator  { border-left-color: var(--layer-orchestrator-bright); }
  .run.flash { animation: flash-fade 200ms ease-out; }
  @keyframes flash-fade { 0% { filter: brightness(1.3); } 100% { filter: brightness(1); } }

  .run-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .run-zone { font-size: 13px; color: var(--text); font-weight: 500; }
  .run-time { font-size: 11px; color: var(--text-dim); font-family: var(--mono); }
  .run-meta { font-size: 11px; color: var(--text-dim); font-family: var(--mono); }
  .run.error .run-zone::after { content: ' ⚠'; color: var(--error); }
  main { overflow-y: auto; padding: 24px 32px; }
  main h2 { margin: 0 0 16px; font-size: 14px; color: var(--text-dim); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
  .empty { color: var(--text-dim); text-align: center; padding: 80px 20px; font-style: italic; }

  /* cycle-007 S5/T5.3 · layer-split detail.
     Four panels (substrate / voice / presentation / medium-render) arranged
     in a viewport-adaptive grid. Selected row's source layer is highlighted;
     other panels carry related cross-layer context with subtle connectors. */
  .layer-grid { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 16px; }
  @media (max-width: 1100px) { .layer-grid { grid-template-columns: 1fr; } }
  .layer-panel { background: var(--bg-elev); border: 1px solid var(--border); border-left: 3px solid var(--layer-unknown); border-radius: 6px; padding: 12px 16px; min-height: 80px; transition: max-height 200ms ease-out, opacity 200ms ease-out; opacity: 0.55; }
  .layer-panel.active { opacity: 1; box-shadow: 0 0 0 1px var(--border-active); }
  .layer-panel.layer-substrate     { border-left-color: var(--layer-substrate); }
  .layer-panel.layer-voice         { border-left-color: var(--layer-voice); }
  .layer-panel.layer-presentation  { border-left-color: var(--layer-presentation); }
  .layer-panel.layer-medium-render { border-left-color: var(--layer-medium-render); }
  .layer-panel h3 { margin: 0 0 6px; font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; font-family: var(--mono); }
  .layer-panel .layer-content { font-family: var(--mono); font-size: 12px; line-height: 1.55; color: var(--text); }
  .layer-panel .layer-empty { color: var(--text-dim); font-style: italic; font-size: 12px; }

  /* Cross-layer connector · 1px subtle line in OTHER layer's color, rendered
     as a top-right corner accent on each panel that has cross-layer attribution. */
  .layer-panel .connector { display: inline-block; height: 1px; width: 14px; vertical-align: middle; margin-left: 6px; }
  .layer-panel .connector.layer-substrate     { background: var(--layer-substrate); }
  .layer-panel .connector.layer-voice         { background: var(--layer-voice); }
  .layer-panel .connector.layer-presentation  { background: var(--layer-presentation); }
  .layer-panel .connector.layer-medium-render { background: var(--layer-medium-render); }

  .panel { background: var(--bg-elev); border: 1px solid var(--border); border-radius: 6px; padding: 16px 20px; margin-bottom: 16px; }
  .panel-title { font-size: 11px; color: var(--text-dim); text-transform: uppercase; letter-spacing: .04em; margin: 0 0 12px; }
  .panel pre { margin: 0; font-family: var(--mono); font-size: 12px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; color: var(--text); }
  .kv { display: grid; grid-template-columns: 140px 1fr; gap: 4px 16px; font-family: var(--mono); font-size: 12px; }
  .kv .k { color: var(--text-dim); }
  .kv .v { color: var(--text); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; background: var(--bg-hover); color: var(--text-dim); font-family: var(--mono); font-size: 11px; }
  .badge.success { background: rgba(46, 204, 113, 0.15); color: var(--success); }
  .badge.error { background: rgba(231, 76, 60, 0.15); color: var(--error); }
  .badge.zone { background: rgba(201, 164, 76, 0.15); color: var(--accent); }
  details { border: 1px solid var(--border); border-radius: 4px; padding: 8px 12px; margin-bottom: 8px; background: var(--bg-elev); }
  details summary { cursor: pointer; color: var(--text-dim); font-size: 12px; font-family: var(--mono); }
  details[open] summary { color: var(--accent); margin-bottom: 8px; }
  details pre { margin-top: 8px; font-family: var(--mono); font-size: 11px; white-space: pre-wrap; word-break: break-word; }
</style>
</head>
<body>
<header>
  <h1>freeside · trace dashboard</h1>
  <div class="tabs">
    <div class="tab active" data-view="trace">LLM calls</div>
    <div class="tab" data-view="memory">voice memory</div>
    <div class="tab" data-view="rejections">RT-008 rejections</div>
    <div class="tab" data-view="violations">sanitize violations</div>
    <div class="tab" data-view="baselines">baselines</div>
  </div>
  <div class="status"><span class="dot"></span><span id="conn">connected</span> · <span id="count">0</span> rows · <span id="mode">poll</span></div>
</header>
<aside id="list"></aside>
<main id="detail">
  <div class="empty">select a row on the left</div>
</main>
<script>
const SSE_ENABLED = ${SSE_ENABLED ? 'true' : 'false'};
let currentView = 'trace';
let currentIdx = null;
let cache = { trace: [], memory: {}, rejections: [], violations: [], baselines: [] };

// Layer inference per source. cycle-007 envelope (layer field) takes precedence
// when present; otherwise we use shape-based defaults that match the row's
// producing component.
function inferLayer(row, source) {
  if (row && typeof row.layer === 'string') return row.layer;
  if (source === 'trace') return 'voice';            // llm-trace.jsonl is voice/bedrock-converse
  if (source === 'memory') return 'voice';           // voice-memory writes
  if (source === 'rejections') return 'substrate';   // score-snapshot rejections
  if (source === 'violations') return 'presentation'; // sanitize-violations
  if (source === 'baselines') return 'substrate';    // score baselines
  return 'unknown';
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const t = d.toLocaleTimeString('en-US', { hour12: false });
  const today = new Date().toDateString() === d.toDateString();
  return today ? t : d.toLocaleDateString() + ' ' + t;
}

function fmtDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

// All payload rendering uses textContent (NEVER innerHTML) per Phase 6
// SKP-001/CRITICAL XSS defense. We build small DOM helpers that write text
// safely and use them throughout.
function el(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const k in (props || {})) {
    if (k === 'class') node.className = props[k];
    else if (k === 'dataset') Object.assign(node.dataset, props[k]);
    else if (k === 'text') node.textContent = String(props[k] ?? '');
    else node.setAttribute(k, props[k]);
  }
  for (const c of children) if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

function renderTraceList() {
  const list = document.getElementById('list');
  const rows = cache.trace;
  document.getElementById('count').textContent = rows.length;
  clear(list);
  if (!rows.length) { list.appendChild(el('div', { class: 'empty', text: 'no llm calls yet' })); return; }
  rows.forEach((r, i) => {
    const layer = inferLayer(r, 'trace');
    const row = el('div', {
      class: 'run layer-' + layer + (r.error ? ' error' : '') + (i === currentIdx ? ' active' : ''),
      dataset: { idx: String(i), layer, runId: r.run_id || '' },
    });
    const head = el('div', { class: 'run-head' });
    head.appendChild(el('span', { class: 'run-zone', text: (r.zone || '—') + ' / ' + (r.post_type || '—') }));
    head.appendChild(el('span', { class: 'run-time', text: fmtTime(r.at) }));
    const meta = el('div', { class: 'run-meta', text:
      (r.model_id ? r.model_id.split('.').slice(-1)[0] : '?') + ' · ' +
      fmtDuration(r.duration_ms) + ' · ' +
      (r.input_tokens || 0) + '↓ ' + (r.output_tokens || 0) + '↑'
    });
    row.appendChild(head); row.appendChild(meta);
    row.addEventListener('click', () => { currentIdx = i; renderTraceList(); renderTraceDetail(); });
    list.appendChild(row);
  });
}

function renderLayerGrid(selectedLayer, panels) {
  // panels: { substrate, voice, presentation, 'medium-render' } each can be:
  //   - string (renders as text content)
  //   - HTMLElement (appended)
  //   - null/undefined (empty)
  const grid = el('div', { class: 'layer-grid' });
  for (const layer of ['substrate', 'voice', 'presentation', 'medium-render']) {
    const panel = el('div', {
      class: 'layer-panel layer-' + layer + (layer === selectedLayer ? ' active' : ''),
    });
    const h = el('h3', { text: layer });
    // Cross-layer connector: when this panel has content AND it isn't the
    // selected layer, draw a 1px connector tinted in the SELECTED layer's color
    // (so the eye traces back to the row's origin).
    if (panels[layer] != null && layer !== selectedLayer) {
      h.appendChild(el('span', { class: 'connector layer-' + selectedLayer }));
    }
    panel.appendChild(h);
    const content = panels[layer];
    if (content == null) {
      panel.appendChild(el('div', { class: 'layer-empty', text: '—' }));
    } else if (typeof content === 'string') {
      panel.appendChild(el('div', { class: 'layer-content', text: content }));
    } else {
      const wrap = el('div', { class: 'layer-content' });
      wrap.appendChild(content);
      panel.appendChild(wrap);
    }
    grid.appendChild(panel);
  }
  return grid;
}

function relatedRowsByRunOrZone(row) {
  // Cross-layer correlation: gather other-source rows that share run_id (preferred)
  // or fall back to zone + small time window. The window is generous (5 minutes)
  // because the dashboard is a teaching surface, not a precise correlator.
  const rid = row.run_id;
  const zone = row.zone;
  const ts = row.emitted_at || row.at;
  const tsMs = ts ? Date.parse(ts) : NaN;
  const within = (other) => {
    if (rid && other.run_id === rid) return true;
    if (!zone) return false;
    const otherTs = other.emitted_at || other.at || other.rejected_at;
    if (!otherTs || !Number.isFinite(tsMs)) return false;
    return other.zone === zone && Math.abs(Date.parse(otherTs) - tsMs) < 300_000;
  };
  return {
    rejections: cache.rejections.filter(within),
    violations: cache.violations.filter(within),
  };
}

function renderTraceDetail() {
  const detail = document.getElementById('detail');
  clear(detail);
  if (currentIdx == null) { detail.appendChild(el('div', { class: 'empty', text: 'select a row on the left' })); return; }
  const r = cache.trace[currentIdx];
  if (!r) { detail.appendChild(el('div', { class: 'empty', text: 'row gone' })); return; }
  const layer = inferLayer(r, 'trace');
  const related = relatedRowsByRunOrZone(r);

  // Layer-split detail · cycle-007 S5/T5.3
  const voicePanel = el('div', null);
  voicePanel.appendChild(el('div', { text: 'model ' + (r.model_id || '?') }));
  voicePanel.appendChild(el('div', { text: 'duration ' + fmtDuration(r.duration_ms) }));
  voicePanel.appendChild(el('div', { text: 'tokens ' + (r.input_tokens || 0) + '↓ ' + (r.output_tokens || 0) + '↑' }));
  if (r.error) voicePanel.appendChild(el('div', { text: 'error: ' + r.error }));

  const substratePanel = el('div', null);
  substratePanel.appendChild(el('div', { text: 'zone ' + (r.zone || '—') }));
  substratePanel.appendChild(el('div', { text: 'post_type ' + (r.post_type || '—') }));
  if (related.rejections.length) {
    substratePanel.appendChild(el('div', { text: related.rejections.length + ' related rejection(s) at this zone in window' }));
  }

  const presentationPanel = related.violations.length
    ? el('div', { text: related.violations.length + ' sanitize violation(s) within 5min window' })
    : null;

  const mediumRenderPanel = null; // medium-render rows surfaced only when present in cache (future)

  detail.appendChild(renderLayerGrid(layer, {
    substrate: substratePanel,
    voice: voicePanel,
    presentation: presentationPanel,
    'medium-render': mediumRenderPanel,
  }));

  // Full kv panel + payload sections (textContent-safe per SKP-001/CRITICAL)
  const kv = el('div', { class: 'panel' });
  const kvBody = el('div', { class: 'kv' });
  const kvPair = (k, v) => { kvBody.appendChild(el('span', { class: 'k', text: k })); kvBody.appendChild(el('span', { class: 'v', text: v ?? '—' })); };
  kvPair('when', r.at);
  kvPair('zone', r.zone || '—');
  kvPair('model', r.model_id);
  kvPair('region', r.region);
  kvPair('path', r.path);
  kvPair('duration', fmtDuration(r.duration_ms));
  kvPair('tokens', (r.input_tokens || 0) + ' in / ' + (r.output_tokens || 0) + ' out / ' + (r.total_tokens || 0) + ' total');
  kvPair('character', r.character_id || '—');
  kvPair('run_id', r.run_id || '—');
  if (r.error) kvPair('error', r.error);
  kv.appendChild(kvBody);
  detail.appendChild(kv);

  const promptPanel = el('div', { class: 'panel' });
  promptPanel.appendChild(el('pre', { text: r.system_prompt || '' }));
  detail.appendChild(el('h2', { text: 'System prompt' }));
  detail.appendChild(promptPanel);

  const userPanel = el('div', { class: 'panel' });
  userPanel.appendChild(el('pre', { text: r.user_message || '' }));
  detail.appendChild(el('h2', { text: 'User message' }));
  detail.appendChild(userPanel);

  const outPanel = el('div', { class: 'panel' });
  outPanel.appendChild(el('pre', { text: r.output || '' }));
  detail.appendChild(el('h2', { text: 'Assistant output' }));
  detail.appendChild(outPanel);
}

function renderMemory() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  clear(list); clear(detail);
  const totalCount = Object.values(cache.memory).reduce((a, b) => a + b.length, 0);
  document.getElementById('count').textContent = String(totalCount);
  const streams = Object.keys(cache.memory).sort();
  if (!streams.length) { detail.appendChild(el('div', { class: 'empty', text: 'no voice memory entries yet' })); return; }
  for (const s of streams) {
    detail.appendChild(el('h2', { text: s }));
    const entries = cache.memory[s] || [];
    for (const e of entries) {
      const det = el('details', null);
      det.appendChild(el('summary', { text: e.key + ' · ' + (e.entry && e.entry.at ? e.entry.at : '?') }));
      det.appendChild(el('pre', { text: JSON.stringify(e.entry, null, 2) }));
      detail.appendChild(det);
    }
  }
}

function renderRejections() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  clear(list); clear(detail);
  document.getElementById('count').textContent = String(cache.rejections.length);
  if (!cache.rejections.length) { detail.appendChild(el('div', { class: 'empty', text: 'no score-snapshot rejections' })); return; }
  cache.rejections.forEach((r) => {
    const p = el('div', { class: 'panel' });
    const kvBody = el('div', { class: 'kv' });
    const pair = (k, v) => { kvBody.appendChild(el('span', { class: 'k', text: k })); kvBody.appendChild(el('span', { class: 'v', text: v ?? '—' })); };
    pair('zone', r.zone);
    pair('when', r.rejected_at);
    pair('reason', r.reason);
    pair('sigma', String(r.computed_sigma ?? '—') + ' (threshold ' + String(r.threshold ?? '—') + ')');
    pair('baseline', String(r.baseline_sample_count) + ' samples');
    pair('events', String(r.snapshot_total_events));
    p.appendChild(kvBody);
    detail.appendChild(p);
  });
}

function renderViolations() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  clear(list); clear(detail);
  document.getElementById('count').textContent = String(cache.violations.length);
  if (!cache.violations.length) { detail.appendChild(el('div', { class: 'empty', text: 'no presentation-layer sanitize violations' })); return; }
  cache.violations.forEach((v) => {
    const det = el('details', null);
    det.appendChild(el('summary', { text: (v.emitted_at || '—') + ' · ' + (v.layer_op || 'sanitize-violation') }));
    det.appendChild(el('pre', { text: JSON.stringify(v, null, 2) }));
    detail.appendChild(det);
  });
}

function renderBaselines() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  clear(list); clear(detail);
  document.getElementById('count').textContent = String(cache.baselines.length);
  if (!cache.baselines.length) { detail.appendChild(el('div', { class: 'empty', text: 'no baselines collected yet' })); return; }
  const p = el('div', { class: 'panel' });
  const kvBody = el('div', { class: 'kv' });
  cache.baselines.forEach((b) => {
    kvBody.appendChild(el('span', { class: 'k', text: b.zone }));
    kvBody.appendChild(el('span', { class: 'v', text: b.snapshot_count + ' accepted snapshots' }));
  });
  p.appendChild(kvBody);
  detail.appendChild(p);
}

function render() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === currentView));
  if (currentView === 'trace') { renderTraceList(); renderTraceDetail(); }
  else if (currentView === 'memory') renderMemory();
  else if (currentView === 'rejections') renderRejections();
  else if (currentView === 'violations') renderViolations();
  else if (currentView === 'baselines') renderBaselines();
}

async function refresh() {
  try {
    const [trace, memory, rejections, violations, baselines] = await Promise.all([
      fetch('/api/llm-trace', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/voice-memory', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/rejections', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/violations', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/baselines', { credentials: 'same-origin' }).then((r) => r.json()),
    ]);
    cache = { trace, memory, rejections, violations, baselines };
    render();
    document.getElementById('conn').textContent = 'connected';
  } catch (err) {
    document.getElementById('conn').textContent = 'reconnecting…';
  }
}

// Sprint-5 r2 ISSUE-1 (AC-T5.5-B) · when SSE owns the llm-trace channel, skip
// it here so we honor the spec's "poll cadence suppressed" requirement. The
// other 4 endpoints still poll because SSE only carries new llm-trace rows.
async function refreshNonTraceTabs() {
  try {
    const [memory, rejections, violations, baselines] = await Promise.all([
      fetch('/api/voice-memory', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/rejections', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/violations', { credentials: 'same-origin' }).then((r) => r.json()),
      fetch('/api/baselines', { credentials: 'same-origin' }).then((r) => r.json()),
    ]);
    cache = { ...cache, memory, rejections, violations, baselines };
    render();
    document.getElementById('conn').textContent = 'connected';
  } catch (err) {
    document.getElementById('conn').textContent = 'reconnecting…';
  }
}

let pollHandle = null;
function startFullPoll() {
  if (pollHandle != null) clearInterval(pollHandle);
  pollHandle = setInterval(refresh, 2000);
}
function startNonTracePoll() {
  if (pollHandle != null) clearInterval(pollHandle);
  pollHandle = setInterval(refreshNonTraceTabs, 2000);
}

function flashRowByRunId(rid) {
  if (!rid) return;
  document.querySelectorAll('.run').forEach((row) => {
    if (row.dataset && row.dataset.runId === rid) {
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 200);
    }
  });
}

function attachSse() {
  if (!SSE_ENABLED) return;
  const es = new EventSource('/sse', { withCredentials: true });
  document.getElementById('mode').textContent = 'live';
  document.querySelector('.status').classList.add('live');
  es.onopen = () => {
    // Sprint-5 r2 ISSUE-1 (AC-T5.5-B) · SSE owns the llm-trace channel; suppress
    // the llm-trace half of the poll cadence. Other tabs keep their 2s refresh.
    startNonTracePoll();
  };
  es.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data);
      if (event.type === 'new-row' && event.row) {
        // Prepend to cache and re-render the active tab; flash the new row.
        cache.trace = [event.row].concat(cache.trace);
        render();
        flashRowByRunId(event.row.run_id);
      }
    } catch { /* ignore malformed SSE payload */ }
  };
  es.onerror = () => {
    document.getElementById('conn').textContent = 'sse disconnected';
    document.getElementById('mode').textContent = 'poll';
    document.querySelector('.status').classList.remove('live');
    try { es.close(); } catch {}
    // After error, restore the full poll cadence (llm-trace + others).
    startFullPoll();
  };
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { currentView = t.dataset.view; currentIdx = null; render(); }));

refresh();
startFullPoll();
attachSse();
</script>
</body>
</html>
`;

// ──────────────────────────────────────────────────────────────────────
// SSE broadcast loop · poll the trace files, emit new rows
// ──────────────────────────────────────────────────────────────────────

// FIFO-capped seen-set · prevents unbounded growth in long-running dashboards
// (sprint-5 r2 review ISSUE-3). Insertion order is preserved by Set so we can
// drop the oldest entries when the cap is hit.
const SEEN_RUN_ID_CAP = 50_000;
const SEEN_RUN_ID_SHRINK_TO = 40_000;
const lastSeenRunIds = new Set<string>();
function rememberRunId(id: string): void {
  if (lastSeenRunIds.has(id)) return;
  lastSeenRunIds.add(id);
  if (lastSeenRunIds.size <= SEEN_RUN_ID_CAP) return;
  // Re-seat: keep the most-recent SEEN_RUN_ID_SHRINK_TO entries by insertion order.
  const drop = lastSeenRunIds.size - SEEN_RUN_ID_SHRINK_TO;
  let i = 0;
  for (const k of lastSeenRunIds) {
    if (i++ < drop) lastSeenRunIds.delete(k);
    else break;
  }
}
let sseLoopHandle: ReturnType<typeof setInterval> | null = null;
let primeSseSeen = true; // first scan only seeds the set (no replay flood)

function sseScanTick(): void {
  if (sseClients.size === 0) {
    primeSseSeen = true;
    return;
  }
  const rows = readLlmTrace();
  if (primeSseSeen) {
    for (const r of rows) {
      const id = r.run_id || `${r.at}:${r.model_id}`;
      rememberRunId(id);
    }
    primeSseSeen = false;
    return;
  }
  // Newest first → walk until we hit a seen id; everything before is fresh.
  const fresh: LlmTraceEntry[] = [];
  for (const r of rows) {
    const id = r.run_id || `${r.at}:${r.model_id}`;
    if (lastSeenRunIds.has(id)) break;
    rememberRunId(id);
    fresh.push(r);
  }
  // Emit oldest-first so the UI prepends in correct order.
  for (const row of fresh.reverse()) {
    broadcastSse({ type: 'new-row', row: shapeRowForSse(row) });
  }
}

function startSseLoop(): void {
  if (sseLoopHandle) return;
  sseLoopHandle = setInterval(sseScanTick, SSE_POLL_MS);
}

// ──────────────────────────────────────────────────────────────────────
// Bun.serve · single fetch() handler with per-request auth + Host + routing
// ──────────────────────────────────────────────────────────────────────

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(init.headers ?? {}) },
  });
}

function handleSse(req: Request): Response {
  if (!SSE_ENABLED) {
    return new Response('sse-disabled · set LOA_DASH_SSE=1', { status: 503 });
  }
  if (!originAllowed(req)) {
    return new Response('forbidden-origin', { status: 403 });
  }

  // AC-RT-010 · evict prior connection with the same token before accepting.
  const fingerprint = tokenFingerprint(req);
  evictSameTokenConnections(fingerprint);

  // BB MEDIUM-2 · global max-clients cap.
  if (sseClients.size >= MAX_CLIENTS) {
    return new Response('too-many-clients', { status: 503 });
  }

  const clientId = randomUUID();
  let heartbeatHandle: ReturnType<typeof setInterval>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Send initial comment so the client knows the stream is alive.
      controller.enqueue(encoder.encode(': hello\n\n'));
      heartbeatHandle = setInterval(() => {
        try {
          controller.enqueue(encoder.encode('event: ping\ndata: {}\n\n'));
        } catch {
          clearInterval(heartbeatHandle);
          sseClients.delete(clientId);
        }
      }, HEARTBEAT_MS);
      sseClients.set(clientId, {
        id: clientId,
        controller,
        token_match: fingerprint,
        heartbeat: heartbeatHandle,
      });
      startSseLoop();
    },
    cancel() {
      clearInterval(heartbeatHandle);
      sseClients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive',
    },
  });
}

const server = Bun.serve({
  hostname: HOSTNAME,
  port: PORT,
  async fetch(req): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    // AC-RT-001 · Host header allowlist (DNS-rebinding defense). Reject before
    // any auth check — the goal is to refuse cross-origin DNS-rebinding pages
    // that route to 127.0.0.1 with their own Host: header.
    if (AUTH_ENABLED && !hostAllowed(req)) {
      return new Response('forbidden-host', { status: 403 });
    }

    // sprint-5 r2 ISSUE-6 · belt-and-suspenders Origin check on all auth-gated
    // routes. SameSite=Strict already blocks cross-site cookies; this is a
    // perimeter check so cross-origin requests with a stolen header token also
    // can't reach the auth-gated surface.
    if (AUTH_ENABLED && !originAllowed(req)) {
      return new Response('forbidden-origin', { status: 403 });
    }

    // Cookie bootstrap · Phase 6 SKP-002. Caller provides X-Loa-Dash-Token
    // header; we verify timing-safe and set the HttpOnly cookie. Subsequent
    // browser requests carry the cookie automatically.
    if (path === '/api/auth' && req.method === 'POST') {
      const headerToken = req.headers.get('x-loa-dash-token');
      if (!headerToken || !constantTimeTokenMatch(headerToken)) {
        return new Response('invalid-token', { status: 403 });
      }
      return new Response('{"ok":true}', {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': setCookieHeader(),
        },
      });
    }

    // All other endpoints require auth (when AUTH_ENABLED).
    if (AUTH_ENABLED && !authenticated(req)) {
      return bootstrapHelpResponse();
    }

    if (path === '/' && req.method === 'GET') {
      return new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (path === '/api/llm-trace' && req.method === 'GET') return jsonResponse(readLlmTrace());
    if (path === '/api/voice-memory' && req.method === 'GET') return jsonResponse(readVoiceMemory());
    if (path === '/api/rejections' && req.method === 'GET') return jsonResponse(readRejections());
    if (path === '/api/baselines' && req.method === 'GET') return jsonResponse(readBaselines());
    if (path === '/api/violations' && req.method === 'GET') return jsonResponse(readViolations());
    if (path === '/sse' && req.method === 'GET') return handleSse(req);

    return new Response('not found', { status: 404 });
  },
});

// ──────────────────────────────────────────────────────────────────────
// Startup banner · token to stderr (AC-RT-001 operator-bootstrap path)
// ──────────────────────────────────────────────────────────────────────

console.log(`[dashboard] running at http://${HOSTNAME}:${server.port}`);
if (AUTH_ENABLED) {
  console.error(`[dashboard] LOA_DASH_TOKEN=${LOA_DASH_TOKEN}`);
  console.error(`[dashboard] bootstrap cookie: curl -i -X POST -H 'X-Loa-Dash-Token: ${LOA_DASH_TOKEN}' http://localhost:${PORT}/api/auth`);
}
if (SSE_ENABLED) {
  console.log(`[dashboard] SSE enabled · max-clients=${MAX_CLIENTS} · heartbeat=${HEARTBEAT_MS}ms · truncate=${PAYLOAD_TRUNCATE_AT}ch`);
}
console.log(`[dashboard] trace files: ${allTraceFilePaths().length} discovered`);
