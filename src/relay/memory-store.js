export class MemoryStore {
  constructor() {
    this.events = [];
    this.actors = new Map();
  }

  addActor(token, actor) {
    this.actors.set(token, actor);
  }

  async findActorByTokenHash(tokenHash) {
    const { hashToken } = await import("./auth.js");
    for (const [token, actor] of this.actors) {
      if (hashToken(token) === tokenHash) return structuredClone(actor);
    }
    return null;
  }

  async findBySenderAndEventId(senderMemberId, eventId) {
    const event = this.events.find((candidate) => candidate.sender_member_id === senderMemberId && candidate.event_id === eventId);
    return event ? structuredClone(event) : null;
  }

  async insert(event) {
    this.events.push(event);
    return structuredClone(event);
  }

  async listBySender(teamId, memberId) {
    return this.events
      .filter((event) => event.team_id === teamId && event.sender_member_id === memberId)
      .sort(byNewest)
      .map((event) => structuredClone(event));
  }

  async listOpenForTeam(teamId, onlyPending) {
    return this.events
      .filter((event) => event.team_id === teamId && (!onlyPending || event.delivery_status === "pending"))
      .sort(byNewest)
      .map((event) => structuredClone(event));
  }

  async markDelivered(ids) {
    this.events.forEach((event) => {
      if (ids.includes(event.id)) event.delivery_status = "delivered";
    });
  }
}

function byNewest(a, b) {
  return b.created_at.localeCompare(a.created_at);
}
