# Aligner Relay MVP 실행 계획

> **실행 원칙:** 각 단계는 먼저 실패하는 테스트를 추가하고, 최소 구현으로 통과시킨 뒤 전체 테스트를 실행한다.

## 1. 프로젝트 뼈대와 이벤트 검증

**파일:** `package.json`, `src/relay/event.js`, `tests/event.test.js`

- Node ESM, Express, Supabase, MCP SDK 의존성을 추가한다.
- 세 intent와 최소 payload 허용 목록, 길이/URL/금지 필드 검증을 구현한다.
- 멤버 token에서 team/member를 파생하는 모델을 테스트한다.

## 2. 이벤트 서비스와 멱등성

**파일:** `src/relay/service.js`, `src/relay/memory-store.js`, `tests/service.test.js`

- `(sender_member_id, event_id)` 재시도 시 기존 이벤트를 반환한다.
- lead inbox와 member sent ledger 조회를 역할별로 제한한다.
- `new` inbox는 delivered 전환, `open`은 읽기 전용임을 테스트한다.

## 3. Supabase 저장소와 migration

**파일:** `supabase/migrations/0001_relay.sql`, `src/relay/supabase-store.js`, `scripts/bootstrap-team.js`

- 기존 테이블을 삭제하지 않는 독립 `relay_*` schema를 만든다.
- token hash와 bootstrap 출력 규칙을 구현한다.

## 4. MCP 도구와 HTTP 서버

**파일:** `src/mcp.js`, `src/server.js`, `tests/server.test.js`

- bearer auth를 포함한 Streamable HTTP MCP endpoint를 연결한다.
- `raise_event`와 `read_inbox` 설명이 주도권 정책을 표현하도록 한다.
- `/health`를 테스트한다.

## 5. 신뢰 보드

**파일:** `src/trust-board.js`, `src/server.js`, `tests/trust-board.test.js`

- token 기반 login form과 HMAC cookie session을 만든다.
- 팀원은 자기 이벤트, 팀장은 열린 팀 이벤트만 볼 수 있게 한다.
- 저장된 요약만 보이며 원문 대화 관련 필드가 없음을 확인한다.

## 6. 로컬 E2E와 운영 문서

**파일:** `README.md`, `.env.example`, `AGENTS.md`, `tests/e2e.test.js`

- raise → ledger → inbox 흐름을 메모리 저장소로 검증한다.
- Codex MCP 설정과 Horizon check/authority boundary 지침을 문서화한다.

## 7. 실제 서비스 전환

- Supabase SQL editor에서 migration을 실행한다.
- bootstrap token을 1회 발급하고 Render env에 필요한 값만 설정한다.
- Render source를 Aligner로 바꾼 뒤 `/health`, trust board, MCP E2E를 확인한다.
- 이 단계의 DB 실행과 Render 저장은 각각 실행 직전에 사용자에게 확인을 받는다.
