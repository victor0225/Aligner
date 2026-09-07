export const TASK_STATUSES = new Set(["review", "idea", "decision", "neutral"]);

const taskFields = new Set(["title", "goal", "context", "completion_criteria"]);
const recordFields = new Set([
  "kind",
  "summary",
  "target_member_id",
  "impact",
  "options",
  "evidence_link",
  "current_context",
  "next_step",
  "completed_work",
  "requested_work",
  "result"
]);

const recordKinds = new Set([
  "idea_share",
  "review_request",
  "review_result",
  "decision_request",
  "decision_record",
  "transfer_request",
  "progress_update",
  "completion"
]);

export function validateTaskDraft(input) {
  objectOnly(input, "Task 초안");
  onlyFields(input, taskFields);
  requiredText(input, "title", 160);
  requiredText(input, "goal", 200);
  requiredText(input, "context", 500);
  requiredText(input, "completion_criteria", 300);
  return structuredClone(input);
}

export function validateRecordDraft(input) {
  objectOnly(input, "기록 초안");
  onlyFields(input, recordFields);
  requiredText(input, "kind", 64);
  if (!recordKinds.has(input.kind)) throw new Error("kind가 올바르지 않습니다.");

  if (input.kind === "progress_update") {
    requiredText(input, "current_context", 300);
    requiredText(input, "next_step", 300);
  } else if (input.kind === "completion") {
    requiredText(input, "result", 300);
  } else {
    requiredText(input, "summary", 300);
  }

  if (input.kind === "review_request" || input.kind === "decision_request" || input.kind === "transfer_request") {
    requiredText(input, "target_member_id", 100);
  }
  if (input.kind === "decision_request") {
    requiredText(input, "impact", 300);
    optionalOptions(input);
  }
  if (input.kind === "transfer_request") {
    requiredText(input, "completed_work", 300);
    requiredText(input, "requested_work", 300);
  }
  optionalUrl(input, "evidence_link");
  return structuredClone(input);
}

function objectOnly(input, label) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(`${label}은 객체여야 합니다.`);
}

function onlyFields(input, allowed) {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`허용되지 않는 필드: ${key}`);
  }
}

function requiredText(input, key, maxLength) {
  if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > maxLength) {
    throw new Error(`${key}는 비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
}

function optionalOptions(input) {
  if (input.options === undefined) return;
  if (!Array.isArray(input.options) || input.options.length > 3) throw new Error("options는 최대 3개여야 합니다.");
  input.options.forEach((option) => requiredText({ option }, "option", 160));
}

function optionalUrl(input, key) {
  if (input[key] === undefined) return;
  try {
    const url = new URL(input[key]);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`${key}는 https URL이어야 합니다.`);
  }
}
