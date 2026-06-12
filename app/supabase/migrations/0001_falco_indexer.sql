-- Falco indexer schema — adapted from Kestrel for EVM/Celo events.
--
-- Tables:
--   markets  — one row per FalcoCore Market (denormalized header).
--   events   — append-only timeline of decoded FalcoCore contract events.
--   agents   — per-address roll-up maintained by the indexer.
--   cursors  — last indexed block per chain for resume.

create extension if not exists pgcrypto;

-- ── markets ────────────────────────────────────────────────────────────────

create table if not exists public.markets (
  market_id       integer  primary key,
  open_ts         bigint,
  close_ts        bigint,
  status          text,          -- 'pending' | 'open' | 'halted' | 'closed'
  strike_price    bigint,        -- Pyth price ×10^8
  close_price     bigint,
  winner          text,          -- 'yes' | 'no' | null
  yes_reserve     bigint,
  no_reserve      bigint,
  oracle_feed     text,
  opened_tx       text,
  closed_tx       text,
  created_tx      text,
  updated_at      timestamptz not null default now()
);

-- ── events ────────────────────────────────────────────────────────────────

create table if not exists public.events (
  id              uuid    primary key default gen_random_uuid(),
  tx_hash         text    not null,
  log_index       integer not null default 0,
  block_number    bigint,
  block_time      timestamptz,
  market_id       integer references public.markets(market_id) on delete set null,
  kind            text    not null,   -- e.g. 'BetPlaced', 'MarketOpened', 'PolicyUpdated'
  actor           text,               -- agent address
  args            jsonb   not null default '{}'::jsonb,
  success         boolean not null default true,
  inserted_at     timestamptz not null default now(),
  unique (tx_hash, log_index)
);

create index if not exists events_market_id_block_time_idx
  on public.events (market_id, block_time desc nulls last);

create index if not exists events_actor_block_time_idx
  on public.events (actor, block_time desc nulls last);

create index if not exists events_kind_inserted_at_idx
  on public.events (kind, inserted_at desc);

-- ── agents ────────────────────────────────────────────────────────────────

create table if not exists public.agents (
  owner_address   text    primary key,
  role            text,               -- 'market_ops' | 'trader' | 'risk_lp'
  label           text,
  current_policy  jsonb,
  current_balance bigint,
  registered_at   timestamptz,
  last_event_at   timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists agents_role_last_event_idx
  on public.agents (role, last_event_at desc nulls last);

-- ── cursors ────────────────────────────────────────────────────────────────

create table if not exists public.cursors (
  chain           text    primary key,  -- 'celo-sepolia'
  last_block      bigint  not null default 0,
  updated_at      timestamptz not null default now()
);

insert into public.cursors (chain, last_block) values ('celo-sepolia', 0)
  on conflict do nothing;

-- ── Realtime ────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.markets;
alter publication supabase_realtime add table public.agents;

-- ── RLS (public read, service role writes) ──────────────────────────────────

alter table public.markets enable row level security;
alter table public.events  enable row level security;
alter table public.agents  enable row level security;
alter table public.cursors enable row level security;

drop policy if exists "markets are public" on public.markets;
drop policy if exists "events are public"  on public.events;
drop policy if exists "agents are public"  on public.agents;
drop policy if exists "cursors are public" on public.cursors;

create policy "markets are public" on public.markets for select using (true);
create policy "events are public"  on public.events  for select using (true);
create policy "agents are public"  on public.agents  for select using (true);
create policy "cursors are public" on public.cursors for select using (true);
