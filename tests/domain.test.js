import test from "node:test";
import assert from "node:assert/strict";

import { validateRecordDraft, validateTaskDraft } from "../src/domain/task.js";

const task = {
  title: "통신 구조 비교",
  goal: "시연과 제품화에 맞는 통신 구조를 추천한다.",
  context: "팀이 제품형 통신 가능성까지 함께 검토하기로 합의했다.",
  completion_criteria: "비용·거리·전력 비교와 추천안을 남긴다."
};

test("Task 초안은 제목·목표·맥락·완료 기준만 저장한다", () => {
  assert.deepEqual(validateTaskDraft(task), task);
});

test("Task 초안은 완료 기준 없이는 만들 수 없다", () => {
  const { completion_criteria: _completionCriteria, ...withoutCriteria } = task;
  assert.throws(() => validateTaskDraft(withoutCriteria), /completion_criteria/);
});

test("Task 초안은 원문 대화처럼 허용되지 않은 필드를 거부한다", () => {
  assert.throws(() => validateTaskDraft({ ...task, transcript: "개인 대화" }), /허용되지 않는 필드/);
});

test("결정 요청 기록에는 수신자와 영향이 필요하다", () => {
  const record = {
    kind: "decision_request",
    summary: "Wi-Fi 전용과 LTE·LoRa 포함 구조 중 결정을 요청합니다.",
    target_member_id: "lead",
    impact: "제작비와 제품 방향이 달라집니다.",
    options: ["Wi-Fi 전용", "LTE·LoRa 포함"]
  };
  assert.deepEqual(validateRecordDraft(record), record);
  assert.throws(() => validateRecordDraft({ ...record, impact: undefined }), /impact/);
});

test("이관 요청 기록에는 넘긴 일과 요청할 일이 필요하다", () => {
  const record = {
    kind: "transfer_request",
    summary: "PCB 설계 작업을 이관 요청합니다.",
    target_member_id: "min",
    completed_work: "통신 후보와 BOM 초안 비교를 마쳤습니다.",
    requested_work: "회로도와 PCB 레이아웃을 작성해 주세요."
  };
  assert.deepEqual(validateRecordDraft(record), record);
  assert.throws(() => validateRecordDraft({ ...record, completed_work: undefined }), /completed_work/);
});

test("진행 업데이트는 현재와 다음 진행을 함께 남긴다", () => {
  const record = {
    kind: "progress_update",
    current_context: "LoRa 모듈 세 종의 전력 비교를 마쳤습니다.",
    next_step: "추천 모듈 기준으로 PCB 크기를 추산합니다."
  };
  assert.deepEqual(validateRecordDraft(record), record);
  assert.throws(() => validateRecordDraft({ ...record, next_step: undefined }), /next_step/);
});
