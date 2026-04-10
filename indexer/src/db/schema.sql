-- ---------------------------------------------------------------------------
-- PostgreSQL schema for the Honkers indexer.
-- Stores PUBLIC chain events and market metadata only.
-- No plaintext private notes are ever transmitted or stored here (COM-2).
-- ---------------------------------------------------------------------------

-- Indexer watermark — tracks the last processed block per source.
CREATE TABLE IF NOT EXISTS indexer_state (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Markets — one row per on-chain market, populated from MarketFactory events.
CREATE TABLE IF NOT EXISTS markets (
    id              SERIAL PRIMARY KEY,
    market_id       TEXT UNIQUE NOT NULL,          -- on-chain Field as hex
    question_hash   TEXT NOT NULL,
    question_text   TEXT,                           -- manually populated off-chain
    criteria_hash   TEXT NOT NULL,
    criteria_text   TEXT,
    source_hash     TEXT NOT NULL,
    source_text     TEXT,
    creator         TEXT NOT NULL,                  -- AztecAddress hex
    end_date        TIMESTAMPTZ NOT NULL,
    bond_amount     NUMERIC NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',   -- open|halted|resolution_proposed|disputed|resolved|voided
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markets_status ON markets (status);
CREATE INDEX IF NOT EXISTS idx_markets_end_date ON markets (end_date);

-- Resolutions — one row per market, tracks oracle resolution lifecycle.
CREATE TABLE IF NOT EXISTS resolutions (
    id                  SERIAL PRIMARY KEY,
    market_id           TEXT UNIQUE NOT NULL REFERENCES markets(market_id),
    proposed_outcome    SMALLINT,                   -- 1 = YES, 0 = NO
    proposed_at         TIMESTAMPTZ,
    finalised_at        TIMESTAMPTZ,
    state               SMALLINT NOT NULL DEFAULT 0, -- 0=unresolved,1=proposed,2=finalised,3=disputed,4=voided
    dispute_bond        NUMERIC,
    disputer            TEXT,                        -- AztecAddress hex
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AMM snapshots — periodic captures of reserves and implied prices.
CREATE TABLE IF NOT EXISTS amm_snapshots (
    id              SERIAL PRIMARY KEY,
    market_id       TEXT NOT NULL REFERENCES markets(market_id),
    reserve_yes     NUMERIC NOT NULL,
    reserve_no      NUMERIC NOT NULL,
    price_yes       DOUBLE PRECISION NOT NULL,      -- 0.0 .. 1.0
    price_no        DOUBLE PRECISION NOT NULL,
    block_number    BIGINT NOT NULL,
    captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_amm_snapshots_market ON amm_snapshots (market_id, captured_at DESC);

-- Market metadata — admin-managed question text and resolution criteria.
-- Separate table so admins can update text without touching chain-derived rows.
CREATE TABLE IF NOT EXISTS market_metadata (
    market_id       TEXT PRIMARY KEY REFERENCES markets(market_id),
    question        TEXT NOT NULL,
    criteria        TEXT,
    source_url      TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated-at trigger helper.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_markets_updated_at') THEN
        CREATE TRIGGER trg_markets_updated_at
            BEFORE UPDATE ON markets
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_resolutions_updated_at') THEN
        CREATE TRIGGER trg_resolutions_updated_at
            BEFORE UPDATE ON resolutions
            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    END IF;
END;
$$;
