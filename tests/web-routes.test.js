import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/server.js";
import { MemoryStore } from "../src/relay/memory-store.js";
import { TaskService } from "../src/task-service.js";

test("현재 담당자가 아닌 사람은 Task 완료를 할 수 없다", async () => {
  const store = new MemoryStore();
  const owner = { teamId: "alpha", memberId: "owner", role: "member", displayName: "담당자" };
  const other = { teamId: "alpha", memberId: "other", role: "member", displayName: "다른 팀원" };
  store.addActor("owner-token", owner);
  store.addActor("other-token", other);
  const taskService = new TaskService(store);
  const task = await taskService.createTask(owner, { title: "통신", goal: "구조 결정", context: "회의 합의", completion_criteria: "추천안" });
  const server = createApp({ taskService, store, sessionSecret: "test-secret" }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await fetch(`${url}/session`, { method: "POST", headers: { authorization: "Bearer other-token" }, redirect: "manual" });
    const response = await fetch(`${url}/tasks/${task.id}/complete`, {
      method: "POST", headers: { cookie: login.headers.get("set-cookie"), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ result: "완료" }), redirect: "manual"
    });
    assert.equal(response.status, 403);
    assert.match(await response.text(), /현재 담당자만/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
