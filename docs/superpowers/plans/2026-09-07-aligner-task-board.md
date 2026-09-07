# Aligner Task Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the event-only Relay with the agreed Task, record, draft, personal-desk, ownership-board, and roadmap MVP.

**Architecture:** Keep Express and the existing MCP transport. Add a strict domain layer that validates every allowed Task and record payload before it reaches a store. Use a small server-rendered web application with cookie sessions; Codex writes private drafts through MCP and the browser is the only place that confirms Task creation, decision requests, transfers, and completion.

**Tech Stack:** Node.js 20, Express 5, Zod 4, MCP SDK, Supabase, node:test, vanilla HTML/CSS/JavaScript.

**Spec:** `README.md`

## Global Constraints

- Only structured Task fields, records, and links may be stored; never add prompt, transcript, code, terminal, key, or private-note fields.
- A Task requires title, goal, context, and completion criteria.
- The browser confirms Task creation, decision request, transfer request, and completion; Codex confirmation is enough for idea, review, and progress records.
- No email, Slack, web push, automatic Task planning, commit tracking, or session monitoring.
- All team members can read Task details; only the owner can change its normal Task state.
- A transfer changes owner only after the target explicitly accepts it.

---

### Task 1: Strict Task and record domain

**Files:**
- Create: `src/domain/task.js`
- Create: `src/domain/record.js`
- Create: `tests/domain.test.js`

**Interfaces:**
- Produces `validateTaskDraft(input)`, `validateRecordDraft(input)`, `TASK_STATUSES`, and `RECORD_KINDS`.
- Every function returns a deep-cloned allowed-field object or throws a Korean validation error.

- [ ] **Step 1: Write failing domain tests for required Task fields and forbidden fields.**

```js
assert.throws(() => validateTaskDraft({ title: "PCB" }), /goal/);
assert.throws(() => validateTaskDraft({ ...validTask, transcript: "private" }), /허용되지 않는 필드/);
```

- [ ] **Step 2: Run the focused test.**

Run: `pnpm test -- tests/domain.test.js`

Expected: FAIL because `src/domain/task.js` does not exist.

- [ ] **Step 3: Implement allowed Task fields and record-kind schemas.**

```js
export const TASK_STATUSES = new Set(["review", "idea", "decision", "neutral"]);
export function validateTaskDraft(input) { /* title, goal, context, completion_criteria only */ }
export function validateRecordDraft(input) { /* kind-specific, bounded structured fields only */ }
```

- [ ] **Step 4: Run domain tests.**

Run: `pnpm test -- tests/domain.test.js`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/domain tests/domain.test.js
git commit -m "feat: validate aligner task records"
```

### Task 2: Task lifecycle service and in-memory store

**Files:**
- Modify: `src/relay/memory-store.js`
- Create: `src/task-service.js`
- Create: `tests/task-service.test.js`

**Interfaces:**
- Consumes validated Task and record drafts from Task 1.
- Produces `createTask`, `addRecord`, `acceptTransfer`, `declineTransfer`, `completeTask`, `getBoard`, `getDesk`, and `getTaskDetail`.
- `getDesk(actor)` returns `{ decisions, execution, reviews, transfers, roadmap, notices }`.

- [ ] **Step 1: Write failing lifecycle tests.**

```js
const task = await service.createTask(member, validTask);
await service.addRecord(member, task.id, { kind: "decision_request", target_member_id: lead.memberId, summary: "구조 선택" });
assert.equal((await service.getDesk(lead)).decisions.length, 1);
```

- [ ] **Step 2: Run the focused test.**

Run: `pnpm test -- tests/task-service.test.js`

Expected: FAIL because `TaskService` does not exist.

- [ ] **Step 3: Implement the in-memory Task store and service.**

```js
async acceptTransfer(actor, recordId) {
  // actor must match the requested recipient; close old assignment, add new assignment,
  // update current owner, append transfer_accepted record, and create a lead notice.
}
```

- [ ] **Step 4: Add tests for transfer rejection, owner-only completion, decision recording, review result notices, and roadmap assignments.**

Run: `pnpm test -- tests/task-service.test.js`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/relay/memory-store.js src/task-service.js tests/task-service.test.js
git commit -m "feat: add task lifecycle service"
```

### Task 3: Supabase schema and production store

**Files:**
- Create: `supabase/migrations/0002_task_board.sql`
- Create: `src/task-supabase-store.js`
- Create: `tests/task-supabase-store.test.js`

**Interfaces:**
- Mirrors Task 2 store methods against `aligner_tasks`, `aligner_task_records`, `aligner_task_assignments`, `aligner_drafts`, and `aligner_notices`.
- Existing `relay_teams` and `relay_members` remain the membership authority.

- [ ] **Step 1: Write store-contract tests using the memory store method contract.**

```js
assert.deepEqual(Object.keys(await store.getTask(task.id)).sort(), expectedTaskKeys);
```

- [ ] **Step 2: Run the contract tests.**

Run: `pnpm test -- tests/task-supabase-store.test.js`

Expected: FAIL because the production store does not exist.

- [ ] **Step 3: Add an additive SQL migration.**

```sql
create table public.aligner_tasks (...);
create table public.aligner_task_records (...);
create table public.aligner_task_assignments (...);
create table public.aligner_drafts (... expires_at timestamptz not null ...);
create table public.aligner_notices (... read_at timestamptz ...);
```

- [ ] **Step 4: Implement the Supabase adapter and run all store tests.**

Run: `pnpm test`

Expected: PASS without Supabase credentials; adapter query construction is covered by injected fake client tests.

- [ ] **Step 5: Commit.**

```bash
git add supabase/migrations/0002_task_board.sql src/task-supabase-store.js tests/task-supabase-store.test.js
git commit -m "feat: persist aligner tasks"
```

### Task 4: MCP draft and desk tools

**Files:**
- Modify: `src/mcp.js`
- Create: `tests/mcp-task-tools.test.js`

**Interfaces:**
- `create_task_draft`, `create_record_draft`, `read_my_desk`, and `read_task` replace `raise_event` and `read_inbox`.
- Draft tools return `{ draft_id, kind, review_url }`; they never publish a Task or record.

- [ ] **Step 1: Write an MCP test that calls `create_task_draft` and verifies the team board remains empty.**

```js
assert.equal((await service.getBoard(member)).columns.flatMap((column) => column.tasks).length, 0);
```

- [ ] **Step 2: Run the MCP focused test.**

Run: `pnpm test -- tests/mcp-task-tools.test.js`

Expected: FAIL because the new tools are not registered.

- [ ] **Step 3: Register draft-first MCP tools with strict Zod schemas.**

```js
server.registerTool("create_task_draft", { inputSchema: taskDraftSchema() }, async (input) => {
  return text(await service.createDraft(actor, "task", input));
});
```

- [ ] **Step 4: Run MCP and full tests.**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/mcp.js tests/mcp-task-tools.test.js
git commit -m "feat: add draft-first MCP tools"
```

### Task 5: Browser routes and action authorization

**Files:**
- Modify: `src/server.js`
- Create: `src/web/routes.js`
- Create: `tests/web-routes.test.js`

**Interfaces:**
- Browser session identifies the current member.
- Routes: `/`, `/board`, `/desk`, `/tasks/:taskId`, `/drafts/:draftId`, and POST action routes for draft submission, decision record, review result, transfer response, progress update, completion, and notice acknowledgement.

- [ ] **Step 1: Write browser route tests for owner-only writes and target-only transfer acceptance.**

```js
assert.equal(response.status, 403);
assert.match(await response.text(), /권한/);
```

- [ ] **Step 2: Run route tests.**

Run: `pnpm test -- tests/web-routes.test.js`

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement session-backed routes with redirect-after-post.**

```js
router.post("/tasks/:taskId/complete", requireSession, async (req, res) => {
  await service.completeTask(req.actor, req.params.taskId, req.body);
  res.redirect(303, `/tasks/${req.params.taskId}`);
});
```

- [ ] **Step 4: Run route and full test suites.**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/server.js src/web/routes.js tests/web-routes.test.js
git commit -m "feat: add task board web actions"
```

### Task 6: Shared board, personal desk, detail, draft, and roadmap UI

**Files:**
- Create: `src/web/render.js`
- Modify: `src/web/routes.js`
- Create: `tests/render.test.js`

**Interfaces:**
- `renderOwnershipBoard(actor, board)`, `renderDesk(actor, desk)`, `renderTaskDetail(actor, task)`, and `renderDraft(actor, draft)` render escaped data only.
- Shared board is centered and person-column based; roadmap is chronological by Task creation with dotted historical assignment cards after accepted transfer.

- [ ] **Step 1: Write renderer tests for escaping, status copy, and transfer roadmap markup.**

```js
assert.match(renderOwnershipBoard(actor, board), /결정 필요해요/);
assert.doesNotMatch(renderOwnershipBoard(actor, board), /<script>alert/);
```

- [ ] **Step 2: Run renderer tests.**

Run: `pnpm test -- tests/render.test.js`

Expected: FAIL because render functions do not exist.

- [ ] **Step 3: Implement responsive, no-dependency server-rendered pages.**

```html
<section class="member-column"><article class="task-card status-decision">...</article></section>
```

- [ ] **Step 4: Run all tests and manually inspect desktop and narrow viewport output.**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/web/render.js src/web/routes.js tests/render.test.js
git commit -m "feat: render aligner task boards"
```

### Task 7: Team skill, migration guide, and end-to-end verification

**Files:**
- Modify: `AGENTS.md`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `tests/e2e-task-flow.test.js`

**Interfaces:**
- Team skill tells Codex to create drafts only on explicit request and never auto-publish.
- README contains the final MCP setup and staged deployment steps.

- [ ] **Step 1: Write an end-to-end test covering draft → browser confirmation → decision → decision record → acknowledgement → completion.**

```js
assert.equal(task.completed_at !== null, true);
assert.equal((await service.getBoard(lead)).columns.flatMap((column) => column.tasks).length, 0);
```

- [ ] **Step 2: Run end-to-end test.**

Run: `pnpm test -- tests/e2e-task-flow.test.js`

Expected: PASS after Tasks 1–6.

- [ ] **Step 3: Replace legacy agent instructions and document local/cloud setup.**

```text
Codex는 사용자가 명시적으로 요청할 때만 Aligner Draft를 만든다.
```

- [ ] **Step 4: Run final verification.**

Run: `pnpm test && git diff --check`

Expected: all tests pass and no whitespace errors.

- [ ] **Step 5: Commit.**

```bash
git add AGENTS.md .env.example README.md tests/e2e-task-flow.test.js
git commit -m "docs: guide aligner task workflow"
```

## Post-local deployment steps

1. Log into Supabase and apply `supabase/migrations/0002_task_board.sql` after the existing migration.
2. Set the Render service to the Aligner repository and deploy the committed branch.
3. Bootstrap a test team and configure each member's local MCP token.
4. Verify one real draft → web confirmation → board → decision record → completion flow.
