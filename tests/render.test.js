import test from "node:test";
import assert from "node:assert/strict";

import { renderDesk, renderOwnershipBoard, renderTaskDetail } from "../src/web/render.js";
import { renderDraft } from "../src/web/render.js";

const lead = { memberId: "lead", displayName: "수현", role: "lead" };
const board = {
  columns: [{
    member: { id: "min", display_name: "민성", role: "member" },
    tasks: [{ id: "task-1", title: "통신 구조 비교", goal: "제품 구조를 추천한다.", primary_status: "decision", is_in_progress: true, progress_summary: "후보 비교 중", next_step: "결정 요청" }]
  }]
};

test("주도권 보드는 중앙 열에 결정 상태와 현재 맥락을 표시하고 HTML을 이스케이프한다", () => {
  const html = renderOwnershipBoard(lead, board);
  assert.match(html, /주도권 보드/);
  assert.match(html, /status-decision/);
  assert.match(html, /결정 필요해요/);
  assert.match(html, /후보 비교 중/);
  assert.match(html, /board-shell/);
  assert.match(html, /담당자 선택/);
  assert.doesNotMatch(renderOwnershipBoard(lead, { columns: [{ member: board.columns[0].member, tasks: [{ ...board.columns[0].tasks[0], title: "<script>alert(1)<\/script>" }] }] }), /<script>alert/);
});

test("팀장 개인 보드는 결정·실행·검토·이관·로드맵 순서를 고정한다", () => {
  const html = renderDesk(lead, { decisions: [{}], execution: [{}], reviews: [{}], transfers: [{}], roadmap: [], notices: [] });
  assert.ok(html.indexOf("결정") < html.indexOf("실행"));
  assert.ok(html.indexOf("실행") < html.indexOf("검토"));
  assert.ok(html.indexOf("검토") < html.indexOf("팀 이관 요청"));
  assert.ok(html.indexOf("팀 이관 요청") < html.indexOf("팀 로드맵"));
});

test("Task 상세는 이관 전 담당 구간을 점선 로드맵 카드로 표시한다", () => {
  const html = renderTaskDetail(lead, {
    task: { ...board.columns[0].tasks[0], context: "제품 방향 확인", completion_criteria: "추천안 기록", owner_name: "민성", result: null },
    records: [],
    assignments: [{ member_name: "조은", started_at: "2026-09-07T00:00:00.000Z", ended_at: "2026-09-08T00:00:00.000Z" }]
  });
  assert.match(html, /roadmap-card historical/);
  assert.match(html, /제품 방향 확인/);
});

test("결정 요청 Draft는 웹에서 수신자·영향을 확인한 뒤 제출한다", () => {
  const html = renderDraft(lead, { id: "draft-1", kind: "decision_request", payload: {
    task_id: "task-1", target_member_id: "lead", summary: "통신 방향을 정해 주세요.", impact: "PCB 범위"
  } });
  assert.match(html, /결정 필요해요/);
  assert.match(html, /name=target_member_id/);
  assert.match(html, /name=impact/);
});
