import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const fallback = {
  barangay_name: process.env.NEXT_PUBLIC_BARANGAY_NAME ?? 'Barangay IV',
  city: process.env.NEXT_PUBLIC_CITY ?? 'Tangub City',
  province: process.env.NEXT_PUBLIC_PROVINCE ?? 'Misamis Occidental',
  region: process.env.NEXT_PUBLIC_REGION ?? 'Region X',
  zip_code: null,
  logo_url: null,
  city_logo_url: null,
  contact_number: null,
  email_address: null,
  barangay_id: null,
  theme_color: null,
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const cookieStore = await cookies()

    // Try to get authenticated user
    const authClient = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      }
    )

    const { data: { user } } = await authClient.auth.getUser()

    if (!user) return NextResponse.json(fallback)

    // Use service role to bypass RLS for this lookup
    const admin = createClient(supabaseUrl, serviceKey)

    // Get user's barangay_id
    const { data: profile } = await admin
      .from('user_profiles')
      .select('barangay_id')
      .eq('id', user.id)
      .single()

    if (!profile?.barangay_id) return NextResponse.json(fallback)

    // Get barangay info
    const { data, error } = await admin
      .from('barangays')
      .select('id, name, city, province, region, zip_code, contact_number, email_address, logo_path, city_logo_path, theme_color')
      .eq('id', profile.barangay_id)
      .single()

    if (error || !data) return NextResponse.json(fallback)

    const logoUrl = data.logo_path
      ? `${supabaseUrl}/storage/v1/object/public/barangay-assets/${data.logo_path}`
      : null
    const cityLogoUrl = data.city_logo_path
      ? `${supabaseUrl}/storage/v1/object/public/barangay-assets/${data.city_logo_path}`
      : null

    return NextResponse.json({
      barangay_name: data.name,
      city: data.city,
      province: data.province,
      region: data.region,
      zip_code: data.zip_code ?? null,
      logo_url: logoUrl,
      city_logo_url: cityLogoUrl,
      contact_number: data.contact_number ?? null,
      email_address: data.email_address ?? null,
      barangay_id: data.id,
      theme_color: data.theme_color ?? null,
    })
  } catch {
    return NextResponse.json(fallback)
  }
}