import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Triggered by a DB webhook: markers row updated where status = 'approved'
Deno.serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;

  if (record.status !== 'approved' || record.approved_at) {
    return new Response('skip', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const approvedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('markers')
    .update({ approved_at: approvedAt, expires_at: expiresAt })
    .eq('id', record.id);

  if (error) return new Response(error.message, { status: 500 });
  return new Response('ok', { status: 200 });
});
