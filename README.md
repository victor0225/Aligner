# Aligner

팀원 에이전트가 필요한 판단 신호만 팀장에게 전달하는 Codex-first Relay입니다. 업무 감시, transcript 수집, 원격 제어 도구가 아닙니다.

## 이 MVP가 하는 일

1. 팀원 Codex가 `raise_event`로 `idea_share`, `review_request`, `decision_handoff` 중 하나를 발행합니다.
2. Relay가 최소 스키마만 저장하고, 같은 `event_id` 재시도는 중복 생성하지 않습니다.
3. 팀원은 `/trust-board`에서 정확히 무엇이 외부로 전송됐는지 확인합니다.
4. 팀장은 자신의 Codex에서 `read_inbox`를 실행합니다.

원문 대화, 코드, 터미널 출력, API key, 개인 메모는 입력 스키마에 없으며 저장하지 않습니다.

## 실행

```powershell
pnpm install
pnpm test
node --env-file=.env src/server.js
```

Supabase SQL editor에서 [`supabase/migrations/0001_relay.sql`](supabase/migrations/0001_relay.sql)를 실행한 뒤, `.env.example`을 복사해 `.env`를 채웁니다. 그 다음 최초 팀을 한 번 만듭니다.

```powershell
pnpm bootstrap-team -- demo-team "팀장 이름" "팀원 이름"
```

출력되는 두 token은 한 번만 표시됩니다. 각 사람에게 자기 token만 안전하게 전달합니다. DB에는 token 원문이 아닌 SHA-256 hash만 저장됩니다.

## Codex MCP 설정

팀원과 팀장은 각자의 Codex MCP 설정에 다음처럼 같은 Relay URL과 **자신의 token**을 넣습니다. 팀원 token은 `raise_event`, 팀장 token은 `read_inbox`에만 권한이 있습니다.

```toml
[mcp_servers.aligner]
url = "https://YOUR-RENDER-SERVICE.onrender.com/mcp"
bearer_token_env_var = "ALIGNER_TOKEN"
```

각자의 환경에 `ALIGNER_TOKEN`을 설정하고 Codex를 다시 시작합니다. 팀장에게 즉시 푸시하는 대신, 팀장은 전용 Codex Relay task 또는 일반 Codex 대화에서 `read_inbox(mode: "new")`를 실행합니다.

## 권한 원칙

팀원이 Task를 기본적으로 주도합니다. `review_request`는 검토를 요청해도 팀원 주도권이 유지되는 경우이고, `decision_handoff`만 실제 갈림길의 특정 결정을 팀장에게 넘깁니다. 팀장은 모든 작업의 승인 게이트가 아닙니다.

## 배포 환경 변수

Render에는 다음 네 값만 필요합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RELAY_SESSION_SECRET` (긴 무작위 값)
- `PORT` (Render가 자동 제공하면 별도 설정 불필요)

Slack은 이 v0의 핵심 경로가 아니므로 설정하지 않습니다. 기존 Subjector Slack 설정도 건드리지 않습니다.
