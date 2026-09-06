import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "aligner_session";

export function createSession(actor, secret) {
  const payload = Buffer.from(JSON.stringify({ actor, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function readSession(cookieHeader, secret) {
  const value = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return session.exp > Date.now() ? session.actor : null;
  } catch {
    return null;
  }
}

export function sessionCookie(value) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
}

export function renderBoard(actor, events) {
  const title = actor.role === "lead" ? "팀의 열린 이벤트" : "내가 보낸 이벤트";
  const rows = events.length
    ? events.map((event) => `<article><p class="intent">${escape(event.intent)}</p><h2>${escape(event.task_title)}</h2><p>${escape(event.summary)}</p><dl><dt>영향</dt><dd>${escape(event.impact)}</dd><dt>상태</dt><dd>${escape(event.delivery_status)}</dd><dt>시각</dt><dd>${escape(event.created_at)}</dd>${event.held_action ? `<dt>보류한 행동</dt><dd>${escape(event.held_action)}</dd>` : ""}</dl></article>`).join("")
    : "<p>표시할 이벤트가 없습니다.</p>";
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aligner 신뢰 보드</title><style>body{max-width:720px;margin:40px auto;padding:0 18px;font:16px system-ui;color:#1b1b1b}article{border-top:1px solid #ddd;padding:16px 0}.intent{font-size:13px;color:#666;text-transform:uppercase}h1{margin-bottom:4px}h2{font-size:18px}dl{display:grid;grid-template-columns:100px 1fr;gap:6px;margin:14px 0 0}dt{color:#666}</style><h1>Aligner 신뢰 보드</h1><p>${escape(actor.displayName)} · ${escape(title)}</p><p>원문 대화·코드·터미널 출력은 저장하지 않습니다.</p>${rows}</html>`;
}

export function renderLogin() {
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><title>Aligner 신뢰 보드</title><body><h1>Aligner 신뢰 보드</h1><form method="post" action="/trust-board/session"><label>Member token <input name="token" type="password" required autofocus></label><button>열기</button></form><p>Token은 이 브라우저의 짧은 세션을 만드는 데만 사용됩니다.</p></body></html>`;
}

function sign(payload, secret) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
