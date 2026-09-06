import test from "node:test";
import assert from "node:assert/strict";

import { createApp } from "../src/server.js";
import { MemoryStore } from "../src/relay/memory-store.js";
import { RelayService } from "../src/relay/service.js";

const memberToken = "alr_member_test";
const leadToken = "alr_lead_test";
const event = {
  event_id: "552ef3d2-44f6-4610-b7f8-9fe179b08ae3",
  intent: "idea_share",
  task_title: "제품형 통신",
  summary: "시연 Wi-Fi 외 LTE와 LoRa도 제품 옵션으로 생각해볼 수 있습니다.",
  impact: "초기 설계 범위",
  sensitivity: "internal"
};

async function withApp(run) {
  const store = new MemoryStore();
  store.addActor(memberToken, { teamId: "alpha", memberId: "min", role: "member", displayName: "민" });
  store.addActor(leadToken, { teamId: "alpha", memberId: "ji", role: "lead", displayName: "지" });
  const app = createApp({ service: new RelayService(store), store, sessionSecret: "test-secret" });
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`, new RelayService(store));
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test("health endpoint는 배포 상태를 반환한다", async () => {
  await withApp(async (url) => {
    const response = await fetch(`${url}/health`);
    assert.deepEqual(await response.json(), { ok: true, service: "aligner-relay" });
  });
});

test("trust board는 member에게 자기 이벤트만 보여준다", async () => {
  await withApp(async (url, service) => {
    await service.raise({ teamId: "alpha", memberId: "min", role: "member", displayName: "민" }, event);
    const login = await fetch(`${url}/trust-board/session`, {
      method: "POST",
      headers: { authorization: `Bearer ${memberToken}` },
      redirect: "manual"
    });
    const cookie = login.headers.get("set-cookie");
    assert.equal(login.status, 303);

    const board = await fetch(`${url}/trust-board`, { headers: { cookie } });
    const html = await board.text();
    assert.match(html, /제품형 통신/);
    assert.match(html, /원문 대화·코드·터미널 출력은 저장하지 않습니다/);
  });
});

test("MCP raise_event → lead read_inbox가 같은 이벤트를 전달한다", async () => {
  await withApp(async (url) => {
    const raise = await rpc(url, memberToken, 1, "tools/call", { name: "raise_event", arguments: event });
    assert.equal(raise.status, 200);
    assert.match(JSON.stringify(await raise.json()), /raised/);

    const inbox = await rpc(url, leadToken, 2, "tools/call", { name: "read_inbox", arguments: { mode: "new" } });
    const body = await inbox.json();
    assert.equal(inbox.status, 200);
    assert.match(JSON.stringify(body), /제품형 통신/);
  });
});

function rpc(url, token, id, method, params) {
  return fetch(`${url}/mcp`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });
}
