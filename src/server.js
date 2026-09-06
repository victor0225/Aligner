import express from "express";
import { createClient } from "@supabase/supabase-js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { getConfig } from "./config.js";
import { createMcpServer } from "./mcp.js";
import { authenticate } from "./relay/auth.js";
import { RelayService } from "./relay/service.js";
import { SupabaseStore } from "./relay/supabase-store.js";
import { createSession, readSession, renderBoard, renderLogin, sessionCookie } from "./trust-board.js";

export function createApp({ service, store, sessionSecret }) {
  const app = express();
  app.use(express.json({ limit: "16kb" }));
  app.use(express.urlencoded({ extended: false, limit: "4kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true, service: "aligner-relay" }));

  app.post("/trust-board/session", async (req, res) => {
    try {
      const authorization = req.headers.authorization || (req.body.token ? `Bearer ${req.body.token}` : undefined);
      const actor = await authenticate(store, authorization);
      res.set("Set-Cookie", sessionCookie(createSession(actor, sessionSecret))).redirect(303, "/trust-board");
    } catch {
      res.status(401).type("html").send(renderLogin());
    }
  });

  app.get("/trust-board", async (req, res) => {
    const actor = readSession(req.headers.cookie, sessionSecret);
    if (!actor) return res.type("html").send(renderLogin());
    const events = actor.role === "lead" ? await service.readInbox(actor, "open") : await service.readSent(actor);
    return res.type("html").send(renderBoard(actor, events));
  });

  app.post("/mcp", async (req, res) => {
    let transport;
    let mcp;
    try {
      const actor = await authenticate(store, req.headers.authorization);
      mcp = createMcpServer(actor, service);
      transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      await mcp.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      if (!res.headersSent) res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: error.message }, id: null });
    } finally {
      res.once("close", () => {
        transport?.close();
        mcp?.close();
      });
    }
  });
  app.all("/mcp", (_req, res) => res.status(405).set("Allow", "POST").send("Method Not Allowed"));
  return app;
}

if (import.meta.url === `file:///${process.argv[1].replaceAll("\\", "/")}`) {
  const config = getConfig();
  const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
  const store = new SupabaseStore(client);
  const app = createApp({ service: new RelayService(store), store, sessionSecret: config.sessionSecret });
  app.listen(config.port, () => console.log(`Aligner Relay listening on ${config.port}`));
}
