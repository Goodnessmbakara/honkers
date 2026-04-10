// ---------------------------------------------------------------------------
// Markets API routes (COM-1, FR-M-1, FR-M-2).
//
// GET /api/markets              — list all markets (filterable by status)
// GET /api/markets/:marketId    — single market detail
// GET /api/markets/:marketId/prices — price history (AMM snapshots)
// POST /api/markets/:marketId/metadata — admin: set question/criteria text
// ---------------------------------------------------------------------------

import { Router, Request, Response } from "express";
import { query, queryOne, execute } from "../../db/client.js";
import type { MarketListItem, MarketDetail } from "../../types/index.js";

export const marketsRouter = Router();

/**
 * GET /api/markets
 * Query params:
 *   - status: open|halted|resolution_proposed|disputed|resolved|voided (optional)
 *   - limit: max rows (default 50, max 200)
 *   - offset: pagination offset (default 0)
 */
marketsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    let sql = `
      SELECT
        m.market_id,
        COALESCE(md.question, m.question_text) AS question_text,
        m.status,
        m.end_date,
        m.creator,
        m.bond_amount,
        snap.price_yes,
        snap.price_no
      FROM markets m
      LEFT JOIN market_metadata md ON md.market_id = m.market_id
      LEFT JOIN LATERAL (
        SELECT price_yes, price_no
        FROM amm_snapshots
        WHERE amm_snapshots.market_id = m.market_id
        ORDER BY captured_at DESC
        LIMIT 1
      ) snap ON true
    `;

    const params: unknown[] = [];
    if (status) {
      params.push(status);
      sql += ` WHERE m.status = $${params.length}`;
    }

    sql += ` ORDER BY m.end_date ASC`;
    params.push(limit);
    sql += ` LIMIT $${params.length}`;
    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const rows = await query(sql, params);

    const markets: MarketListItem[] = rows.map((r) => ({
      marketId: r.market_id,
      questionText: r.question_text,
      status: r.status,
      endDate: r.end_date,
      priceYes: r.price_yes ?? null,
      priceNo: r.price_no ?? null,
      volume: null, // TODO: aggregate from trade events when available
      creator: r.creator,
    }));

    res.json({ markets, limit, offset });
  } catch (err) {
    console.error("[api] GET /markets error:", err);
    res.status(500).json({ error: "Failed to fetch markets" });
  }
});

/**
 * GET /api/markets/:marketId
 * Full market detail including resolution info.
 */
marketsRouter.get("/:marketId", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    const market = await queryOne(
      `SELECT
         m.*,
         COALESCE(md.question, m.question_text) AS question_text,
         COALESCE(md.criteria, m.criteria_text) AS criteria_text,
         COALESCE(md.source_url, m.source_text) AS source_text
       FROM markets m
       LEFT JOIN market_metadata md ON md.market_id = m.market_id
       WHERE m.market_id = $1`,
      [marketId],
    );

    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const resolution = await queryOne(
      "SELECT * FROM resolutions WHERE market_id = $1",
      [marketId],
    );

    const latestSnap = await queryOne(
      `SELECT price_yes, price_no
       FROM amm_snapshots
       WHERE market_id = $1
       ORDER BY captured_at DESC
       LIMIT 1`,
      [marketId],
    );

    const detail: MarketDetail = {
      marketId: market.market_id,
      questionText: market.question_text,
      status: market.status,
      endDate: market.end_date,
      priceYes: latestSnap?.price_yes ?? null,
      priceNo: latestSnap?.price_no ?? null,
      volume: null,
      creator: market.creator,
      criteriaText: market.criteria_text,
      sourceText: market.source_text,
      bondAmount: market.bond_amount,
      resolution: resolution ?? null,
      createdAt: market.created_at,
    };

    res.json(detail);
  } catch (err) {
    console.error("[api] GET /markets/:id error:", err);
    res.status(500).json({ error: "Failed to fetch market detail" });
  }
});

/**
 * GET /api/markets/:marketId/prices
 * AMM price history for charting.
 * Query params:
 *   - limit: max rows (default 100, max 1000)
 */
marketsRouter.get("/:marketId/prices", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 100, 1000);

    const snapshots = await query(
      `SELECT price_yes, price_no, reserve_yes, reserve_no, block_number, captured_at
       FROM amm_snapshots
       WHERE market_id = $1
       ORDER BY captured_at DESC
       LIMIT $2`,
      [marketId, limit],
    );

    res.json({ marketId, snapshots });
  } catch (err) {
    console.error("[api] GET /markets/:id/prices error:", err);
    res.status(500).json({ error: "Failed to fetch price history" });
  }
});

/**
 * POST /api/markets/:marketId/metadata
 * Admin-only: set human-readable question text and resolution criteria.
 * Body: { question: string, criteria?: string, sourceUrl?: string }
 *
 * NOTE: In production this should be behind auth middleware.
 * Phase 1 uses a simple shared secret or is restricted to admin tooling.
 */
marketsRouter.post("/:marketId/metadata", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;
    const { question, criteria, sourceUrl } = req.body;

    if (!question || typeof question !== "string") {
      res.status(400).json({ error: "question is required" });
      return;
    }

    // Verify market exists
    const exists = await queryOne(
      "SELECT 1 FROM markets WHERE market_id = $1",
      [marketId],
    );
    if (!exists) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    await execute(
      `INSERT INTO market_metadata (market_id, question, criteria, source_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (market_id) DO UPDATE
       SET question = $2, criteria = $3, source_url = $4, updated_at = NOW()`,
      [marketId, question, criteria ?? null, sourceUrl ?? null],
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("[api] POST /markets/:id/metadata error:", err);
    res.status(500).json({ error: "Failed to update metadata" });
  }
});
