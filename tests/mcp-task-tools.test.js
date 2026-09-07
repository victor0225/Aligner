import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/server.js";
import { MemoryStore } from "../src/relay/memory-store.js";
import { TaskService } from "../src/task-service.js";

test("Codex의 create_task_draft는 웹 확인 전에는 Task를 공유 보드에 만들지 않는다", async () => {
  const store = new MemoryStore();
  const member = { teamId: "alpha", memberId: "min", role: "member", displayName: "민성" };
  store.addActor("member-token", member);
  const taskService = new TaskService(store);
  const server = createApp({ taskService, store, sessionSecret: "test-secret" }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await rpc(url, "member-token", 1, "create_task_draft", {
      title: "제품형 통신 구조",
      goal: "제품 환경에 맞는 통신 방향을 정한다.",
      context: "회의에서 통신 범위를 비교하기로 합의했다.",
      completion_criteria: "추천안과 근거를 남긴다."
    });
    const body = JSON.stringify(await response.json());
    assert.equal(response.status, 200);
    assert.match(body, /review_url/);
    assert.equal((await taskService.getBoard(member)).columns.flatMap((column) => column.tasks).length, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("Codex의 create_record_draft는 결정 요청을 즉시 전송하지 않는다", async () => {
  const store = new MemoryStore();
  const member = { teamId: "alpha", memberId: "min", role: "member", displayName: "민성" };
  const lead = { teamId: "alpha", memberId: "lead", role: "lead", displayName: "수현" };
  store.addActor("member-token", member);
  store.addActor("lead-token", lead);
  const taskService = new TaskService(store);
  const task = await taskService.createTask(member, { title: "통신", goal: "방향 결정", context: "회의 합의", completion_criteria: "추천안" });
  const server = createApp({ taskService, store, sessionSecret: "test-secret" }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const response = await rpc(url, "member-token", 2, "create_record_draft", {
      kind: "decision_request", task_id: task.id, target_member_id: lead.memberId,
      summary: "LTE·LoRa 범위를 결정해 주세요.", impact: "PCB 구조와 비용"
    });
    assert.match(JSON.stringify(await response.json()), /review_url/);
    assert.equal((await taskService.getDesk(lead)).decisions.length, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function rpc(url, token, id, name, args) {
  return fetch(`${url}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })
  });
}
