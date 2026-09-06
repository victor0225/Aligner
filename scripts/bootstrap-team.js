import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "../src/config.js";
import { hashToken } from "../src/relay/auth.js";

const [teamKey, leadName, memberName] = process.argv.slice(2);
if (!teamKey || !leadName || !memberName) {
  console.error("사용법: pnpm bootstrap-team -- <team-key> <lead-name> <member-name>");
  process.exit(1);
}

const config = getConfig();
const client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, { auth: { persistSession: false } });
const { data: team, error: teamError } = await client
  .from("relay_teams")
  .insert({ team_key: teamKey })
  .select()
  .single();
if (teamError) throw teamError;

const tokens = [
  { member_key: "lead", display_name: leadName, role: "lead", token: makeToken() },
  { member_key: "member-1", display_name: memberName, role: "member", token: makeToken() }
];
const { error: memberError } = await client.from("relay_members").insert(
  tokens.map(({ token, ...member }) => ({ ...member, team_id: team.id, token_hash: hashToken(token) }))
);
if (memberError) throw memberError;

console.log("팀 생성 완료. 이 token들은 지금 한 번만 표시됩니다. 안전한 비밀 저장소에 보관하세요.");
for (const entry of tokens) console.log(`${entry.role.toUpperCase()}_TOKEN=${entry.token}`);

function makeToken() {
  return `alr_${randomBytes(32).toString("base64url")}`;
}
