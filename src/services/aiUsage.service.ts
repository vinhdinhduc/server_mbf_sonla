import { QueryTypes } from 'sequelize';
import { sequelize } from '../config/database';

export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiPrice {
  provider: string;
  model: string;
  input_per_million: number;
  output_per_million: number;
}

export interface AiCallRecord extends AiUsage {
  requestId: string;
  attempt: number;
  purpose: 'chat' | 'connection_test';
  provider: string;
  model: string;
  latencyMs: number;
  errorCode: string | null;
  price?: AiPrice;
}

export function tokenCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function estimateCost(usage: AiUsage, price?: AiPrice): number | null {
  if (!price || usage.inputTokens === null || usage.outputTokens === null) return null;
  return Number(
    (
      (usage.inputTokens * price.input_per_million +
        usage.outputTokens * price.output_per_million) /
      1_000_000
    ).toFixed(8),
  );
}

export const aiUsageService = {
  async record(call: AiCallRecord): Promise<void> {
    await sequelize.query(
      `INSERT INTO ai_provider_calls
       (request_id,attempt,purpose,provider,model,input_tokens,output_tokens,estimated_cost,
        input_per_million,output_per_million,latency_ms,error_code,created_at)
       VALUES (:requestId,:attempt,:purpose,:provider,:model,:inputTokens,:outputTokens,:cost,
        :inputPrice,:outputPrice,:latencyMs,:errorCode,NOW())`,
      {
        logging: false,
        replacements: {
          ...call,
          cost: estimateCost(call, call.price),
          inputPrice: call.price?.input_per_million ?? null,
          outputPrice: call.price?.output_per_million ?? null,
        },
      },
    );
  },

  async stats() {
    const rows = await sequelize.query(
      `SELECT COUNT(*) provider_calls,
       COALESCE(SUM(input_tokens),0) input_tokens,COALESCE(SUM(output_tokens),0) output_tokens,
       COALESCE(SUM(estimated_cost),0) estimated_cost,COALESCE(AVG(latency_ms),0) avg_latency_ms,
       COALESCE(SUM(error_code IS NOT NULL),0) failed_calls,
       COALESCE(SUM(input_tokens IS NULL OR output_tokens IS NULL),0) usage_missing,
       COALESCE(SUM(estimated_cost IS NULL),0) cost_missing
       FROM ai_provider_calls WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY)`,
      { type: QueryTypes.SELECT, logging: false },
    );
    const daily = await sequelize.query(`SELECT DATE(created_at) day,COUNT(*) calls,COALESCE(SUM(estimated_cost),0) cost,
      SUM(error_code IS NOT NULL) errors FROM ai_provider_calls WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY DATE(created_at) ORDER BY day`, { type: QueryTypes.SELECT, logging: false });
    const models = await sequelize.query(`SELECT provider,model,COUNT(*) calls,COALESCE(SUM(estimated_cost),0) cost,
      SUM(error_code IS NOT NULL) errors,SUM(estimated_cost IS NULL) cost_missing FROM ai_provider_calls
      WHERE created_at>=DATE_SUB(NOW(),INTERVAL 30 DAY) GROUP BY provider,model ORDER BY calls DESC`, { type: QueryTypes.SELECT, logging: false });
    return { ...(rows[0] || {}), daily, models };
  },

  async cleanup(): Promise<void> {
    // Small batches avoid holding a large delete lock. Index supports the cutoff scan.
    for (let batch = 0; batch < 20; batch += 1) {
      // eslint-disable-next-line no-await-in-loop
      const [, metadata] = await sequelize.query(
        'DELETE FROM ai_provider_calls WHERE created_at < DATE_SUB(NOW(), INTERVAL 12 MONTH) LIMIT 1000',
        { logging: false },
      );
      if (Number((metadata as { affectedRows?: number }).affectedRows ?? 0) < 1000) break;
    }
  },
};
