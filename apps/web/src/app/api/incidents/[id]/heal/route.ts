import { NextResponse } from 'next/server';

const API_URL = process.env['SLINK_INTERNAL_API_URL'] || process.env['NEXT_PUBLIC_SLINK_API_URL'] || 'http://localhost:4000';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const target = `${API_URL}/api/v1/incidents/${id}/heal`;
    const res = await fetch(target, { method: 'POST', cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Heal request failed' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
