import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function checkAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!['super_admin', 'captain'].includes(profile?.role ?? '')) {
    return null
  }
  return user
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Forbidden' }, { status: 403 }
      )
    }
    const body = await request.json()
    const { role, is_active, full_name } = body
    const updateData: any = {}
    if (role !== undefined) updateData.role = role
    if (is_active !== undefined) updateData.is_active = is_active
    if (full_name !== undefined) updateData.full_name = full_name
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update(updateData)
      .eq('id', id)
    if (profileError) {
      return NextResponse.json(
        { error: profileError.message }, { status: 500 }
      )
    }
    if (is_active === false) {
      await supabaseAdmin.auth.admin.updateUserById(
        id, { ban_duration: '876600h' }
      )
    }
    if (is_active === true) {
      await supabaseAdmin.auth.admin.updateUserById(
        id, { ban_duration: 'none' }
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message }, { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = await checkAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Forbidden' }, { status: 403 }
      )
    }
    if (id === admin.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account.' },
        { status: 400 }
      )
    }
    await supabaseAdmin
      .from('user_profiles')
      .delete()
      .eq('id', id)
    const { error } = await supabaseAdmin.auth.admin
      .deleteUser(id)
    if (error) {
      return NextResponse.json(
        { error: error.message }, { status: 500 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message }, { status: 500 }
    )
  }
}
