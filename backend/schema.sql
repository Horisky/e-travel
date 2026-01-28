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