// supabase/functions/admin-users/index.ts
// Deployed via: supabase functions deploy admin-users
//
// This function runs server-side with the SERVICE ROLE KEY.
// It verifies the caller is an approved leader before doing anything.
// The service role key is NEVER sent to the browser.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Verify caller is an authenticated, approved leader ──────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err(401, 'Missing Authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Use anon client to verify the caller's JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return err(401, 'Invalid session');

    // Check profile is approved + leader
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from('profiles')
      .select('approved, is_leader')
      .eq('id', user.id)
      .single();

    if (!profile?.approved || !profile?.is_leader) {
      return err(403, 'Not authorised — must be an approved leader');
    }

    // ── 2. Parse action ────────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    switch (action) {

      // List ALL auth users + merge with profiles table
      case 'list': {
        const { data: authUsers, error: listErr } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) return err(500, listErr.message);

        const { data: profiles } = await adminClient.from('profiles').select('*');
        const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

        const merged = authUsers.users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          profile: profileMap[u.id] || null,
        }));

        return ok({ users: merged });
      }

      // Create a new user with email + temp password, auto-approve
      case 'create': {
        const { email, name, tempPassword, team, makeLeader } = body;
        if (!email || !name || !tempPassword) return err(400, 'email, name and tempPassword are required');

        // Create auth user
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true, // skip email confirmation
          user_metadata: { name },
        });
        if (createErr) return err(400, createErr.message);

        // Upsert profile row (trigger may already create it)
        await adminClient.from('profiles').upsert({
          id: created.user.id,
          email,
          name,
          is_leader: makeLeader || false,
          approved: true,
          team: team || null,
        }, { onConflict: 'id' });

        return ok({ user: created.user });
      }

      // Delete auth account + profile row atomically
      case 'delete': {
        const { userId } = body;
        if (!userId) return err(400, 'userId is required');
        if (userId === user.id) return err(400, 'Cannot delete your own account');

        // Delete profile first (FK constraint), then auth user
        await adminClient.from('profiles').delete().eq('id', userId);
        const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
        if (delErr) return err(500, delErr.message);

        return ok({ deleted: userId });
      }

      // Force-set a new password for a user
      case 'set_password': {
        const { userId, newPassword } = body;
        if (!userId || !newPassword) return err(400, 'userId and newPassword are required');
        if (newPassword.length < 8) return err(400, 'Wachtwoord moet minimaal 8 tekens zijn');

        const { error: pwErr } = await adminClient.auth.admin.updateUserById(userId, {
          password: newPassword,
        });
        if (pwErr) return err(500, pwErr.message);

        return ok({ updated: userId });
      }

      // Send magic-link password reset email
      case 'send_reset': {
        const { email, redirectTo } = body;
        if (!email) return err(400, 'email is required');

        const { error: resetErr } = await adminClient.auth.admin.generateLink({
          type: 'recovery',
          email,
          options: { redirectTo: redirectTo || 'https://t-break-dev.vercel.app' },
        });
        if (resetErr) return err(500, resetErr.message);

        return ok({ sent: email });
      }

      // Update profile fields (name, team, role, approved)
      case 'update_profile': {
        const { userId, patch } = body;
        if (!userId || !patch) return err(400, 'userId and patch are required');

        const allowed = ['name', 'team', 'is_leader', 'approved'];
        const safe = Object.fromEntries(
          Object.entries(patch).filter(([k]) => allowed.includes(k))
        );
        if (Object.keys(safe).length === 0) return err(400, 'No valid fields to update');

        const { error: upErr } = await adminClient
          .from('profiles')
          .update(safe)
          .eq('id', userId);
        if (upErr) return err(500, upErr.message);

        return ok({ updated: userId });
      }

      default:
        return err(400, `Unknown action: ${action}`);
    }

  } catch (e) {
    console.error('Edge function error:', e);
    return err(500, e instanceof Error ? e.message : 'Internal error');
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
