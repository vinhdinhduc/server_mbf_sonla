import crypto from 'crypto';
import { env } from '../config/env';

const PREFIX = 'enc:v1:';

function keyBytes(): Buffer {
  return crypto.createHash('sha256').update(env.APP_SECRET_KEY, 'utf8').digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;
  const [ivEncoded, tagEncoded, encryptedEncoded] = value.slice(PREFIX.length).split('.');
  if (!ivEncoded || !tagEncoded || !encryptedEncoded)
    throw new Error('Secret encryption format is invalid');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyBytes(),
    Buffer.from(ivEncoded, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  const plain = value.startsWith(PREFIX) ? decryptSecret(value) : value;
  if (plain.length <= 4) return '****';
  return `****${plain.slice(-4)}`;
}
