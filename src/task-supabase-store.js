import { SupabaseStore } from "./relay/supabase-store.js";

export class TaskSupabaseStore extends SupabaseStore {
  async listMembers(teamId) {
    return rows(this.client.from("relay_members").select("id, display_name, role").eq("team_id", teamId).order("display_name"));
  }

  async findMember(teamId, memberId) {
    return row(this.client.from("relay_members").select("id, display_name, role").eq("team_id", teamId).eq("id", memberId).maybeSingle());
  }

  async insertTask(task) { return insert(this.client, "aligner_tasks", task); }
  async getTask(teamId, taskId) { return row(this.client.from("aligner_tasks").select("*").eq("team_id", teamId).eq("id", taskId).maybeSingle()); }
  async updateTask(taskId, patch) { return row(this.client.from("aligner_tasks").update(patch).eq("id", taskId).select().maybeSingle()); }
  async listTasks(teamId, { activeOnly = false } = {}) {
    let query = this.client.from("aligner_tasks").select("*").eq("team_id", teamId).order("created_at");
    if (activeOnly) query = query.is("completed_at", null);
    return rows(query);
  }

  async insertTaskRecord(record) { return insert(this.client, "aligner_task_records", record); }
  async getTaskRecord(teamId, recordId) { return row(this.client.from("aligner_task_records").select("*").eq("team_id", teamId).eq("id", recordId).maybeSingle()); }
  async listTaskRecords(teamId, taskId) { return rows(this.client.from("aligner_task_records").select("*").eq("team_id", teamId).eq("task_id", taskId).order("created_at")); }
  async listAllTaskRecords(teamId) { return rows(this.client.from("aligner_task_records").select("*").eq("team_id", teamId).order("created_at")); }

  async insertAssignment(assignment) { return insert(this.client, "aligner_task_assignments", assignment); }
  async closeAssignment(taskId, endedAt) { return row(this.client.from("aligner_task_assignments").update({ ended_at: endedAt }).eq("task_id", taskId).is("ended_at", null).select().maybeSingle()); }
  async listAssignments(teamId, taskId = undefined) {
    let query = this.client.from("aligner_task_assignments").select("*").eq("team_id", teamId).order("started_at");
    if (taskId) query = query.eq("task_id", taskId);
    return rows(query);
  }

  async insertNotice(notice) { return insert(this.client, "aligner_notices", notice); }
  async listNotices(teamId, memberId) { return rows(this.client.from("aligner_notices").select("*").eq("team_id", teamId).eq("member_id", memberId).is("read_at", null).order("created_at", { ascending: false })); }

  async insertDraft(draft) { return insert(this.client, "aligner_drafts", draft); }
  async getDraft(teamId, ownerMemberId, draftId) { return row(this.client.from("aligner_drafts").select("*").eq("team_id", teamId).eq("owner_member_id", ownerMemberId).eq("id", draftId).maybeSingle()); }
  async submitDraft(draftId, submittedAt) { return row(this.client.from("aligner_drafts").update({ submitted_at: submittedAt }).eq("id", draftId).is("submitted_at", null).select().maybeSingle()); }
}

async function insert(client, table, value) {
  return row(client.from(table).insert(value).select().single());
}

async function row(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data || null;
}

async function rows(request) {
  const { data, error } = await request;
  if (error) throw error;
  return data || [];
}
