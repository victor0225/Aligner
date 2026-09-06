export class SupabaseStore {
  constructor(client) {
    this.client = client;
  }

  async findActorByTokenHash(tokenHash) {
    const { data, error } = await this.client
      .from("relay_members")
      .select("id, display_name, role, relay_teams!inner(id)")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { memberId: data.id, displayName: data.display_name, role: data.role, teamId: data.relay_teams.id };
  }

  async findBySenderAndEventId(senderMemberId, eventId) {
    const { data, error } = await this.client
      .from("relay_events")
      .select("*")
      .eq("sender_member_id", senderMemberId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async insert(event) {
    const { data, error } = await this.client.from("relay_events").insert(event).select().single();
    if (error) throw error;
    return data;
  }

  async listBySender(teamId, memberId) {
    const { data, error } = await this.client
      .from("relay_events")
      .select("*")
      .eq("team_id", teamId)
      .eq("sender_member_id", memberId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  }

  async listOpenForTeam(teamId, onlyPending) {
    let query = this.client.from("relay_events").select("*").eq("team_id", teamId).order("created_at", { ascending: false });
    if (onlyPending) query = query.eq("delivery_status", "pending");
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async markDelivered(ids) {
    const { error } = await this.client
      .from("relay_events")
      .update({ delivery_status: "delivered", delivered_at: new Date().toISOString() })
      .in("id", ids);
    if (error) throw error;
  }
}
