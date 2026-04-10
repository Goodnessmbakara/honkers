// ---------------------------------------------------------------------------
// Resolution API routes.
//
// GET /api/resolution/:marketId       — resolution status + timing info
// GET /api/resolution/pending         — all markets awaiting resolution
// GET /api/resolution/void-eligible   — markets past 72h grace period
// ---------------------------------------------------------------------------

import { Router, Request, Response } from "express";
import { query, queryOne } from "../../db/client.js";
import type { ResolutionStatus } from "../../types/index.js";
import { ResolutionState } from "../../types/index.js";

export const resolutionRouter = Router();

/** Challenge window duration: 24 hours in seconds. */
const CHALLENGE_WINDOW_SECS = 86_400;
/** Grace period: 72 hours in seconds. */
const GRACE_PERIOD_SECS = 259_200;

/**
 * GET /api/resolution/:marketId
 * Full resolution status including timing.
 */
resolutionRouter.get("/:marketId", async (req: Request, res: Response) => {
  try {
    const { marketId } = req.params;

    const row = await queryOne(
      `SELECT r.*, m.end_date
       FROM resolutions r
       JOIN markets m ON m.market_id = r.market_id
       WHERE r.market_id = $1`,
      [marketId],
    );

    if (!row) {
      res.status(404).json({ error: "Resolution not found" });
      return;
    }

    const now = Date.now() / 1000;

    // Challenge window remaining
    let challengeSecondsRemaining: number | null = null;
    if (row.state === ResolutionState.Proposed && row.proposed_at) {
      const proposedAtSecs = new Date(row.proposed_at).getTime() / 1000;
      const deadline = proposedAtSecs + CHALLENGE_WINDOW_SECS;
      challengeSecondsRemaining = Math.max(0, Math.floor(deadline - now));
    }

    // Grace period / void eligibility
    const endDateSecs = new Date(row.end_date).getTime() / 1000;
    const graceExpiry = endDateSecs + GRACE_PERIOD_SECS;
    const graceExpiresAt = new Date(graceExpiry * 1000).toISOString();
    const isVoidEligible =
      row.state === ResolutionState.Unresolved && now >= graceExpiry;

    const status: ResolutionStatus = {
      marketId: row.market_id,
      state: row.state,
      proposedOutcome: row.proposed_outcome,
      proposedAt: row.proposed_at ? new Date(row.proposed_at).toISOString() : null,
      finalisedAt: row.finalised_at ? new Date(row.finalised_at).toISOString() : null,
      challengeSecondsRemaining,
      graceExpiresAt,
      isVoidEligible,
    };

    res.json(status);
  } catch (err) {
    console.error("[api] GET /resolution/:id error:", err);
    res.status(500).json({ error: "Failed to fetch resolution status" });
  }
});

/**
 * GET /api/resolution/pending
 * Markets in unresolved or proposed state (admin dashboard FR-A-1).
 */
resolutionRouter.get("/", async (req: Request, res: Response) => {
  try {
    const filter = req.query.filter as string | undefined;

    let sql = `
      SELECT r.*, m.end_date, m.status AS market_status,
             COALESCE(md.question, m.question_text) AS question_text
      FROM resolutions r
      JOIN markets m ON m.market_id = r.market_id
      LEFT JOIN market_metadata md ON md.market_id = m.market_id
    `;

    const params: unknown[] = [];

    if (filter === "pending") {
      sql += ` WHERE r.state IN ($1, $2)`;
      params.push(ResolutionState.Unresolved, ResolutionState.Proposed);
    } else if (filter === "disputed") {
      sql += ` WHERE r.state = $1`;
      params.push(ResolutionState.Disputed);
    } else if (filter === "void-eligible") {
      sql += ` WHERE r.state = $1 AND m.end_date + interval '72 hours' <= NOW()`;
      params.push(ResolutionState.Unresolved);
    }

    sql += ` ORDER BY m.end_date ASC`;

    const rows = await query(sql, params);

    const results = rows.map((row) => {
      const endDateSecs = new Date(row.end_date).getTime() / 1000;
      const graceExpiry = endDateSecs + GRACE_PERIOD_SECS;

      return {
        marketId: row.market_id,
        questionText: row.question_text,
        marketStatus: row.market_status,
        state: row.state,
        proposedOutcome: row.proposed_outcome,
        proposedAt: row.proposed_at ? new Date(row.proposed_at).toISOString() : null,
        endDate: new Date(row.end_date).toISOString(),
        graceExpiresAt: new Date(graceExpiry * 1000).toISOString(),
        isVoidEligible:
          row.state === ResolutionState.Unresolved &&
          Date.now() / 1000 >= graceExpiry,
      };
    });

    res.json({ resolutions: results });
  } catch (err) {
    console.error("[api] GET /resolution error:", err);
    res.status(500).json({ error: "Failed to fetch resolutions" });
  }
});
