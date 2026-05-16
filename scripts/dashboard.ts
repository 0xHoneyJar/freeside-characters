#!/usr/bin/env bun
// cycle-006 follow-up · substrate-native local trace dashboard.
//
// Reads:
//   - .run/llm-trace.jsonl                 (LLM call: prompt + response + tokens)
//   - .run/voice-memory/<stream>/*.jsonl   (cross-week voice memory entries)
//   - .run/score-snapshot-rejections.jsonl (RT-008 plausibility rejections)
//   - .run/voice-memory-deletions.jsonl    (SKP-004 forget-user audit)
//   - .run/score-baselines/<zone>.jsonl    (rolling-window baseline state)
//
// Serves:
//   GET  /                  → single-page HTML viewer
//   GET  /api/llm-trace     → array of LlmTraceEntry, newest first
//   GET  /api/voice-memory  → grouped by stream/key, newest entries
//   GET  /api/rejections    → score-snapshot rejection log
//   GET  /api/baselines     → per-zone baseline snapshot count
//   GET  /sse               → server-sent events stream of new rows
//
// Usage:
//   bun run scripts/dashboard.ts
//   → http://localhost:3001
//
// Override port: DASHBOARD_PORT=4000 bun run scripts/dashboard.ts

import { readFileSync, existsSync, readdirSync, statSync, watch } from 'node:fs';
import { resolve } from 'node:path';

const PORT = Number(process.env.DASHBOARD_PORT ?? 3001);
// digest:once runs from apps/bot cwd so writes land there; local dev tests
// sometimes write to project-root .run/. Search both; prefer whichever has
// the file. Override the base dir explicitly via DASHBOARD_RUN_DIR.
const CANDIDATE_RUN_DIRS = process.env.DASHBOARD_RUN_DIR
  ? [resolve(process.env.DASHBOARD_RUN_DIR)]
  : [resolve('apps/bot/.run'), resolve('.run')];

function resolveExistingPath(...segments: string[]): string {
  for (const base of CANDIDATE_RUN_DIRS) {
    const p = resolve(base, ...segments);
    if (existsSync(p)) return p;
  }
  // No file found — return the first candidate so caller can short-circuit.
  return resolve(CANDIDATE_RUN_DIRS[0]!, ...segments);
}

function llmTracePath(): string {
  return resolveExistingPath('llm-trace.jsonl');
}
function voiceMemoryDir(): string {
  return resolveExistingPath('voice-memory');
}
function rejectionsPath(): string {
  return resolveExistingPath('score-snapshot-rejections.jsonl');
}
function deletionsPath(): string {
  return resolveExistingPath('voice-memory-deletions.jsonl');
}
function baselinesDir(): string {
  return resolveExistingPath('score-baselines');
}

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
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  try {
    const text = readFileSync(path, 'utf-8');
    return text
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .flatMap((l) => {
        try {
          return [JSON.parse(l) as T];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function readLlmTrace(): LlmTraceEntry[] {
  return readJsonl<LlmTraceEntry>(llmTracePath()).reverse();
}

function readVoiceMemory(): Record<string, Array<{ key: string; entry: unknown }>> {
  const dir = voiceMemoryDir();
  if (!existsSync(dir)) return {};
  const grouped: Record<string, Array<{ key: string; entry: unknown }>> = {};
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

function readRejections(): unknown[] {
  return readJsonl<unknown>(rejectionsPath()).reverse();
}

function readDeletions(): unknown[] {
  return readJsonl<unknown>(deletionsPath()).reverse();
}

function readBaselines(): Array<{ zone: string; snapshot_count: number }> {
  const dir = baselinesDir();
  if (!existsSync(dir)) return [];
  const out: Array<{ zone: string; snapshot_count: number }> = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.jsonl')) continue;
    const zone = file.replace(/\.jsonl$/, '');
    const entries = readJsonl<unknown>(resolve(dir, file));
    out.push({ zone, snapshot_count: entries.length });
  }
  return out;
}

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
  @keyframes pulse { 50% { opacity: .4; } }
  aside { border-right: 1px solid var(--border); overflow-y: auto; background: var(--bg-elev); }
  .run { padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; }
  .run:hover { background: var(--bg-hover); }
  .run.active { background: var(--bg-hover); border-left: 3px solid var(--accent); padding-left: 13px; }
  .run-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
  .run-zone { font-size: 13px; color: var(--text); font-weight: 500; }
  .run-time { font-size: 11px; color: var(--text-dim); font-family: var(--mono); }
  .run-meta { font-size: 11px; color: var(--text-dim); font-family: var(--mono); }
  .run.error .run-zone::after { content: ' ⚠'; color: var(--error); }
  main { overflow-y: auto; padding: 24px 32px; }
  main h2 { margin: 0 0 16px; font-size: 14px; color: var(--text-dim); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
  .empty { color: var(--text-dim); text-align: center; padding: 80px 20px; font-style: italic; }
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
    <div class="tab" data-view="baselines">baselines</div>
  </div>
  <div class="status"><span class="dot"></span><span id="conn">connected</span> · <span id="count">0</span> rows</div>
</header>
<aside id="list"></aside>
<main id="detail">
  <div class="empty">select a row on the left</div>
</main>
<script>
let currentView = 'trace';
let currentIdx = null;
let cache = { trace: [], memory: {}, rejections: [], baselines: [] };

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

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderTraceList() {
  const list = document.getElementById('list');
  const rows = cache.trace;
  document.getElementById('count').textContent = rows.length;
  if (!rows.length) { list.innerHTML = '<div class="empty">no llm calls yet</div>'; return; }
  list.innerHTML = rows.map((r, i) => \`
    <div class="run \${r.error ? 'error' : ''} \${i === currentIdx ? 'active' : ''}" data-idx="\${i}">
      <div class="run-head"><span class="run-zone">\${escape(r.zone || '—')} / \${escape(r.post_type || '—')}</span><span class="run-time">\${fmtTime(r.at)}</span></div>
      <div class="run-meta">\${escape(r.model_id?.split('.').slice(-1)[0] || '?')} · \${fmtDuration(r.duration_ms)} · \${r.input_tokens || 0}↓ \${r.output_tokens || 0}↑</div>
    </div>
  \`).join('');
  list.querySelectorAll('.run').forEach((el) => {
    el.addEventListener('click', () => { currentIdx = Number(el.dataset.idx); renderTraceList(); renderTraceDetail(); });
  });
}

function renderTraceDetail() {
  const detail = document.getElementById('detail');
  if (currentIdx == null) { detail.innerHTML = '<div class="empty">select a row on the left</div>'; return; }
  const r = cache.trace[currentIdx];
  if (!r) { detail.innerHTML = '<div class="empty">row gone</div>'; return; }
  detail.innerHTML = \`
    <div class="panel">
      <div class="kv">
        <span class="k">when</span><span class="v">\${escape(r.at)}</span>
        <span class="k">zone</span><span class="v"><span class="badge zone">\${escape(r.zone || '—')}</span> / \${escape(r.post_type || '—')}</span>
        <span class="k">model</span><span class="v">\${escape(r.model_id)}</span>
        <span class="k">region</span><span class="v">\${escape(r.region)}</span>
        <span class="k">path</span><span class="v"><span class="badge">\${escape(r.path)}</span></span>
        <span class="k">duration</span><span class="v">\${fmtDuration(r.duration_ms)}</span>
        <span class="k">tokens</span><span class="v">\${r.input_tokens || 0} in / \${r.output_tokens || 0} out / \${r.total_tokens || 0} total</span>
        <span class="k">character</span><span class="v">\${escape(r.character_id || '—')}</span>
        \${r.error ? \`<span class="k">error</span><span class="v"><span class="badge error">\${escape(r.error)}</span></span>\` : ''}
      </div>
    </div>
    <h2>System prompt</h2>
    <div class="panel"><pre>\${escape(r.system_prompt)}</pre></div>
    <h2>User message</h2>
    <div class="panel"><pre>\${escape(r.user_message)}</pre></div>
    <h2>Assistant output</h2>
    <div class="panel"><pre>\${escape(r.output)}</pre></div>
  \`;
}

function renderMemory() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  list.innerHTML = '';
  document.getElementById('count').textContent = Object.values(cache.memory).reduce((a, b) => a + b.length, 0);
  const streams = Object.keys(cache.memory).sort();
  if (!streams.length) { detail.innerHTML = '<div class="empty">no voice memory entries yet</div>'; return; }
  detail.innerHTML = streams.map((s) => {
    const entries = cache.memory[s] || [];
    return \`<h2>\${escape(s)} <span class="badge">\${entries.length}</span></h2>\` + entries.map((e) => \`
      <details>
        <summary>\${escape(e.key)} · \${escape(e.entry.at || '?')}</summary>
        <pre>\${escape(JSON.stringify(e.entry, null, 2))}</pre>
      </details>
    \`).join('');
  }).join('');
}

function renderRejections() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  list.innerHTML = '';
  document.getElementById('count').textContent = cache.rejections.length;
  if (!cache.rejections.length) { detail.innerHTML = '<div class="empty">no score-snapshot rejections</div>'; return; }
  detail.innerHTML = cache.rejections.map((r) => \`
    <div class="panel">
      <div class="kv">
        <span class="k">zone</span><span class="v"><span class="badge zone">\${escape(r.zone)}</span></span>
        <span class="k">when</span><span class="v">\${escape(r.rejected_at)}</span>
        <span class="k">reason</span><span class="v"><span class="badge error">\${escape(r.reason)}</span></span>
        <span class="k">sigma</span><span class="v">\${r.computed_sigma ?? '—'} (threshold \${r.threshold ?? '—'})</span>
        <span class="k">baseline</span><span class="v">\${r.baseline_sample_count} samples</span>
        <span class="k">events</span><span class="v">\${r.snapshot_total_events}</span>
      </div>
    </div>
  \`).join('');
}

function renderBaselines() {
  const detail = document.getElementById('detail');
  const list = document.getElementById('list');
  list.innerHTML = '';
  document.getElementById('count').textContent = cache.baselines.length;
  if (!cache.baselines.length) { detail.innerHTML = '<div class="empty">no baselines collected yet</div>'; return; }
  detail.innerHTML = \`<div class="panel"><div class="kv">\` + cache.baselines.map((b) => \`<span class="k">\${escape(b.zone)}</span><span class="v">\${b.snapshot_count} accepted snapshots</span>\`).join('') + \`</div></div>\`;
}

function render() {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === currentView));
  if (currentView === 'trace') { renderTraceList(); renderTraceDetail(); }
  else if (currentView === 'memory') renderMemory();
  else if (currentView === 'rejections') renderRejections();
  else if (currentView === 'baselines') renderBaselines();
}

async function refresh() {
  try {
    const [trace, memory, rejections, baselines] = await Promise.all([
      fetch('/api/llm-trace').then((r) => r.json()),
      fetch('/api/voice-memory').then((r) => r.json()),
      fetch('/api/rejections').then((r) => r.json()),
      fetch('/api/baselines').then((r) => r.json()),
    ]);
    cache = { trace, memory, rejections, baselines };
    render();
  } catch (err) {
    document.getElementById('conn').textContent = 'reconnecting…';
  }
}

document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => { currentView = t.dataset.view; currentIdx = null; render(); }));

refresh();
// Poll every 2s for live-ish updates (cheap · all reads are local fs).
setInterval(refresh, 2000);
</script>
</body>
</html>
`;

const server = Bun.serve({
  port: PORT,
  routes: {
    '/': () => new Response(HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    '/api/llm-trace': () => Response.json(readLlmTrace()),
    '/api/voice-memory': () => Response.json(readVoiceMemory()),
    '/api/rejections': () => Response.json(readRejections()),
    '/api/baselines': () => Response.json(readBaselines()),
  },
  fetch(): Response {
    return new Response('not found', { status: 404 });
  },
});

console.log(`[dashboard] running at http://localhost:${server.port}`);
console.log(`[dashboard] candidate run dirs: ${CANDIDATE_RUN_DIRS.join(' · ')}`);
console.log(`[dashboard] active llm-trace: ${llmTracePath()}`);
console.log(`[dashboard] active voice-memory: ${voiceMemoryDir()}`);
