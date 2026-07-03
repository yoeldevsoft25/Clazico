import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET is not configured' },
        { status: 500 },
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productSyncService } = await import('@/server/services/product-sync.service');
    const result = await productSyncService.syncAll();
    const success = result.errors.length === 0;
    return NextResponse.json(
      { success, ...result },
      { status: result.staleCachePreserved || result.total > 0 ? 200 : 502 },
    );
  } catch (error) {
    console.error('Product sync cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
