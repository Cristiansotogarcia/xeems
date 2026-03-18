import { NextResponse } from 'next/server';
import { jsonError, requireAdminRequest } from '../../../../../../lib/server-supabase';

interface ResetPasswordBody {
  password?: string;
}

function generateTemporaryPassword() {
  const random = Math.random().toString(36).slice(2, 10);
  return `Xeems!${random}9`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminRequest(request);
  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as ResetPasswordBody;
  const password = body.password?.trim() || generateTemporaryPassword();

  if (password.length < 8) {
    return jsonError('Temporary password must be at least 8 characters.');
  }

  const { error } = await admin.serviceClient.auth.admin.updateUserById(id, { password });
  if (error) {
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ password });
}

