import { randomUUID } from "node:crypto";
import { validateRecordDraft, validateTaskDraft } from "./domain/task.js";

export class TaskService {
  constructor(store) {
    this.store = store;
  }

  async createTask(actor, input) {
    const clean = validateTaskDraft(input);
    const createdAt = now();
    const task = await this.store.insertTask({
      id: randomUUID(),
      team_id: actor.teamId,
      owner_member_id: actor.memberId,
      owner_name: actor.displayName,
      title: clean.title,
      goal: clean.goal,
      context: clean.context,
      completion_criteria: clean.completion_criteria,
      primary_status: "review",
      is_in_progress: true,
      progress_summary: null,
      next_step: null,
      result: null,
      evidence_link: null,
      created_at: createdAt,
      updated_at: createdAt,
      completed_at: null
    });
    await this.store.insertAssignment({
      id: randomUUID(),
      team_id: actor.teamId,
      task_id: task.id,
      member_id: actor.memberId,
      member_name: actor.displayName,
      started_at: createdAt,
      ended_at: null
    });
    return task;
  }

  async addRecord(actor, taskId, input) {
    const task = await this.requireTask(actor, taskId);
    const clean = validateRecordDraft(input);
    await this.authorizeRecord(actor, task, clean);
    if (clean.target_member_id) await this.requireMember(actor.teamId, clean.target_member_id);

    const record = await this.store.insertTaskRecord(makeRecord(actor, task.id, clean));
    await this.applyRecord(task, record);
    await this.createRecordNotices(task, record);
    return record;
  }

  async acceptTransfer(actor, requestId) {
    const request = await this.requireTransferRequest(actor, requestId);
    if (request.target_member_id !== actor.memberId) throw new Error("이관 대상자만 수락할 수 있습니다.");
    const task = await this.requireTask(actor, request.task_id);
    const previousOwnerId = task.owner_member_id;
    const createdAt = now();
    await this.store.closeAssignment(task.id, createdAt);
    await this.store.insertAssignment({
      id: randomUUID(),
      team_id: actor.teamId,
      task_id: task.id,
      member_id: actor.memberId,
      member_name: actor.displayName,
      started_at: createdAt,
      ended_at: null
    });
    await this.store.updateTask(task.id, { owner_member_id: actor.memberId, owner_name: actor.displayName, updated_at: createdAt });
    const record = await this.store.insertTaskRecord(makeSystemRecord(actor, task.id, "transfer_accepted", "이관을 수락했습니다.", request.id));
    await this.createNotice(actor.teamId, previousOwnerId, task.id, record.id, "execution");
    await this.createLeadNotices(actor.teamId, task.id, record.id);
    return record;
  }

  async declineTransfer(actor, requestId, reason) {
    const request = await this.requireTransferRequest(actor, requestId);
    if (request.target_member_id !== actor.memberId) throw new Error("이관 대상자만 거절할 수 있습니다.");
    if (typeof reason !== "string" || !reason.trim() || reason.length > 300) throw new Error("이관 거절 이유는 300자 이하로 입력해 주세요.");
    const task = await this.requireTask(actor, request.task_id);
    const record = await this.store.insertTaskRecord(makeSystemRecord(actor, task.id, "transfer_declined", reason, request.id));
    await this.createNotice(actor.teamId, task.owner_member_id, task.id, record.id, "execution");
    await this.createLeadNotices(actor.teamId, task.id, record.id);
    return record;
  }

  async completeTask(actor, taskId, input) {
    const task = await this.requireTask(actor, taskId);
    this.requireOwner(actor, task);
    const clean = validateRecordDraft({ kind: "completion", ...input });
    const record = await this.store.insertTaskRecord(makeRecord(actor, task.id, clean));
    const completedAt = now();
    await this.store.updateTask(task.id, {
      primary_status: "neutral",
      is_in_progress: false,
      result: clean.result,
      evidence_link: clean.evidence_link || null,
      updated_at: completedAt,
      completed_at: completedAt
    });
    return record;
  }

  async getBoard(actor) {
    const [members, tasks] = await Promise.all([
      this.store.listMembers(actor.teamId),
      this.store.listTasks(actor.teamId, { activeOnly: true })
    ]);
    return {
      columns: members.map((member) => ({
        member,
        tasks: tasks.filter((task) => task.owner_member_id === member.id)
      }))
    };
  }

  async getDesk(actor) {
    const [tasks, records, notices] = await Promise.all([
      this.store.listTasks(actor.teamId),
      this.store.listAllTaskRecords(actor.teamId),
      this.store.listNotices(actor.teamId, actor.memberId)
    ]);
    const active = tasks.filter((task) => !task.completed_at);
    return {
      decisions: records.filter((record) => record.kind === "decision_request" && record.target_member_id === actor.memberId && taskById(tasks, record.task_id)?.primary_status === "decision"),
      execution: active.filter((task) => task.owner_member_id === actor.memberId),
      reviews: records.filter((record) => record.kind === "review_request" && record.target_member_id === actor.memberId),
      transfers: records.filter((record) => record.kind === "transfer_request" && (record.target_member_id === actor.memberId || actor.role === "lead")),
      roadmap: tasks,
      notices
    };
  }

  async getTaskDetail(actor, taskId) {
    const task = await this.requireTask(actor, taskId);
    const [records, assignments] = await Promise.all([
      this.store.listTaskRecords(actor.teamId, taskId),
      this.store.listAssignments(actor.teamId, taskId)
    ]);
    return { task, records, assignments };
  }

  async requireTask(actor, taskId) {
    const task = await this.store.getTask(actor.teamId, taskId);
    if (!task) throw new Error("Task를 찾을 수 없습니다.");
    return task;
  }

  async requireMember(teamId, memberId) {
    const member = await this.store.findMember(teamId, memberId);
    if (!member) throw new Error("같은 팀의 멤버를 지정해 주세요.");
    return member;
  }

  async requireTransferRequest(actor, requestId) {
    const request = await this.store.getTaskRecord(actor.teamId, requestId);
    if (!request || request.kind !== "transfer_request") throw new Error("이관 요청을 찾을 수 없습니다.");
    return request;
  }

  async authorizeRecord(actor, task, clean) {
    if (clean.kind === "decision_record") {
      if (actor.role !== "lead") throw new Error("팀장만 결정 기록을 남길 수 있습니다.");
      return;
    }
    if (clean.kind === "review_result") return;
    this.requireOwner(actor, task);
  }

  requireOwner(actor, task) {
    if (task.owner_member_id !== actor.memberId) throw new Error("현재 담당자만 Task를 변경할 수 있습니다.");
  }

  async applyRecord(task, record) {
    const updatedAt = now();
    if (record.kind === "idea_share") await this.store.updateTask(task.id, { primary_status: "idea", updated_at: updatedAt });
    if (record.kind === "review_request") await this.store.updateTask(task.id, { primary_status: "review", updated_at: updatedAt });
    if (record.kind === "decision_request") await this.store.updateTask(task.id, { primary_status: "decision", updated_at: updatedAt });
    if (record.kind === "decision_record") await this.store.updateTask(task.id, { primary_status: "neutral", updated_at: updatedAt });
    if (record.kind === "progress_update") {
      await this.store.updateTask(task.id, {
        progress_summary: record.current_context,
        next_step: record.next_step,
        updated_at: updatedAt
      });
    }
  }

  async createRecordNotices(task, record) {
    if (record.kind === "decision_request") await this.createNotice(task.team_id, record.target_member_id, task.id, record.id, "decision");
    if (record.kind === "review_request") await this.createNotice(task.team_id, record.target_member_id, task.id, record.id, "review");
    if (record.kind === "transfer_request") {
      await this.createNotice(task.team_id, record.target_member_id, task.id, record.id, "transfer");
      await this.createLeadNotices(task.team_id, task.id, record.id);
    }
    if (record.kind === "decision_record" || record.kind === "review_result") {
      await this.createNotice(task.team_id, task.owner_member_id, task.id, record.id, "execution");
    }
  }

  async createLeadNotices(teamId, taskId, recordId) {
    const members = await this.store.listMembers(teamId);
    await Promise.all(members.filter((member) => member.role === "lead").map((member) => this.createNotice(teamId, member.id, taskId, recordId, "transfer")));
  }

  async createNotice(teamId, memberId, taskId, recordId, section) {
    return this.store.insertNotice({
      id: randomUUID(),
      team_id: teamId,
      member_id: memberId,
      task_id: taskId,
      record_id: recordId,
      section,
      created_at: now(),
      read_at: null
    });
  }
}

function makeRecord(actor, taskId, clean) {
  return {
    id: randomUUID(),
    team_id: actor.teamId,
    task_id: taskId,
    actor_member_id: actor.memberId,
    actor_name: actor.displayName,
    ...clean,
    created_at: now()
  };
}

function makeSystemRecord(actor, taskId, kind, summary, inReplyTo) {
  return {
    id: randomUUID(),
    team_id: actor.teamId,
    task_id: taskId,
    actor_member_id: actor.memberId,
    actor_name: actor.displayName,
    kind,
    summary,
    in_reply_to_id: inReplyTo,
    created_at: now()
  };
}

function taskById(tasks, taskId) {
  return tasks.find((task) => task.id === taskId);
}

function now() {
  return new Date().toISOString();
}
