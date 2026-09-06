import { randomUUID } from "node:crypto";
import { validateEventInput } from "./event.js";

export class RelayService {
  constructor(store) {
    this.store = store;
  }

  async raise(actor, input) {
    requireRole(actor, "member");
    const clean = validateEventInput(input);
    const existing = await this.store.findBySenderAndEventId(actor.memberId, clean.event_id);
    if (existing) return { ...existing, duplicate: true };

    const stored = await this.store.insert({
      id: randomUUID(),
      event_id: clean.event_id,
      team_id: actor.teamId,
      sender_member_id: actor.memberId,
      sender_name: actor.displayName,
      ...clean,
      created_at: new Date().toISOString(),
      delivery_status: "pending"
    });
    return { ...stored, duplicate: false };
  }

  async readSent(actor) {
    requireRole(actor, "member");
    return this.store.listBySender(actor.teamId, actor.memberId);
  }

  async readInbox(actor, mode = "open") {
    requireRole(actor, "lead");
    if (!new Set(["new", "open"]).has(mode)) throw new Error("mode는 new 또는 open이어야 합니다.");
    const events = await this.store.listOpenForTeam(actor.teamId, mode === "new");
    if (mode === "new" && events.length) await this.store.markDelivered(events.map((event) => event.id));
    return events;
  }
}

function requireRole(actor, role) {
  if (!actor || actor.role !== role) throw new Error(`${role}만 이 작업을 할 수 있습니다.`);
}
