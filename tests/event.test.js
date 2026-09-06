import test from "node:test";
import assert from "node:assert/strict";

import { validateEventInput } from "../src/relay/event.js";

const valid = {
  event_id: "b51210f9-f0b8-4475-bf5e-8b290ebce18d",
  intent: "review_request",
  task_title: "통신 아키텍처 검토",
  summary: "LTE와 LoRa를 포함한 제품형 통신안을 검토해 주세요.",
  options: ["Wi-Fi 데모안", "LTE + LoRa 제품안"],
  impact: "비용 증가 가능, 제품 확장성 개선",
  evidence_link: "https://github.com/victor0225/Aligner/issues/1",
  sensitivity: "internal",
  continuing_work: "PCB 외 요구사항 정리는 계속합니다."
};

test("유효한 review request는 저장 가능한 정규화 이벤트가 된다", () => {
  assert.deepEqual(validateEventInput(valid), valid);
});

test("decision handoff는 held_action 없이는 거부한다", () => {
  assert.throws(
    () => validateEventInput({ ...valid, intent: "decision_handoff" }),
    /held_action/
  );
});

test("원문 대화나 코드로 보이는 금지 필드는 거부한다", () => {
  assert.throws(
    () => validateEventInput({ ...valid, transcript: "private chat" }),
    /허용되지 않는 필드/
  );
});

test("요약은 300자를 넘길 수 없다", () => {
  assert.throws(
    () => validateEventInput({ ...valid, summary: "가".repeat(301) }),
    /summary/
  );
});

test("event_id는 재시도 안전성을 위해 UUID여야 한다", () => {
  assert.throws(() => validateEventInput({ ...valid, event_id: "retry-1" }), /UUID/);
});
