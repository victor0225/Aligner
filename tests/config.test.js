import test from "node:test";
import assert from "node:assert/strict";

import { getConfig } from "../src/config.js";

test("기본 공개 주소는 기존 idea-cruise Render 주소를 이어받고 환경 변수로 바꿀 수 있다", () => {
  const base = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key", RELAY_SESSION_SECRET: "secret" };
  assert.equal(getConfig(base).publicBaseUrl, "https://subjector.onrender.com");
  assert.equal(getConfig({ ...base, PUBLIC_BASE_URL: "https://aligner.example.com/" }).publicBaseUrl, "https://aligner.example.com");
});
