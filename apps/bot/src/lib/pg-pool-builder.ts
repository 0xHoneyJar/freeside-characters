/**
 * pg-pool-builder.ts — node-postgres adapter for the production runtime
 * (cycle-B sprint-1 · B-1.8).
 *
 * Bridges `pg.Pool` to `QuestStatePostgresPool` (the minimal `query`
 * surface @0xhoneyjar/quests-engine consumes).
 *
 * Why this lives in its own module:
 *   - keeps `quest-runtime-production.ts` pure (no node-postgres import ·
 *     unit-testable without a network)
 *   - inline ambient type declaration for `pg` (no `@types/pg` dep needed
 *     in this workspace · the types we use are minimal and stable)
 *   - the bot's main() imports this lazily via the production-runtime branch
 *     · memory/disabled paths never load pg
 *
 * Per Lock-9 (schema source-of-truth = JSON Schema): the runtime pool
 * surface is a structural subset of pg.Pool · drift-tolerant.
 */

import type { QuestStatePostgresPool } from '@0xhoneyjar/quests-engine';
import type { PoolBuilder } from '../quest-runtime-production.ts';

// Minimal ambient declaration for `pg`. We don't depend on @types/pg
// because the Pool surface we use is small and stable, and adding a
// 100kB types dep just for two methods is overkill. Drift surfaces as
// runtime mismatch · caught by integration tests in B-1.14.
interface PgPoolLike {
  query: (
    text: string,
    values?: readonly unknown[],
  ) => Promise<{
    rows: ReadonlyArray<Record<string, unknown>>;
    rowCount: number | null;
  }>;
}

interface PgModuleLike {
  Pool: new (config: { connectionString: string }) => PgPoolLike;
}

/**
 * Default PoolBuilder · constructs a `pg.Pool` from a connection string
 * and adapts it to QuestStatePostgresPool's query contract.
 *
 * Runtime resolution: `require('pg')` at first call · the dep is hoisted
 * via the workspace (transitively present from score-mibera / sibling
 * packages). If pg is missing the require throws · operator surfaces a
 * clear runtime error.
 */
export const pgPoolBuilder: PoolBuilder = {
  build: (connection_string: string): QuestStatePostgresPool => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pg = require('pg') as PgModuleLike;
    const pool = new pg.Pool({ connectionString: connection_string });
    return {
      query: async <T extends Record<string, unknown> = Record<string, unknown>>(
        text: string,
        values?: ReadonlyArray<unknown>,
      ): Promise<{ rows: T[]; rowCount: number | null }> => {
        const result = await pool.query(text, values);
        // Cast through unknown · the QuestStatePostgresPool generic T is the
        // caller's expected row shape · pg returns whatever Postgres yields.
        // The quests-engine adapter validates rows via Effect Schema so any
        // structural drift surfaces there.
        return {
          rows: result.rows as unknown as T[],
          rowCount: result.rowCount,
        };
      },
    };
  },
};
