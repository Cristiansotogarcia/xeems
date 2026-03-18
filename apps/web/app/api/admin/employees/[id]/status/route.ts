import { NextResponse } from 'next/server';
import { jsonError, requireAdminRequest } from '../../../../../../lib/server-supabase';

interface EmployeeStatusBody {
  isActive?: boolean;
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
  const body = (await request.json()) as EmployeeStatusBody;

  if (typeof body.isActive !== 'boolean') {
    return jsonError('isActive must be provided.');
  }

  const { error: profileError } = await admin.serviceClient
    .from('profiles')
    .update({ is_active: body.isActive })
    .eq('id', id)
    .eq('role', 'worker');

  if (profileError) {
    return jsonError(profileError.message, 400);
  }

  const { error: deviceError } = await admin.serviceClient
    .from('desktop_devices')
    .update({
      monitoring_enabled: body.isActive,
      enrollment_status: body.isActive ? 'enrolled' : 'disabled',
      updated_at: new Date().toISOString()
    })
    .eq('user_id', id);

  if (deviceError) {
    return jsonError(deviceError.message, 400);
  }

  return NextResponse.json({ id, isActive: body.isActive });
}

