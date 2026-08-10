CREATE TABLE recharge_plan (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  base_bonus NUMERIC(12, 2) NOT NULL CHECK (base_bonus >= 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
  sort INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX recharge_plan_active_sort_idx
  ON recharge_plan(status, sort);

CREATE TABLE recharge_campaign (
  id VARCHAR(64) PRIMARY KEY,
  activity_id VARCHAR(64) UNIQUE,
  name VARCHAR(100) NOT NULL,
  threshold_amount NUMERIC(12, 2) NOT NULL CHECK (threshold_amount > 0),
  bonus_amount NUMERIC(12, 2) NOT NULL CHECK (bonus_amount >= 0),
  priority INTEGER NOT NULL DEFAULT 0,
  effect_mode VARCHAR(20) NOT NULL DEFAULT 'override'
    CHECK (effect_mode IN ('override')),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time <= end_time)
);

CREATE INDEX recharge_campaign_quote_lookup_idx
  ON recharge_campaign(status, approval_status, priority DESC, activity_id DESC);

CREATE TABLE recharge_quote (
  id UUID PRIMARY KEY,
  plan_id VARCHAR(64) NOT NULL REFERENCES recharge_plan(id),
  campaign_id VARCHAR(64) REFERENCES recharge_campaign(id),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  base_bonus NUMERIC(12, 2) NOT NULL CHECK (base_bonus >= 0),
  campaign_bonus NUMERIC(12, 2) NOT NULL CHECK (campaign_bonus >= 0),
  final_bonus NUMERIC(12, 2) NOT NULL CHECK (final_bonus >= 0),
  total_amount NUMERIC(12, 2) NOT NULL,
  effect_mode VARCHAR(20) NOT NULL CHECK (effect_mode IN ('none', 'override')),
  rule_snapshot JSONB NOT NULL,
  expire_time TIMESTAMPTZ NOT NULL,
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (total_amount = amount + final_bonus)
);

CREATE INDEX recharge_quote_plan_created_idx
  ON recharge_quote(plan_id, create_time DESC);
