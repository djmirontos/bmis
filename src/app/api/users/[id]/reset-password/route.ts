import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['super_admin', 'captain'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params

    const { data: { user: targetUser }, error: getUserError } =
      await supabaseAdmin.auth.admin.getUserById(id)

    if (getUserError || !targetUser?.email) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    const { error: resetError } = await supabaseAdmin.auth
      .resetPasswordForEmail(targetUser.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`
      })

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, email: targetUser.email })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
