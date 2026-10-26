import 'server-only';

import type { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Role } from '@/lib/types';

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireSignedInUser(request: NextRequest): Promise<DecodedIdToken> {
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new ApiAuthError('Authentication required.', 401);

  try {
    return await adminAuth.verifyIdToken(match[1], true);
  } catch {
    throw new ApiAuthError('Your session is invalid or expired. Sign in again.', 401);
  }
}

export async function getTrustedRole(uid: string, email: string | undefined): Promise<Role | null> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const ref = adminDb.collection('userRoles').doc(uid);

  // The configured initial Admin is bootstrapped only by the server.
  if (initialAdminEmail && normalizedEmail === initialAdminEmail) {
    await ref.set({
      uid,
      email: normalizedEmail,
      role: 'admin',
      active: true,
      permanent: true,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return 'admin';
  }

  const snapshot = await ref.get();
  if (!snapshot.exists) {
    await ref.create({
      uid,
      email: normalizedEmail,
      role: 'viewer',
      active: true,
      permanent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return 'viewer';
  }

  const data = snapshot.data();
  if (data?.active === false) return null;
  return data?.role === 'admin' || data?.role === 'viewer' ? data.role : 'viewer';
}

export async function requireAdmin(request: NextRequest): Promise<DecodedIdToken> {
  const decoded = await requireSignedInUser(request);
  const role = await getTrustedRole(decoded.uid, decoded.email);
  if (role !== 'admin') {
    throw new ApiAuthError(role === null ? 'This account is inactive.' : 'Administrator permission required.', role === null ? 403 : 403);
  }
  return decoded;
}

export function authErrorResponse(error: unknown) {
  const status = error instanceof ApiAuthError ? error.status : 500;
  const message = error instanceof ApiAuthError
    ? error.message
    : 'The request could not be completed.';
  if (status === 500) console.error('[SECURE USER API]', error);
  return Response.json({ success: false, error: message }, { status });
}

export async function writeAdminAudit(
  actor: DecodedIdToken,
  action: string,
  targetUid: string,
  details: Record<string, unknown> = {},
) {
  await adminDb.collection('userManagementAudit').add({
    actorUid: actor.uid,
    actorEmail: actor.email || '',
    action,
    targetUid,
    details,
    createdAt: new Date().toISOString(),
  });
}
