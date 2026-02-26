-- Core tables for requests, plans, and feedback

create table if not exists trip_requests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  origin text,
  start_date date not null,
  days int not null,
  travelers int not null,
  budget_min numeric,
  budget_max numeric,
  budget_text text,
  preferences jsonb not null default '[]',
  pace text not null,
  constraints jsonb not null default '[]',
  raw_input jsonb not null
);

create table if not exists trip_plans (
  id uuid primary key,
  request_id uuid not null references trip_requests(id),
  created_at timestamptz not null default now(),
  model_version text,
  top_destinations jsonb not null,
  daily_plan jsonb not null,
  budget_breakdown jsonb not null,
  warnings jsonb not null default '[]'
);

create table if not exists feedback (
  id uuid primary key,
  plan_id uuid not null references trip_plans(id),
  created_at timestamptz not null default now(),
  rating int,
  tags jsonb not null default '[]',
  comment text
);

-- Auth + preferences
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  code_salt text not null,
  purpose text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists user_search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  query jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists user_memory_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  source text,
  content text not null,
  embedding vector(1536) not null,
  created_at timestamptz not null default now()
);
