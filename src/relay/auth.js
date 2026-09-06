import { createHash } from "node:crypto";

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticate(store, authorization) {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("Bearer token이 필요합니다.");
  const actor = await store.findActorByTokenHash(hashToken(token));
  if (!actor) throw new Error("유효하지 않은 token입니다.");
  return actor;
}
