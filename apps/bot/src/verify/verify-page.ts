// verify-page.ts — minimal verify web pages (cycle-009 · sprint-3 · C4).
//
// No bundler, no wagmi/Dynamic dep for v1 — a lightweight EIP-1193 (window.ethereum) connect +
// personal_sign is enough to prove wallet control. (A richer wagmi/WalletConnect surface is a
// v1.1 enhancement.) NO secret ever reaches the client bundle (RT-8): only the public SIWE
// params + the handoff token are embedded.
//
// LOAD-BEARING: buildClientMessage() below MUST byte-match persona-engine buildSiweMessage().
// If it drifts, recovery mismatches server-side → a visible "verification failed" (safe-fail),
// not a security hole — but keep them in sync (siwe.test.ts pins the golden format).

const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'text/html; charset=utf-8',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'cache-control': 'no-store',
};

export function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: SECURITY_HEADERS });
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function errorPage(message: string, status = 400): Response {
  return htmlResponse(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>verify</title></head>` +
      `<body style="font-family:system-ui;background:#0d0d10;color:#e8e8ea;display:grid;place-items:center;height:100vh;margin:0">` +
      `<div style="max-width:32rem;padding:2rem;text-align:center"><h1 style="font-weight:600">verify</h1><p style="color:#a0a0a8">${esc(message)}</p></div></body></html>`,
    status,
  );
}

export interface ConnectPageParams {
  token: string;
  domain: string;
  address_statement: string;
  uri: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
  username: string;
}

/** The wallet-connect + sign page. Embeds public SIWE params only (no secret · RT-8). */
export function connectPage(p: ConnectPageParams): Response {
  const cfg = JSON.stringify({
    token: p.token,
    domain: p.domain,
    statement: p.address_statement,
    uri: p.uri,
    chainId: p.chainId,
    nonce: p.nonce,
    issuedAt: p.issuedAt,
    expirationTime: p.expirationTime,
  });
  return htmlResponse(`<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>verify your wallet</title></head>
<body style="font-family:system-ui;background:#0d0d10;color:#e8e8ea;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="max-width:32rem;padding:2rem;text-align:center">
  <h1 style="font-weight:600">verify your wallet</h1>
  <p style="color:#a0a0a8">signed in as <b>${esc(p.username)}</b>. connect your wallet and sign to link it.</p>
  <button id="go" style="font:inherit;background:#3ba55c;color:#fff;border:0;border-radius:.6rem;padding:.8rem 1.6rem;cursor:pointer">connect &amp; sign</button>
  <p id="status" style="color:#a0a0a8;margin-top:1rem"></p>
</div>
<script>
const CFG = ${cfg};
const $ = (id) => document.getElementById(id);
function buildClientMessage(address) {
  // MUST byte-match persona-engine buildSiweMessage().
  return CFG.domain + " wants you to sign in with your Ethereum account:\\n" +
    address + "\\n\\n" + CFG.statement + "\\n\\n" +
    "URI: " + CFG.uri + "\\n" + "Version: 1\\n" + "Chain ID: " + CFG.chainId + "\\n" +
    "Nonce: " + CFG.nonce + "\\n" + "Issued At: " + CFG.issuedAt + "\\n" +
    "Expiration Time: " + CFG.expirationTime;
}
$("go").onclick = async () => {
  try {
    if (!window.ethereum) { $("status").textContent = "no wallet detected. open in a wallet browser."; return; }
    $("status").textContent = "connecting...";
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    const address = accounts[0];
    const message = buildClientMessage(address);
    $("status").textContent = "sign the message in your wallet...";
    const signature = await window.ethereum.request({ method: "personal_sign", params: [message, address] });
    $("status").textContent = "verifying...";
    const res = await fetch(location.pathname + "/complete", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, signature, nonce: CFG.nonce }),
    });
    const out = await res.json().catch(() => ({}));
    $("status").textContent = res.ok ? "verified. you can close this and return to discord." : (out.error || "verification failed. try again from discord.");
    if (res.ok) $("go").style.display = "none";
  } catch (e) {
    $("status").textContent = "cancelled or failed. try again from discord.";
  }
};
</script></body></html>`);
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store' },
  });
}
