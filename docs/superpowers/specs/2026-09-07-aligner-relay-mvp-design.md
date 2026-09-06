# Aligner Relay MVP 설계

## 목적

Aligner는 팀원의 에이전트가 작업 중 정리한 **판단 신호만** 팀장에게 전달하는 Codex-first Relay다. 진행 상황 감시나 원격 제어가 아니라, 팀원이 자신의 담당 Task를 주도하다가 필요한 순간에만 판단을 공유·검토·이관하도록 돕는다.

## 세 가지 intent

| 내부 값 | 사용자 표현 | 의미 | 주도권 |
| --- | --- | --- | --- |
| `idea_share` | 아이디어 있어요 | 미래에 갈림길이 될 수 있는 관찰·확장안 | 팀원에게 유지 |
| `review_request` | 검토해주세요 | 팀원이 권고안을 만들었고, 반대가 없으면 계속 실행 | 팀원에게 유지 |
| `decision_handoff` | 결정 필요해요 | 실제 갈림길에서 팀장 판단이 필요한 선택 | 해당 결정만 팀장에게 이관 |

`decision_handoff`는 영향받는 행동만 잠시 멈추고, 독립적인 나머지 작업은 계속한다. 팀장은 모든 작업의 승인 게이트가 아니다.

## 신뢰 경계

- 원문 프롬프트, 전체 대화, 코드, 터미널 출력, API 키, 개인 메모는 전송·저장하지 않는다.
- 입력은 허용 목록 스키마로 검증한다. 의심스러운 금지 필드와 너무 긴 payload는 거부한다.
- 팀/멤버 식별은 bearer token으로만 파생한다. 호출자가 `team_id`, `member_id`를 지정할 수 없다.
- 팀원은 신뢰 보드에서 실제 외부로 저장된 이벤트 원문을 확인한다.
- 팀장은 팀원의 세션·PC·파일에 read/write 권한을 얻지 않는다.
- 팀장의 답변을 팀원 에이전트에 자동 주입하지 않는다.

## 이벤트 모델

필수: `event_id`, `intent`, `task_title`, `summary`, `impact`, `sensitivity`, `created_at`.

선택: `options`(최대 3개), `evidence_link`(https URL), `continuing_work`.

`decision_handoff`에는 무엇을 보류했는지 설명하는 `held_action`이 필수다. `summary`는 300자, option은 160자로 제한한다. 이벤트는 `(sender_member_id, event_id)`로 멱등 처리한다.

## 화면과 도구

- `POST /mcp`: Streamable HTTP MCP. `raise_event`, `read_inbox`를 제공한다.
- `GET /trust-board`: 브라우저에서 팀원은 자신이 보낸 이벤트, 팀장은 팀의 열린 이벤트를 읽는다.
- `POST /trust-board/session`: bearer token으로 짧은 서명 세션을 만든다. token을 URL에 넣지 않는다.
- `GET /health`: 배포 상태 확인.

`read_inbox(mode: "new")`는 신규 이벤트를 반환하고 delivered 처리한다. `mode: "open"`은 읽기 전용이다.

## 저장소와 운영

기존 Subjector 데이터는 건드리지 않는다. 같은 Supabase 프로젝트에 `relay_teams`, `relay_members`, `relay_events`만 새로 만든다. RLS를 켜고 앱 서버의 service-role key만 DB에 접근한다. 최초 팀/멤버 token은 bootstrap script가 한 번 발급하고, DB에는 SHA-256 hash만 저장한다.

Render의 기존 유료 서비스는 로컬 검증과 Supabase migration 확인 뒤에만 GitHub source를 `victor0225/Aligner`로 바꾼다. Slack은 v0의 필수 경로가 아니므로 기존 webhook 설정은 바꾸지 않는다.
