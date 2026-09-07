import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/server.js";
import { MemoryStore } from "../src/relay/memory-store.js";
import { TaskService } from "../src/task-service.js";

const memberToken = "member-token";
const member = { teamId: "alpha", memberId: "min", role: "member", displayName: "민성" };
const lead = { teamId: "alpha", memberId: "lead", role: "lead", displayName: "수현" };
const draftPayload = {
  title: "통신 구조 비교",
  goal: "제품화에 맞는 구조를 추천한다.",
  context: "회의에서 제품 환경까지 검토하기로 합의했다.",
  completion_criteria: "비교표와 추천안을 남긴다."
};

test("웹 로그인 후 Draft를 확인하고 생성하면 주도권 보드에 Task가 나타난다", async () => {
  const store = new MemoryStore();
  store.addActor(memberToken, member);
  store.addActor("lead-token", lead);
  const taskService = new TaskService(store);
  const draft = await taskService.createDraft(member, "task", draftPayload);
  const app = createApp({ taskService, store, sessionSecret: "test-secret" });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;

  try {
    const login = await fetch(`${url}/session`, { method: "POST", headers: { authorization: `Bearer ${memberToken}` }, redirect: "manual" });
    const cookie = login.headers.get("set-cookie");
    assert.equal(login.status, 303);
    const preview = await fetch(`${url}/drafts/${draft.id}`, { headers: { cookie } });
    assert.match(await preview.text(), /통신 구조 비교/);

    const submit = await fetch(`${url}/drafts/${draft.id}/submit`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(draftPayload),
      redirect: "manual"
    });
    assert.equal(submit.status, 303);
    const board = await fetch(`${url}/board`, { headers: { cookie } });
    assert.match(await board.text(), /통신 구조 비교/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
