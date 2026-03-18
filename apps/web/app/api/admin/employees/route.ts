import { NextResponse } from 'next/server';
import { jsonError, requireAdminRequest } from '../../../../lib/server-supabase';

interface CreateEmployeeBody {
  email?: string;
  password?: string;
  fullName?: string;
}

export async function POST(request: Request) {
  const admin = await requireAdminRequest(request);
  if (!admin.ok) {
    return admin.response;
  }

  const body = (await request.json()) as CreateEmployeeBody;
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const fullName = body.fullName?.trim();

  if (!email || !password || !fullName) {
    return jsonError('Email, password, and full name are required.');
  }

  const { data, error } = await admin.serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'worker'
    }
  });

  if (error || !data.user) {
    return jsonError(error?.message ?? 'Unable to create employee.', 400);
  }

  const { error: profileError } = await admin.serviceClient.from('profiles').upsert({
    id: data.user.id,
    email,
    full_name: fullName,
    role: 'worker',
    is_active: true
  });

  if (profileError) {
    return jsonError(profileError.message, 400);
  }

  return NextResponse.json({
    employee: {
      id: data.user.id,
      email,
      fullName,
      role: 'worker',
      isActive: true
    }
  });
}

