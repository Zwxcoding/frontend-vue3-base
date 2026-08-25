CREATE TABLE member (
  id UUID PRIMARY KEY,
  openid VARCHAR(128) UNIQUE,
  mobile VARCHAR(32),
  name VARCHAR(100),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'inactive')),
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE member_account (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL UNIQUE REFERENCES member(id),
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'frozen', 'closed')),
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  update_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_transaction (
  id UUID PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES member(id),
  account_id UUID NOT NULL REFERENCES member_account(id),
  transaction_type VARCHAR(30) NOT NULL
    CHECK (transaction_type IN ('RECHARGE', 'CONSUME', 'REFUND')),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  before_balance NUMERIC(12, 2) NOT NULL CHECK (before_balance >= 0),
  after_balance NUMERIC(12, 2) NOT NULL CHECK (after_balance >= 0),
  reference_type VARCHAR(30) NOT NULL,
  reference_id VARCHAR(128) NOT NULL,
  create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reference_type, reference_id, transaction_type)
);

CREATE INDEX account_transaction_member_time_idx
  ON account_transaction(member_id, create_time DESC);

CREATE INDEX account_transaction_account_time_idx
  ON account_transaction(account_id, create_time DESC);
