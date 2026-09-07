import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Task 보드 마이그레이션은 Task·기록·이관·초안·개인 보드 테이블을 분리한다", async () => {
  const sql = await readFile(new URL("../supabase/migrations/0002_task_board.sql", import.meta.url), "utf8");
  for (const table of ["aligner_tasks", "aligner_task_records", "aligner_task_assignments", "aligner_drafts", "aligner_notices"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
  }
  assert.doesNotMatch(sql, /transcript|terminal_output|source_code|api_key/i);
});
