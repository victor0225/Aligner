import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

export function createMcpServer(actor, service) {
  const server = new McpServer({ name: "aligner-relay", version: "0.1.0" });

  server.registerTool(
    "raise_event",
    {
      description: "팀장에게 필요한 판단 신호만 보냅니다. idea_share는 아이디어 공유, review_request는 팀원 주도 검토, decision_handoff는 실제 갈림길의 결정 이관입니다. 원문 대화·코드·터미널 출력·비밀은 절대 넣지 마세요.",
      inputSchema: eventSchema()
    },
    async (input) => {
      try {
        const event = await service.raise(actor, input);
        return text({ status: event.duplicate ? "duplicate" : "raised", event });
      } catch (error) {
        return text({ error: error.message }, true);
      }
    }
  );

  server.registerTool(
    "read_inbox",
    {
      description: "팀장 전용 inbox입니다. mode:new는 아직 전달하지 않은 이벤트를 읽고 delivered로 표시합니다. mode:open은 상태를 바꾸지 않습니다.",
      inputSchema: { mode: z.enum(["new", "open"]).default("open") }
    },
    async ({ mode }) => {
      try {
        return text({ events: await service.readInbox(actor, mode) });
      } catch (error) {
        return text({ error: error.message }, true);
      }
    }
  );
  return server;
}

export function createTaskMcpServer(actor, taskService, baseUrl = "") {
  const server = new McpServer({ name: "aligner", version: "0.2.0" });
  server.registerTool(
    "create_task_draft",
    {
      description: "사용자가 명시적으로 요청한 경우에만 비공개 Task 초안을 만듭니다. 이 호출은 팀 보드에 아무것도 게시하지 않습니다. 원문 대화·코드·터미널·비밀은 넣지 마세요.",
      inputSchema: {
        title: z.string().min(1).max(160),
        goal: z.string().min(1).max(200),
        context: z.string().min(1).max(500),
        completion_criteria: z.string().min(1).max(300)
      }
    },
    async (input) => {
      try {
        const draft = await taskService.createDraft(actor, "task", input);
        return text({ draft_id: draft.id, kind: draft.kind, review_url: `${baseUrl}/drafts/${draft.id}` });
      } catch (error) {
        return text({ error: error.message }, true);
      }
    }
  );
  server.registerTool(
    "create_record_draft",
    {
      description: "결정 요청·Task 이관·완료의 비공개 초안을 만듭니다. 웹에서 확인하기 전에는 누구에게도 전송하지 않습니다.",
      inputSchema: {
        kind: z.enum(["decision_request", "transfer_request", "completion"]),
        task_id: z.string().uuid(),
        summary: z.string().min(1).max(300).optional(),
        target_member_id: z.string().min(1).max(100).optional(),
        impact: z.string().min(1).max(300).optional(),
        options: z.array(z.string().min(1).max(160)).max(3).optional(),
        completed_work: z.string().min(1).max(300).optional(),
        requested_work: z.string().min(1).max(300).optional(),
        result: z.string().min(1).max(300).optional(),
        evidence_link: z.string().url().optional()
      }
    },
    async ({ kind, ...input }) => {
      try {
        const draft = await taskService.createDraft(actor, kind, input);
        return text({ draft_id: draft.id, kind: draft.kind, review_url: `${baseUrl}/drafts/${draft.id}` });
      } catch (error) {
        return text({ error: error.message }, true);
      }
    }
  );
  server.registerTool(
    "read_my_desk",
    { description: "내게 확인·결정·이관이 필요한 구조화된 Task 항목만 읽습니다.", inputSchema: {} },
    async () => text(await taskService.getDesk(actor))
  );
  server.registerTool(
    "read_task",
    { description: "팀에 공유된 Task의 구조화된 맥락·기록·이관 이력을 읽습니다.", inputSchema: { task_id: z.string().uuid() } },
    async ({ task_id }) => {
      try {
        return text(await taskService.getTaskDetail(actor, task_id));
      } catch (error) {
        return text({ error: error.message }, true);
      }
    }
  );
  return server;
}

function eventSchema() {
  return {
    event_id: z.string().uuid(),
    intent: z.enum(["idea_share", "review_request", "decision_handoff"]),
    task_title: z.string().min(1).max(160),
    summary: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(160)).max(3).optional(),
    impact: z.string().min(1).max(300),
    evidence_link: z.string().url().optional(),
    sensitivity: z.literal("internal"),
    continuing_work: z.string().min(1).max(300).optional(),
    held_action: z.string().min(1).max(300).optional()
  };
}

function text(payload, isError = false) {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError };
}
