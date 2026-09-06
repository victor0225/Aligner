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
