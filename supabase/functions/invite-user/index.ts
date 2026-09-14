import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Invitation = { storeId: string; email: string; role: 'manager' | 'supervisor' | 'employee'; sectorIds?: string[]; canEditSector?: boolean }

Deno.serve(async (request) => {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const invitation = await request.json() as Invitation
  const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: manager } = await adminClient.from('store_memberships').select('role').eq('store_id', invitation.storeId).eq('user_id', user.id).in('role', ['owner', 'manager']).maybeSingle()
  if (!manager) return Response.json({ error: 'Forbidden' }, { status: 403 })
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(invitation.email, { data: { full_name: invitation.email.split('@')[0] } })
  if (error || !data.user) return Response.json({ error: error?.message ?? 'Invite failed' }, { status: 400 })
  const { error: membershipError } = await adminClient.from('store_memberships').upsert({ store_id: invitation.storeId, user_id: data.user.id, role: invitation.role })
  if (membershipError) return Response.json({ error: membershipError.message }, { status: 400 })
  if (invitation.sectorIds?.length) {
    const rows = invitation.sectorIds.map((sectorId) => ({ store_id: invitation.storeId, user_id: data.user!.id, sector_id: sectorId, can_edit: Boolean(invitation.canEditSector) }))
    const { error: scopeError } = await adminClient.from('member_sectors').upsert(rows)
    if (scopeError) return Response.json({ error: scopeError.message }, { status: 400 })
  }
  return Response.json({ userId: data.user.id })
})
