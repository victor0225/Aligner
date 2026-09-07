const statusCopy = {
  review: "검토해주세요",
  idea: "아이디어 있어요",
  decision: "결정 필요해요",
  neutral: "진행 중"
};

export function renderOwnershipBoard(actor, board) {
  const columns = board.columns.map(({ member, tasks }) => `<section class="member-column"><h2>${escape(member.display_name)}</h2>${tasks.length ? tasks.map(taskCard).join("") : "<p class=empty>진행 중인 Task가 없습니다.</p>"}</section>`).join("");
  return page("주도권 보드", `<header><p class=eyebrow>Aligner · ${escape(actor.displayName)}</p><h1>주도권 보드</h1><nav><a href=/desk>내 작업대</a></nav></header><main class="board-shell">${columns}</main>`);
}

export function renderDesk(actor, desk) {
  const blocks = actor.role === "lead"
    ? [["결정", desk.decisions], ["실행", desk.execution], ["검토", desk.reviews], ["팀 이관 요청", desk.transfers], ["팀 로드맵", desk.roadmap]]
    : [["실행", desk.execution], ["검토", desk.reviews], ["팀 이관 요청", desk.transfers], ["팀 로드맵", desk.roadmap]];
  return page("내 작업대", `<header><p class=eyebrow>Aligner · ${escape(actor.displayName)}</p><h1>내 작업대</h1><nav><a href=/board>주도권 보드</a></nav></header><main class=desk>${blocks.map(([title, items]) => deskSection(title, items)).join("")}</main>`);
}

export function renderTaskDetail(actor, detail) {
  const { task, records, assignments } = detail;
  const recordRows = records.length ? records.map((record) => `<li><strong>${escape(recordLabel(record.kind))}</strong><p>${escape(record.summary || record.result || record.current_context || "")}</p><time>${escape(record.created_at)}</time></li>`).join("") : "<li>아직 기록이 없습니다.</li>";
  const roadmap = assignments.map((assignment) => `<article class="roadmap-card${assignment.ended_at ? " historical" : ""}"><strong>${escape(assignment.member_name)}</strong><p>${escape(assignment.started_at)}</p>${assignment.ended_at ? `<p>이관: ${escape(assignment.ended_at)}</p>` : "<p>현재 담당</p>"}</article>`).join("");
  return page(task.title, `<header><p class=eyebrow>Aligner · ${escape(actor.displayName)}</p><h1>${escape(task.title)}</h1><p>${escape(task.goal || "")}</p><nav><a href=/board>주도권 보드</a><a href=/desk>내 작업대</a></nav></header><main class=detail><section><h2>왜 하는 일인가</h2><p>${escape(task.context)}</p><h2>완료 기준</h2><p>${escape(task.completion_criteria)}</p><h2>현재 진행</h2><p>${escape(task.progress_summary || "아직 진행 업데이트가 없습니다.")}</p><p class=muted>다음: ${escape(task.next_step || "정해진 다음 진행이 없습니다.")}</p></section><section><h2>판단 기록</h2><ol class=timeline>${recordRows}</ol></section><section><h2>이관 기록</h2><div class=roadmap>${roadmap || "<p class=empty>이관 기록이 없습니다.</p>"}</div></section></main>`);
}

export function renderDraft(actor, draft) {
  const payload = draft.payload;
  if (draft.kind !== "task") return renderRecordDraft(actor, draft, payload);
  return page("Task 생성", `<header><p class=eyebrow>Aligner · ${escape(actor.displayName)}</p><h1>Task 생성</h1><p>웹에서 확인한 뒤에만 팀 보드에 공유됩니다.</p></header><main class=form-shell><form method=post action="/drafts/${encodeURIComponent(draft.id)}/submit"><label>제목<input name=title required maxlength=160 value="${attribute(payload.title)}"></label><label>한 줄 목표<input name=goal required maxlength=200 value="${attribute(payload.goal)}"></label><label>왜 하는 일인가<textarea name=context required maxlength=500>${escape(payload.context)}</textarea></label><label>완료 기준<textarea name=completion_criteria required maxlength=300>${escape(payload.completion_criteria)}</textarea></label><button type=submit>생성</button></form></main>`);
}

function renderRecordDraft(actor, draft, payload) {
  const title = { decision_request: "결정 필요해요", transfer_request: "Task 이관", completion: "Task 완료" }[draft.kind] || "기록";
  const common = `<input type=hidden name=task_id value="${attribute(payload.task_id)}">`;
  let fields = "";
  if (draft.kind === "decision_request") fields = `<label>요청 요약<textarea name=summary required maxlength=300>${escape(payload.summary)}</textarea></label><label>결정할 사람 ID<input name=target_member_id required maxlength=100 value="${attribute(payload.target_member_id)}"></label><label>영향<textarea name=impact required maxlength=300>${escape(payload.impact)}</textarea></label>`;
  if (draft.kind === "transfer_request") fields = `<label>요청 요약<textarea name=summary required maxlength=300>${escape(payload.summary)}</textarea></label><label>받을 사람 ID<input name=target_member_id required maxlength=100 value="${attribute(payload.target_member_id)}"></label><label>여기까지 한 일<textarea name=completed_work required maxlength=300>${escape(payload.completed_work)}</textarea></label><label>요청할 일<textarea name=requested_work required maxlength=300>${escape(payload.requested_work)}</textarea></label>`;
  if (draft.kind === "completion") fields = `<label>최종 결과<textarea name=result required maxlength=300>${escape(payload.result)}</textarea></label><label>근거 링크 (선택)<input name=evidence_link type=url value="${attribute(payload.evidence_link)}"></label>`;
  return page(title, `<header><p class=eyebrow>Aligner · ${escape(actor.displayName)}</p><h1>${escape(title)}</h1><p>웹에서 다시 확인한 뒤에만 공유됩니다.</p></header><main class=form-shell><form method=post action="/drafts/${encodeURIComponent(draft.id)}/submit">${common}${fields}<button type=submit>확인하고 공유</button></form></main>`);
}

export function renderLogin() {
  return page("Aligner", `<main class=form-shell><h1>Aligner</h1><form method=post action=/session><label>Member token<input name=token type=password required autofocus></label><button type=submit>열기</button></form><p class=muted>token은 이 브라우저의 짧은 세션을 만드는 데만 사용됩니다.</p></main>`);
}

function taskCard(task) {
  const status = task.primary_status || "neutral";
  return `<article class="task-card status-${escape(status)}"><a href="/tasks/${encodeURIComponent(task.id)}"><span class=status>${escape(statusCopy[status])}</span><h3>${escape(task.title)}</h3><p>${escape(task.goal)}</p>${task.is_in_progress ? "<small>진행 중</small>" : ""}${task.progress_summary ? `<p class=context>${escape(task.progress_summary)}</p>` : ""}</a></article>`;
}

function deskSection(title, items) {
  return `<section class=desk-section><h2>${escape(title)} <span class=count>${items.length}</span></h2>${items.length ? `<ul>${items.map((item) => `<li>${escape(item.title || item.summary || item.result || "확인할 항목")}</li>`).join("")}</ul>` : "<p class=empty>없음</p>"}</section>`;
}

function recordLabel(kind) {
  return ({ idea_share: "아이디어 있어요", review_request: "검토해주세요", review_result: "검토 결과", decision_request: "결정 필요해요", decision_record: "결정 기록", transfer_request: "이관 요청", transfer_accepted: "이관 수락", transfer_declined: "이관 거절", progress_update: "진행 업데이트", completion: "완료" })[kind] || kind;
}

function page(title, body) {
  return `<!doctype html><html lang=ko><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${escape(title)} · Aligner</title><style>body{margin:0;background:#ececec;color:#202124;font:15px system-ui,sans-serif}header,main{max-width:1120px;margin:auto;padding:24px}header{padding-top:42px}h1{margin:4px 0 8px;font-size:32px}h2{font-size:18px}h3{margin:10px 0 6px}.eyebrow,.muted,.empty,time{color:#70757a}.board-shell{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;align-items:start}.member-column,.desk-section,.detail>section,.form-shell{background:#fff;border:1px solid #d9d9d9;border-radius:12px;padding:16px}.task-card{margin:12px 0;border:1px solid #d6d6d6;border-radius:9px;background:#f8f8f8}.task-card a{display:block;padding:13px;color:inherit;text-decoration:none}.status{display:inline-block;padding:3px 7px;border-radius:999px;font-size:12px}.status-review .status{background:#fff3bf}.status-idea .status{background:#d9f7d6}.status-decision .status{background:#ffd9d9;color:#9d1c1c}.status-neutral .status{background:#e5e5e5}.context{font-size:13px;color:#555}.desk{display:grid;gap:14px}.desk-section{padding:14px}.count{font-size:13px;background:#333;color:#fff;border-radius:99px;padding:2px 7px}.detail{display:grid;gap:16px}.timeline{padding-left:20px}.roadmap{display:flex;gap:10px;overflow-x:auto}.roadmap-card{min-width:130px;border:1px solid #999;padding:10px;border-radius:8px}.roadmap-card.historical{border-style:dashed}form{display:grid;gap:14px}label{display:grid;gap:5px;font-weight:600}input,textarea,button{font:inherit;padding:9px;border:1px solid #aaa;border-radius:7px}textarea{min-height:90px}button{background:#242424;color:#fff;cursor:pointer}nav{display:flex;gap:12px}nav a{color:#444}@media(max-width:600px){header,main{padding:18px}h1{font-size:28px}}</style>${body}</html>`;
}

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function attribute(value) {
  return escape(value).replace(/`/g, "&#96;");
}
