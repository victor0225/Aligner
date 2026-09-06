-- Aligner Relay: independent tables. Existing Subjector data is untouched.
create table if not exists public.relay_teams (
  id uuid primary key default gen_random_uuid(),
  team_key text not null unique check (team_key ~ '^[a-z0-9-]{3,64}$'),
  delegation_boundary text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.relay_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  member_key text not null check (member_key ~ '^[a-z0-9-]{2,64}$'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  role text not null check (role in ('member', 'lead')),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (team_id, member_key)
);

create table if not exists public.relay_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  sender_member_id uuid not null references public.relay_members(id) on delete restrict,
  sender_name text not null,
  intent text not null check (intent in ('idea_share', 'review_request', 'decision_handoff')),
  task_title text not null check (char_length(task_title) between 1 and 160),
  summary text not null check (char_length(summary) between 1 and 300),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 3),
  impact text not null check (char_length(impact) between 1 and 300),
  evidence_link text,
  sensitivity text not null check (sensitivity = 'internal'),
  continuing_work text,
  held_action text,
  created_at timestamptz not null default now(),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'delivered', 'failed')),
  delivered_at timestamptz,
  unique (sender_member_id, event_id),
  check ((intent = 'decision_handoff' and held_action is not null) or (intent <> 'decision_handoff'))
);

create index if not exists relay_events_team_status_created_idx
  on public.relay_events (team_id, delivery_status, created_at desc);
create index if not exists relay_events_sender_created_idx
  on public.relay_events (sender_member_id, created_at desc);

alter table public.relay_teams enable row level security;
alter table public.relay_members enable row level security;
alter table public.relay_events enable row level security;
