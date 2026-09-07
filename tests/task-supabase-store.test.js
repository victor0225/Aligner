import test from "node:test";
import assert from "node:assert/strict";

import { TaskSupabaseStore } from "../src/task-supabase-store.js";

test("Task Supabase 저장소는 팀 멤버와 Task를 알맞은 테이블로 조회·저장한다", async () => {
  const client = fakeClient({
    relay_members: [{ id: "min", display_name: "민성", role: "member" }],
    aligner_tasks: [{ id: "task-1", team_id: "alpha", title: "통신 구조" }]
  });
  const store = new TaskSupabaseStore(client);

  const members = await store.listMembers("alpha");
  const task = await store.insertTask({ id: "task-1", team_id: "alpha", title: "통신 구조" });

  assert.deepEqual(members, [{ id: "min", display_name: "민성", role: "member" }]);
  assert.equal(task.id, "task-1");
  assert.deepEqual(client.calls.map((call) => call.table), ["relay_members", "aligner_tasks"]);
  assert.deepEqual(client.calls[0].filters, [["eq", "team_id", "alpha"]]);
  assert.deepEqual(client.calls[1].inserted, { id: "task-1", team_id: "alpha", title: "통신 구조" });
});

function fakeClient(rowsByTable) {
  const calls = [];
  return {
    calls,
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      return query(call, rowsByTable[table] || []);
    }
  };
}

function query(call, rows) {
  const result = () => ({ data: structuredClone(rows), error: null });
  return {
    select() { return this; },
    eq(...filter) { call.filters.push(["eq", ...filter]); return this; },
    is(...filter) { call.filters.push(["is", ...filter]); return this; },
    order() { return this; },
    insert(value) { call.inserted = value; return this; },
    update(value) { call.updated = value; return this; },
    maybeSingle: async () => ({ data: structuredClone(rows[0] || null), error: null }),
    single: async () => ({ data: structuredClone(rows[0] || null), error: null }),
    then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); }
  };
}
