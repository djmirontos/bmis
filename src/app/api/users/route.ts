import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

// Admin client with service role key
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// GET — list all users
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['super_admin', 'captain'].includes(profile?.role ?? '')) {
      return NextResponse.json(
        { error: 'Forbidden' }, { status: 403 }
      )
    }

    const { data: profiles, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get auth users to match email
    const { data: { users: authUsers } } =
      await supabaseAdmin.auth.admin.listUsers()

    const merged = (profiles ?? []).map(p => {
      const authUser = authUsers.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email ?? null,
        last_sign_in: authUser?.last_sign_in_at ?? null,
        email_confirmed: authUser?.email_confirmed_at != null,
      }
    })

    return NextResponse.json({ users: merged })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message }, { status: 500 }
    )
  }
}

// POST — create new user
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['super_admin', 'captain'].includes(profile?.role ?? '')) {
      return NextResponse.json(
        { error: 'Forbidden' }, { status: 403 }
      )
    }

    const body = await request.json()
    const { email, password, full_name, role } = body

    if (!email || !password || !full_name || !role) {
      return NextResponse.json(
        { error: 'All fields are required.' }, { status: 400 }
      )
    }

    // Create auth user
    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      })

    if (createError) {
      return NextResponse.json(
        { error: createError.message }, { status: 400 }
      )
    }

    // Create user profile
    const { error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: newUser.user.id,
        full_name,
        role,
        is_active: true,
      })

    if (profileError) {
      // Rollback auth user if profile fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: profileError.message }, { status: 500 }
      )
    }

    return NextResponse.json({ success: true, id: newUser.user.id })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message }, { status: 500 }
    )
  }
}