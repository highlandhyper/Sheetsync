import { NextRequest } from 'next/server';
import { authErrorResponse, getTrustedRole, requireSignedInUser } from '@/lib/server-auth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const decoded = await requireSignedInUser(request);
    const role = await getTrustedRole(decoded.uid, decoded.email);
    return Response.json({
      success: true,
      role,
      active: role !== null,
      email: decoded.email || null,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
