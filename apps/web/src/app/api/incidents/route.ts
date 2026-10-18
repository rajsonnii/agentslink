import { NextResponse } from 'next/server';

const API_URL = process.env['SLINK_INTERNAL_API_URL'] || process.env['NEXT_PUBLIC_SLINK_API_URL'] || 'http://localhost:4000';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const target = `${API_URL}/api/v1/incidents?${searchParams.toString()}`;
    const res = await fetch(target, { cache: 'no-store' });

    if (!res.ok) {
      return NextResponse.json({ success: false, incidents: [] }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ success: true, count: 0, incidents: [] });
  }
}
