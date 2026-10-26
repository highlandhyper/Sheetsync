import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { authErrorResponse, requireAdmin, writeAdminAudit } from '@/lib/server-auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ uid: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const actor = await requireAdmin(request);
    const { uid } = await context.params;
    const body = await request.json();
    const ref = adminDb.collection('userRoles').doc(uid);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return Response.json({ success: false, error: 'User role record not found.' }, { status: 404 });
    }

    const existing = snapshot.data()!;
    const permanentEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
    if (!permanentEmail) {
      throw new Error('INITIAL_ADMIN_EMAIL must be configured in the server environment.');
    }
    const targetEmail = String(existing.email || '').trim().toLowerCase();
    const permanent = existing.permanent === true || (!!permanentEmail && targetEmail === permanentEmail);
    if (permanent) {
      return Response.json({ success: false, error: 'The permanent initial Admin cannot be demoted or disabled.' }, { status: 403 });
    }
    if (actor.uid === uid && (body.role !== undefined || body.active === false)) {
      return Response.json({ success: false, error: 'You cannot change your own role or disable your own account.' }, { status: 403 });
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.role !== undefined) {
      if (body.role !== 'admin' && body.role !== 'viewer') {
        return Response.json({ success: false, error: 'Choose a valid role.' }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') {
        return Response.json({ success: false, error: 'Active must be true or false.' }, { status: 400 });
      }
      updates.active = body.active;
    }

    const nextRole = (updates.role ?? existing.role) as string;
    const nextActive = (updates.active ?? existing.active) !== false;
    if (existing.role === 'admin' && (nextRole !== 'admin' || !nextActive)) {
      const admins = await adminDb.collection('userRoles').where('role', '==', 'admin').get();
      const activeAdmins = admins.docs.filter(d => d.data().active !== false && d.id !== uid);
      if (activeAdmins.length === 0) {
        return Response.json({ success: false, error: 'At least one other active Admin must remain.' }, { status: 409 });
      }
    }

    if (updates.active === false) {
      await adminAuth.updateUser(uid, { disabled: true });
    } else if (updates.active === true) {
      await adminAuth.updateUser(uid, { disabled: false });
    }
    await ref.set(updates, { merge: true });
    await writeAdminAudit(actor, 'user_updated', uid, updates);
    return Response.json({ success: true });
  } catch (error) {
    return authErrorResponse(error);
  }
}
