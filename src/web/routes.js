import { authenticate } from "../relay/auth.js";
import { createSession, readSession, sessionCookie } from "../trust-board.js";
import { renderDesk, renderDraft, renderLogin, renderOwnershipBoard, renderTaskDetail } from "./render.js";

export function attachTaskRoutes(app, { taskService, store, sessionSecret }) {
  app.get("/", (_req, res) => res.redirect(303, "/board"));

  app.post("/session", async (req, res) => {
    try {
      const authorization = req.headers.authorization || (req.body.token ? `Bearer ${req.body.token}` : undefined);
      const actor = await authenticate(store, authorization);
      res.set("Set-Cookie", sessionCookie(createSession(actor, sessionSecret))).redirect(303, "/board");
    } catch {
      res.status(401).type("html").send(renderLogin());
    }
  });

  app.get("/board", withActor(sessionSecret, async (actor, _req, res) => {
    const memberId = typeof _req.query.member === "string" ? _req.query.member : "";
    res.type("html").send(renderOwnershipBoard(actor, await taskService.getBoard(actor), memberId));
  }));

  app.get("/desk", withActor(sessionSecret, async (actor, _req, res) => {
    res.type("html").send(renderDesk(actor, await taskService.getDesk(actor)));
  }));

  app.get("/tasks/:taskId", withActor(sessionSecret, async (actor, req, res) => {
    res.type("html").send(renderTaskDetail(actor, await taskService.getTaskDetail(actor, req.params.taskId)));
  }));

  app.get("/drafts/:draftId", withActor(sessionSecret, async (actor, req, res) => {
    res.type("html").send(renderDraft(actor, await taskService.getDraft(actor, req.params.draftId)));
  }));

  app.post("/drafts/:draftId/submit", withActor(sessionSecret, async (actor, req, res) => {
    const draft = await taskService.getDraft(actor, req.params.draftId);
    if (draft.kind === "task") {
      const task = await taskService.submitTaskDraft(actor, draft.id, req.body);
      return res.redirect(303, `/tasks/${encodeURIComponent(task.id)}`);
    }
    await taskService.submitRecordDraft(actor, draft.id, req.body);
    res.redirect(303, `/tasks/${encodeURIComponent(draft.task_id)}`);
  }));

  app.post("/tasks/:taskId/record", withActor(sessionSecret, async (actor, req, res) => {
    await taskService.addRecord(actor, req.params.taskId, req.body);
    res.redirect(303, `/tasks/${encodeURIComponent(req.params.taskId)}`);
  }));

  app.post("/tasks/:taskId/complete", withActor(sessionSecret, async (actor, req, res) => {
    await taskService.completeTask(actor, req.params.taskId, req.body);
    res.redirect(303, `/tasks/${encodeURIComponent(req.params.taskId)}`);
  }));

  app.post("/transfers/:recordId/accept", withActor(sessionSecret, async (actor, req, res) => {
    const record = await taskService.acceptTransfer(actor, req.params.recordId);
    res.redirect(303, `/tasks/${encodeURIComponent(record.task_id)}`);
  }));

  app.post("/transfers/:recordId/decline", withActor(sessionSecret, async (actor, req, res) => {
    const record = await taskService.declineTransfer(actor, req.params.recordId, req.body.reason);
    res.redirect(303, `/tasks/${encodeURIComponent(record.task_id)}`);
  }));
}

function withActor(sessionSecret, handler) {
  return async (req, res) => {
    const actor = readSession(req.headers.cookie, sessionSecret);
    if (!actor) return res.status(401).type("html").send(renderLogin());
    try {
      return await handler(actor, req, res);
    } catch (error) {
      const forbidden = /권한|만 .*할 수 있습니다|현재 담당자만|팀장만|대상자만/.test(error.message);
      return res.status(forbidden ? 403 : 400).type("html").send(`<p>${escape(error.message)}</p>`);
    }
  };
}

function escape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
