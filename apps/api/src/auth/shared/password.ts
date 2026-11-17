// password.ts — scrypt-based password hashing using only Node's built-in crypto.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const KEYLEN = 64;
const SALT_BYTES = 16;

/** Returns a storable string of the form `salt:hash` (hex). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

/** Constant-time verification against a stored `salt:hash` string. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(hashHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length !== SALT_BYTES || expected.length !== KEYLEN) return false;

  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return timingSafeEqual(derived, expected);
}