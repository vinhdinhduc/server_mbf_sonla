import crypto from 'crypto';
import { env } from '../config/env';

const PREFIX = 'enc:v1:';

function keyBytes(secret = env.APP_SECRET_KEY): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptSecret(value: string): string {
  if (!value.startsWith('enc:')) return value;
  if (!value.startsWith(PREFIX)) throw new Error('Unsupported secret encryption version');
  const parts = value.slice(PREFIX.length).split('.');
  const [ivEncoded, tagEncoded, encryptedEncoded] = parts;
  if (parts.length !== 3 || !ivEncoded || !tagEncoded || !encryptedEncoded)
    throw new Error('Secret encryption format is invalid');
  const iv = Buffer.from(ivEncoded, 'base64');
  const tag = Buffer.from(tagEncoded, 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid secret encryption format');
  const secrets = [env.APP_SECRET_KEY, ...env.APP_SECRET_KEY_PREVIOUS];
  for (let index = 0; index < secrets.length; index += 1) {
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(secrets[index]), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedEncoded, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Try the next rotation key without exposing credentials or ciphertext.
    }
  }
  throw new Error('Secret cannot be decrypted');
}

export function maskSecret(value: string | null): string | null {
  if (!value) return null;
  const plain = decryptSecret(value);
  if (plain.length <= 4) return '****';
  return `****${plain.slice(-4)}`;
}
