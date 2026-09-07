export class MemoryStore {
  constructor() {
    this.events = [];
    this.actors = new Map();
    this.tasks = [];
    this.taskRecords = [];
    this.taskAssignments = [];
    this.notices = [];
    this.drafts = [];
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

  async listMembers(teamId) {
    return [...this.actors.values()]
      .filter((actor) => actor.teamId === teamId)
      .map((actor) => ({ id: actor.memberId, display_name: actor.displayName, role: actor.role }))
      .sort((left, right) => left.display_name.localeCompare(right.display_name));
  }

  async findMember(teamId, memberId) {
    const actor = [...this.actors.values()].find((candidate) => candidate.teamId === teamId && candidate.memberId === memberId);
    return actor ? { id: actor.memberId, display_name: actor.displayName, role: actor.role } : null;
  }

  async insertTask(task) {
    this.tasks.push(structuredClone(task));
    return structuredClone(task);
  }

  async getTask(teamId, taskId) {
    const task = this.tasks.find((candidate) => candidate.team_id === teamId && candidate.id === taskId);
    return task ? structuredClone(task) : null;
  }

  async updateTask(taskId, patch) {
    const task = this.tasks.find((candidate) => candidate.id === taskId);
    if (!task) return null;
    Object.assign(task, structuredClone(patch));
    return structuredClone(task);
  }

  async listTasks(teamId, { activeOnly = false } = {}) {
    return this.tasks
      .filter((task) => task.team_id === teamId && (!activeOnly || !task.completed_at))
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((task) => structuredClone(task));
  }

  async insertTaskRecord(record) {
    this.taskRecords.push(structuredClone(record));
    return structuredClone(record);
  }

  async getTaskRecord(teamId, recordId) {
    const record = this.taskRecords.find((candidate) => candidate.team_id === teamId && candidate.id === recordId);
    return record ? structuredClone(record) : null;
  }

  async listTaskRecords(teamId, taskId) {
    return this.taskRecords
      .filter((record) => record.team_id === teamId && record.task_id === taskId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((record) => structuredClone(record));
  }

  async listAllTaskRecords(teamId) {
    return this.taskRecords
      .filter((record) => record.team_id === teamId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at))
      .map((record) => structuredClone(record));
  }

  async insertAssignment(assignment) {
    this.taskAssignments.push(structuredClone(assignment));
    return structuredClone(assignment);
  }

  async closeAssignment(taskId, endedAt) {
    const assignment = this.taskAssignments.find((candidate) => candidate.task_id === taskId && !candidate.ended_at);
    if (!assignment) return null;
    assignment.ended_at = endedAt;
    return structuredClone(assignment);
  }

  async listAssignments(teamId, taskId = undefined) {
    return this.taskAssignments
      .filter((assignment) => assignment.team_id === teamId && (!taskId || assignment.task_id === taskId))
      .sort((left, right) => left.started_at.localeCompare(right.started_at))
      .map((assignment) => structuredClone(assignment));
  }

  async insertNotice(notice) {
    this.notices.push(structuredClone(notice));
    return structuredClone(notice);
  }

  async listNotices(teamId, memberId) {
    return this.notices
      .filter((notice) => notice.team_id === teamId && notice.member_id === memberId && !notice.read_at)
      .sort(byNewest)
      .map((notice) => structuredClone(notice));
  }
}

function byNewest(a, b) {
  return b.created_at.localeCompare(a.created_at);
}
