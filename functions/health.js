export const handler = async () => {
  const keys = [
    'OPENAI_API_KEY',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_OWNER_ID',
    'SESSION_SECRET',
    'COUNSEL_NAME',
  ];
  const present = Object.fromEntries(keys.map(k => [k, !!process.env[k]]));
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, present }),
  };
};
