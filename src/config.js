export function getConfig(env = process.env) {
  const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RELAY_SESSION_SECRET"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) throw new Error(`필수 환경 변수가 없습니다: ${missing.join(", ")}`);
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    sessionSecret: env.RELAY_SESSION_SECRET,
    port: Number(env.PORT || 3000)
  };
}
