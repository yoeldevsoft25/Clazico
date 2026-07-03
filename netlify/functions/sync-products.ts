export const config = {
  schedule: '*/10 * * * *',
};

export default async function handler() {
  const cronSecret = process.env.CRON_SECRET;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL;

  if (!cronSecret) {
    console.error('CRON_SECRET is not configured');
    return new Response('CRON_SECRET is not configured', { status: 500 });
  }

  if (!appUrl) {
    console.error('Site URL is not configured');
    return new Response('Site URL is not configured', { status: 500 });
  }

  const syncUrl = `${appUrl.replace(/\/+$/, '')}/api/cron/sync-products`;
  const response = await fetch(syncUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error('Scheduled product sync failed', {
      status: response.status,
      body,
    });
    return new Response(body, { status: response.status });
  }

  console.log('Scheduled product sync completed', body);
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
