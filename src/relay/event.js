const allowedKeys = new Set([
  "event_id",
  "intent",
  "task_title",
  "summary",
  "options",
  "impact",
  "evidence_link",
  "sensitivity",
  "continuing_work",
  "held_action"
]);

const intents = new Set(["idea_share", "review_request", "decision_handoff"]);
const sensitivities = new Set(["internal"]);

export function validateEventInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("이벤트는 객체여야 합니다.");
  }

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) throw new Error(`허용되지 않는 필드: ${key}`);
  }

  requiredText(input, "event_id", 100);
  if (!isUuid(input.event_id)) throw new Error("event_id는 UUID여야 합니다.");
  if (!intents.has(input.intent)) throw new Error("intent가 올바르지 않습니다.");
  requiredText(input, "task_title", 160);
  requiredText(input, "summary", 300);
  requiredText(input, "impact", 300);
  if (!sensitivities.has(input.sensitivity)) throw new Error("sensitivity가 올바르지 않습니다.");

  if (input.options !== undefined) {
    if (!Array.isArray(input.options) || input.options.length > 3) {
      throw new Error("options는 최대 3개여야 합니다.");
    }
    input.options.forEach((option) => requiredText({ option }, "option", 160));
  }

  optionalText(input, "continuing_work", 300);
  optionalText(input, "held_action", 300);

  if (input.intent === "decision_handoff" && !input.held_action) {
    throw new Error("decision_handoff에는 held_action이 필요합니다.");
  }

  if (input.evidence_link !== undefined) {
    try {
      const url = new URL(input.evidence_link);
      if (url.protocol !== "https:") throw new Error();
    } catch {
      throw new Error("evidence_link는 https URL이어야 합니다.");
    }
  }

  return structuredClone(input);
}

function requiredText(input, key, maxLength) {
  if (typeof input[key] !== "string" || !input[key].trim() || input[key].length > maxLength) {
    throw new Error(`${key}는 비어 있지 않은 ${maxLength}자 이하 문자열이어야 합니다.`);
  }
}

function optionalText(input, key, maxLength) {
  if (input[key] !== undefined) requiredText(input, key, maxLength);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
