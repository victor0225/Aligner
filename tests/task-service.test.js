import test from "node:test";
import assert from "node:assert/strict";

import { MemoryStore } from "../src/relay/memory-store.js";
import { TaskService } from "../src/task-service.js";

const min = { teamId: "alpha", memberId: "min", role: "member", displayName: "민성" };
const joe = { teamId: "alpha", memberId: "joe", role: "member", displayName: "조은" };
const lead = { teamId: "alpha", memberId: "lead", role: "lead", displayName: "수현" };

const taskDraft = {
  title: "통신 구조 비교",
  goal: "제품화에 맞는 통신 구조를 추천한다.",
  context: "시연 환경과 제품 환경의 차이를 함께 검토한다.",
  completion_criteria: "비용·거리·전력 비교와 추천안을 남긴다."
};

function service() {
  const store = new MemoryStore();
  store.addActor("min-token", min);
  store.addActor("joe-token", joe);
  store.addActor("lead-token", lead);
  return new TaskService(store);
}

test("결정 요청은 원래 담당자 열에 남고 팀장 개인 보드에 나타난다", async () => {
  const relay = service();
  const task = await relay.createTask(min, taskDraft);
  await relay.addRecord(min, task.id, {
    kind: "decision_request",
    summary: "Wi-Fi 전용과 LTE·LoRa 포함 구조 중 결정을 요청합니다.",
    target_member_id: lead.memberId,
    impact: "제작비와 제품 방향이 달라집니다.",
    options: ["Wi-Fi 전용", "LTE·LoRa 포함"]
  });

  const board = await relay.getBoard(lead);
  const minColumn = board.columns.find((column) => column.member.id === min.memberId);
  assert.equal(minColumn.tasks[0].id, task.id);
  assert.equal(minColumn.tasks[0].primary_status, "decision");
  assert.equal((await relay.getDesk(lead)).decisions.length, 1);
});

test("팀장의 결정 기록은 Task를 회색 진행 상태로 돌리고 담당자에게 확인 항목을 만든다", async () => {
  const relay = service();
  const task = await relay.createTask(min, taskDraft);
  await relay.addRecord(min, task.id, {
    kind: "decision_request",
    summary: "통신 방향을 결정해 주세요.",
    target_member_id: lead.memberId,
    impact: "PCB 제작 범위가 달라집니다."
  });
  await relay.addRecord(lead, task.id, { kind: "decision_record", summary: "LTE·LoRa 포함 PCB로 진행합니다." });

  const detail = await relay.getTaskDetail(min, task.id);
  assert.equal(detail.task.primary_status, "neutral");
  assert.equal((await relay.getDesk(min)).notices.length, 1);
});

test("이관은 대상자가 수락할 때만 새 담당자 열로 이동한다", async () => {
  const relay = service();
  const task = await relay.createTask(joe, taskDraft);
  const request = await relay.addRecord(joe, task.id, {
    kind: "transfer_request",
    summary: "PCB 레이아웃 작업 이관을 요청합니다.",
    target_member_id: min.memberId,
    completed_work: "부품 후보 비교를 마쳤습니다.",
    requested_work: "회로도와 PCB 레이아웃을 작성해 주세요."
  });

  assert.equal((await relay.getTaskDetail(joe, task.id)).task.owner_member_id, joe.memberId);
  await relay.acceptTransfer(min, request.id);
  const detail = await relay.getTaskDetail(min, task.id);
  assert.equal(detail.task.owner_member_id, min.memberId);
  assert.equal(detail.assignments.length, 2);
  assert.ok(detail.assignments[0].ended_at);
});

test("이관 거절은 원래 담당자를 유지하고 요청자에게 확인 항목을 만든다", async () => {
  const relay = service();
  const task = await relay.createTask(joe, taskDraft);
  const request = await relay.addRecord(joe, task.id, {
    kind: "transfer_request",
    summary: "PCB 레이아웃 작업 이관을 요청합니다.",
    target_member_id: min.memberId,
    completed_work: "부품 후보 비교를 마쳤습니다.",
    requested_work: "회로도와 PCB 레이아웃을 작성해 주세요."
  });

  await relay.declineTransfer(min, request.id, "이번 주에는 다른 Task를 진행 중입니다.");
  assert.equal((await relay.getTaskDetail(joe, task.id)).task.owner_member_id, joe.memberId);
  assert.equal((await relay.getDesk(joe)).notices.length, 1);
});

test("완료된 Task는 활성 보드에서 사라지고 로드맵에는 남는다", async () => {
  const relay = service();
  const task = await relay.createTask(min, taskDraft);
  await relay.completeTask(min, task.id, { result: "통신 구조 추천안을 완료했습니다." });

  const board = await relay.getBoard(lead);
  assert.equal(board.columns.flatMap((column) => column.tasks).length, 0);
  assert.equal((await relay.getDesk(lead)).roadmap.length, 1);
});

test("Task Draft는 웹 확정 전까지 주도권 보드에 나타나지 않는다", async () => {
  const relay = service();
  const draft = await relay.createDraft(min, "task", taskDraft);

  assert.equal(draft.kind, "task");
  assert.equal(draft.owner_member_id, min.memberId);
  assert.equal((await relay.getBoard(lead)).columns.flatMap((column) => column.tasks).length, 0);
  assert.deepEqual((await relay.getDraft(min, draft.id)).payload, taskDraft);
});
