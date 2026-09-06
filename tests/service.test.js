import test from "node:test";
import assert from "node:assert/strict";

import { MemoryStore } from "../src/relay/memory-store.js";
import { RelayService } from "../src/relay/service.js";

const sender = { teamId: "alpha", memberId: "min", role: "member", displayName: "민" };
const lead = { teamId: "alpha", memberId: "ji", role: "lead", displayName: "지" };
const event = {
  event_id: "239ed65f-b8a5-4a94-8095-18e6d2f24b55",
  intent: "decision_handoff",
  task_title: "통신 모듈 선택",
  summary: "시연용 Wi-Fi를 제품형 LTE + LoRa로 넓힐지 결정이 필요합니다.",
  options: ["Wi-Fi", "LTE + LoRa"],
  impact: "PCB 비용과 일정",
  sensitivity: "internal",
  held_action: "통신 모듈 발주"
};

function relay() {
  return new RelayService(new MemoryStore());
}

test("같은 멤버의 같은 event_id 재시도는 같은 저장 이벤트를 반환한다", async () => {
  const service = relay();
  const first = await service.raise(sender, event);
  const retry = await service.raise(sender, event);

  assert.equal(first.id, retry.id);
  assert.equal(retry.duplicate, true);
});

test("팀원은 본인이 보낸 이벤트만 ledger에서 읽는다", async () => {
  const service = relay();
  await service.raise(sender, event);
  await service.raise({ ...sender, memberId: "seo" }, { ...event, event_id: "e1b777e4-00b3-4c9e-9685-dfddf1b6c8d0" });

  const sent = await service.readSent(sender);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].sender_member_id, "min");
});

test("lead의 new inbox는 반환 후 delivered로 바꾸고 open은 읽기 전용이다", async () => {
  const service = relay();
  await service.raise(sender, event);

  const first = await service.readInbox(lead, "new");
  assert.equal(first.length, 1);
  assert.equal(first[0].delivery_status, "pending");
  assert.equal((await service.readInbox(lead, "new")).length, 0);
  assert.equal((await service.readInbox(lead, "open"))[0].delivery_status, "delivered");
});

test("member는 팀 inbox를 읽을 수 없다", async () => {
  await assert.rejects(() => relay().readInbox(sender, "open"), /lead만/);
});
