import { QueryTypes, Transaction } from 'sequelize';
import { z } from 'zod';
import { sequelize } from '../../config/database';
import { env } from '../../config/env';
import { decryptSecret, encryptSecret, maskSecret } from '../../utils/secretCrypto';
import { AppError } from '../../utils/AppError';
import { aiProfileSchema } from '../../validators/ai.validator';

export type ProfileInput = z.infer<typeof aiProfileSchema>;
type Stored = { id: string; config: Omit<ProfileInput, 'api_key'> | string; api_key_encrypted: string | null };
export const LEGACY_PROFILE_ID = '00000000-0000-4000-8000-000000000001';
async function rows(transaction?: Transaction): Promise<Stored[]> {
  return sequelize.query<Stored>('SELECT id,config,api_key_encrypted FROM ai_profiles ORDER BY position,id', { type: QueryTypes.SELECT, logging: false, transaction });
}
function config(row: Stored): Omit<ProfileInput, 'api_key'> { return typeof row.config === 'string' ? JSON.parse(row.config) : row.config; }
function legacy(values: Record<string, string>): Stored {
  return { id: LEGACY_PROFILE_ID, api_key_encrypted: values.ai_api_key_encrypted || null, config: {
    id: LEGACY_PROFILE_ID, name: 'Cấu hình hiện tại', provider: values.ai_provider || 'anthropic', model: values.ai_model || env.ANTHROPIC_MODEL,
    enabled: true, temperature: Number(values.ai_temperature || 0.2), max_tokens: Number(values.ai_max_tokens || 1024), top_p: Number(values.ai_top_p || 1),
  } };
}
export async function storedProfiles(values: Record<string, string>): Promise<Stored[]> {
  if (values.ai_profiles_enabled !== 'true') return [legacy(values)];
  const stored = await rows();
  return stored.length ? stored : [legacy(values)];
}
export async function publicProfiles(values: Record<string, string>) {
  return (await storedProfiles(values)).map((row) => {
    const data = config(row);
    let masked: string | null = null;
    let error: string | null = null;
    try {
      masked = row.api_key_encrypted ? maskSecret(row.api_key_encrypted) : row.id === LEGACY_PROFILE_ID && data.provider === 'anthropic' && env.ANTHROPIC_API_KEY ? maskSecret(env.ANTHROPIC_API_KEY) : null;
    } catch { error = 'Key không đọc được, cần nhập lại API key'; }
    return { ...data, has_api_key: Boolean(masked), api_key_masked: masked, api_key_error: error };
  });
}
export async function profileKey(input: { profile_id?: string; provider: string; endpoint_id?: string; base_url?: string; api_key?: string }, values: Record<string, string>): Promise<string> {
  if (input.api_key?.trim()) return input.api_key.trim();
  if (!input.profile_id) return '';
  const row = (await storedProfiles(values)).find((p) => p.id === input.profile_id);
  if (!row) return '';
  const data = config(row);
  // Never forward an existing credential to a changed host, region or provider.
  if (data.provider !== input.provider || (data.endpoint_id || '') !== (input.endpoint_id || '') || (data.base_url || '') !== (input.base_url || '')) return '';
  try {
    return row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : row.id === LEGACY_PROFILE_ID && data.provider === 'anthropic' ? env.ANTHROPIC_API_KEY || '' : '';
  } catch { throw AppError.badRequest('Key không đọc được, cần nhập lại API key'); }
}
export async function saveProfiles(inputs: ProfileInput[], values: Record<string, string>, updatedBy: number, transaction: Transaction) {
  const existing = await storedProfiles(values);
  for (let position = 0; position < inputs.length; position += 1) {
    const { api_key: raw, ...data } = inputs[position];
    const previous = existing.find((p) => p.id === data.id);
    const old = previous ? config(previous) : undefined;
    const sameTarget = old?.provider === data.provider && (old?.endpoint_id || '') === (data.endpoint_id || '') && (old?.base_url || '') === (data.base_url || '');
    let encrypted = raw?.trim() ? encryptSecret(raw.trim()) : sameTarget ? previous?.api_key_encrypted || null : null;
    if (!encrypted && sameTarget && data.id === LEGACY_PROFILE_ID && data.provider === 'anthropic' && env.ANTHROPIC_API_KEY) encrypted = encryptSecret(env.ANTHROPIC_API_KEY);
    await sequelize.query('INSERT INTO ai_profiles(id,position,config,api_key_encrypted,updated_by,updated_at) VALUES(:id,:position,:config,:key,:by,NOW()) ON DUPLICATE KEY UPDATE position=VALUES(position),config=VALUES(config),api_key_encrypted=VALUES(api_key_encrypted),updated_by=VALUES(updated_by),updated_at=NOW()', {
      replacements: { id: data.id, position, config: JSON.stringify(data), key: encrypted, by: updatedBy }, transaction, logging: false,
    });
  }
  await sequelize.query('DELETE FROM ai_profiles WHERE id NOT IN (:ids)', { replacements: { ids: inputs.map((p) => p.id) }, transaction, logging: false });
}

export async function resolveProfiles(values: Record<string, string>) {
  return (await storedProfiles(values)).map((row) => ({ ...config(row), key: () => {
    if (row.api_key_encrypted) return decryptSecret(row.api_key_encrypted);
    return row.id === LEGACY_PROFILE_ID && config(row).provider === 'anthropic' ? env.ANTHROPIC_API_KEY || '' : '';
  } })).filter((p) => p.enabled);
}
