import { NextResponse } from 'next/server';
import { jsonError, requireAdminRequest } from '../../../../../../lib/server-supabase';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminRequest(request);
  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const { error } = await admin.serviceClient
    .from('desktop_devices')
    .update({
      monitoring_enabled: true,
      enrollment_status: 'enrolled',
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    return jsonError(error.message, 400);
  }

  return NextResponse.json({ id, monitoringEnabled: true });
}
