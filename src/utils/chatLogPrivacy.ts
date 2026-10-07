import { createHash } from 'crypto';

/** Public-to-admin log responses use existing fields only; private model metadata stays server-side. */
export interface ChatLogAdminRecord {
  id: number | string;
  session_id: string;
  user_message: string;
  ai_response: string;
  was_helpful?: boolean | null;
  flagged_for_review: boolean;
  feedback_comment?: string | null;
  created_at: Date | string;
  provider?: string | null;
  model?: string | null;
  latency_ms?: number | null;
}

function emailPattern(): RegExp {
  return /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi;
}

function phonePattern(): RegExp {
  // Covers whitespace copied from Office, invisible joiners and control separators.
  const separator = '[\\s\\u0000-\\u001f\\u007f\\u200b-\\u200d\\u2060().-]*';
  const prefix = `\\(?(?:0|\\+?84)${separator}`;
  return new RegExp(
    `(^|[^\\d])(${prefix}[35789](?:${separator}\\d){8}|${prefix}2(?:${separator}\\d){9})(?!\\d)`,
    'g',
  );
}

export function maskChatLogContactInfo(value: string): string {
  // Fresh expressions avoid mutable global lastIndex across independent log rows.
  return value
    .replace(emailPattern(), (address) => {
      const [local, domain] = address.split('@');
      return `${local.slice(0, 1)}***@${domain}`;
    })
    .replace(phonePattern(), (_match, before: string, number: string) => {
      let digits = number.replace(/\D/g, '');
      if (digits.startsWith('84')) digits = `0${digits.slice(2)}`;
      return `${before}${digits.slice(0, 4)} *** ${digits.slice(-3)}`;
    });
}

function sessionIdForAdmin(value: string): string {
  // UUID hex may coincidentally contain phone-like digits; keep real UUID identities unchanged.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuid.test(value) || (!emailPattern().test(value) && !phonePattern().test(value)))
    return value;
  // Hash the original value rather than the masked value so distinct contact sessions stay distinct.
  return `private-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`;
}

export function toAdminChatLogDto(record: ChatLogAdminRecord): ChatLogAdminRecord {
  // Deliberate whitelist: spreading a model or toJSON() would leak IP/consent and future fields.
  return {
    id: record.id,
    session_id: sessionIdForAdmin(record.session_id),
    user_message: maskChatLogContactInfo(record.user_message),
    ai_response: maskChatLogContactInfo(record.ai_response),
    was_helpful: record.was_helpful ?? null,
    flagged_for_review: record.flagged_for_review,
    feedback_comment:
      record.feedback_comment == null ? null : maskChatLogContactInfo(record.feedback_comment),
    created_at: record.created_at,
    provider: record.provider ?? null,
    model: record.model ?? null,
    latency_ms: record.latency_ms ?? null,
  };
}
