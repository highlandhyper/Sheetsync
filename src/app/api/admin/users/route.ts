import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { authErrorResponse, requireAdmin, writeAdminAudit } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const rolesSnapshot = await adminDb.collection('userRoles').get();
    const users = await Promise.all(rolesSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      try {
        const authUser = await adminAuth.getUser(doc.id);
        return {
          uid: doc.id,
          email: authUser.email || data.email || '',
          role: data.role === 'admin' ? 'admin' : 'viewer',
          active: data.active !== false && !authUser.disabled,
          permanent: data.permanent === true,
          createdAt: data.createdAt || authUser.metadata.creationTime || null,
          lastLoginAt: authUser.metadata.lastSignInTime || null,
        };
      } catch {
        return {
          uid: doc.id,
          email: data.email || '',
          role: data.role === 'admin' ? 'admin' : 'viewer',
          active: false,
          permanent: data.permanent === true,
          createdAt: data.createdAt || null,
          lastLoginAt: null,
        };
      }
    }));
    users.sort((a, b) => a.email.localeCompare(b.email));
    return Response.json({ success: true, users });
  } catch (error) {
    return authErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(request);
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const role = body.role === 'admin' ? 'admin' : body.role === 'viewer' ? 'viewer' : null;

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return Response.json({ success: false, error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ success: false, error: 'Password must be at least 8 characters.' }, { status: 400 });
    }
    if (!role) {
      return Response.json({ success: false, error: 'Choose a valid role.' }, { status: 400 });
    }
    if (email === (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase()) {
      return Response.json({ success: false, error: 'The permanent initial Admin already has protected access.' }, { status: 409 });
    }

    const created = await adminAuth.createUser({ email, password, disabled: false });
    const now = new Date().toISOString();
    await adminDb.collection('userRoles').doc(created.uid).set({
      uid: created.uid,
      email,
      role,
      active: true,
      permanent: false,
      createdAt: now,
      updatedAt: now,
    });
    await writeAdminAudit(actor, 'user_created', created.uid, { email, role });
    return Response.json({ success: true, uid: created.uid, email, role }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'auth/email-already-exists') {
      return Response.json({ success: false, error: 'This email already exists in Firebase Authentication. No role was changed.' }, { status: 409 });
    }
    return authErrorResponse(error);
  }
}
