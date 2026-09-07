-- Aligner Task Board: additive migration. Existing relay tables remain untouched.
create table if not exists public.aligner_tasks (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  owner_member_id uuid not null references public.relay_members(id) on delete restrict,
  owner_name text not null check (char_length(owner_name) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  goal text not null check (char_length(goal) between 1 and 200),
  context text not null check (char_length(context) between 1 and 500),
  completion_criteria text not null check (char_length(completion_criteria) between 1 and 300),
  primary_status text not null default 'review' check (primary_status in ('review', 'idea', 'decision', 'neutral')),
  is_in_progress boolean not null default true,
  progress_summary text check (progress_summary is null or char_length(progress_summary) between 1 and 300),
  next_step text check (next_step is null or char_length(next_step) between 1 and 300),
  result text check (result is null or char_length(result) between 1 and 300),
  evidence_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.aligner_task_records (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  task_id uuid not null references public.aligner_tasks(id) on delete cascade,
  actor_member_id uuid not null references public.relay_members(id) on delete restrict,
  actor_name text not null check (char_length(actor_name) between 1 and 80),
  kind text not null check (kind in ('idea_share', 'review_request', 'review_result', 'decision_request', 'decision_record', 'transfer_request', 'transfer_accepted', 'transfer_declined', 'progress_update', 'completion')),
  summary text check (summary is null or char_length(summary) between 1 and 300),
  target_member_id uuid references public.relay_members(id) on delete restrict,
  impact text check (impact is null or char_length(impact) between 1 and 300),
  options jsonb check (options is null or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) <= 3)),
  evidence_link text,
  current_context text check (current_context is null or char_length(current_context) between 1 and 300),
  next_step text check (next_step is null or char_length(next_step) between 1 and 300),
  completed_work text check (completed_work is null or char_length(completed_work) between 1 and 300),
  requested_work text check (requested_work is null or char_length(requested_work) between 1 and 300),
  result text check (result is null or char_length(result) between 1 and 300),
  in_reply_to_id uuid references public.aligner_task_records(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.aligner_task_assignments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  task_id uuid not null references public.aligner_tasks(id) on delete cascade,
  member_id uuid not null references public.relay_members(id) on delete restrict,
  member_name text not null check (char_length(member_name) between 1 and 80),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists aligner_task_assignments_one_current_idx
  on public.aligner_task_assignments (task_id) where ended_at is null;

create table if not exists public.aligner_drafts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  owner_member_id uuid not null references public.relay_members(id) on delete cascade,
  kind text not null check (kind in ('task', 'decision_request', 'transfer_request', 'completion')),
  task_id uuid references public.aligner_tasks(id) on delete cascade,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz
);

create table if not exists public.aligner_notices (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.relay_teams(id) on delete cascade,
  member_id uuid not null references public.relay_members(id) on delete cascade,
  task_id uuid not null references public.aligner_tasks(id) on delete cascade,
  record_id uuid references public.aligner_task_records(id) on delete cascade,
  section text not null check (section in ('decision', 'execution', 'review', 'transfer')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists aligner_tasks_team_active_idx on public.aligner_tasks (team_id, completed_at, updated_at desc);
create index if not exists aligner_task_records_task_created_idx on public.aligner_task_records (task_id, created_at);
create index if not exists aligner_notices_member_unread_idx on public.aligner_notices (member_id, read_at, created_at desc);

alter table public.aligner_tasks enable row level security;
alter table public.aligner_task_records enable row level security;
alter table public.aligner_task_assignments enable row level security;
alter table public.aligner_drafts enable row level security;
alter table public.aligner_notices enable row level security;
