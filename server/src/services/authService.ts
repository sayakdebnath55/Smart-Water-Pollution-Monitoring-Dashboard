import crypto from 'node:crypto';
import { queryOne, execute } from '../database/db.js';
import { UserRecord } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'aquaguard-local-dev-jwt-secret-change-in-production-2026';

export interface AuthTokenPayload {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  role: 'admin' | 'operator';
  exp: number;
}

export function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derived, 'hex'));
  } catch {
    return false;
  }
}

export function signToken(user: Pick<UserRecord, 'id' | 'username' | 'email' | 'full_name' | 'role'>): string {
  const payload: AuthTokenPayload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  };
  const headerBase64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerBase64}.${payloadBase64}`)
    .digest('base64url');
  return `${headerBase64}.${payloadBase64}.${signature}`;
}

export function verifyToken(token: string): AuthTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as AuthTokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authenticateUser(identifier: string, password: string): { user: Omit<UserRecord, 'password_hash'>; token: string } | null {
  const user = queryOne<UserRecord>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)',
    [identifier.trim(), identifier.trim()]
  );
  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  const now = new Date().toISOString();
  execute('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id]);

  const token = signToken(user);
  const { password_hash: _ph, ...safeUser } = user;
  return {
    user: { ...safeUser, last_login_at: now },
    token,
  };
}

export function switchDemoRole(role: 'admin' | 'operator'): { user: Omit<UserRecord, 'password_hash'>; token: string } | null {
  const isDemoMode = process.env.DEMO_MODE !== 'false';
  if (!isDemoMode) return null;

  const user = queryOne<UserRecord>('SELECT * FROM users WHERE role = ? ORDER BY id ASC LIMIT 1', [role]);
  if (!user) return null;

  const token = signToken(user);
  const { password_hash: _ph, ...safeUser } = user;
  return { user: safeUser, token };
}
