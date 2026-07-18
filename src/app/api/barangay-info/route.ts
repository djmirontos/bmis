import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('barangay_settings')
      .select('barangay_name, city, province, region, logo_path, city_logo_path, contact_number, email_address')
      .single()

    if (error || !data) {
      return NextResponse.json({
        barangay_name: process.env.NEXT_PUBLIC_BARANGAY_NAME ?? 'Barangay IV',
        city: process.env.NEXT_PUBLIC_CITY ?? 'Tangub City',
        province: process.env.NEXT_PUBLIC_PROVINCE ?? 'Misamis Occidental',
        region: process.env.NEXT_PUBLIC_REGION ?? 'Region X',
        logo_url: null,
        city_logo_url: null,
        contact_number: null,
        email_address: null,
      })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const logoUrl = data.logo_path
      ? `${supabaseUrl}/storage/v1/object/public/barangay-assets/${data.logo_path}`
      : null
    const cityLogoUrl = data.city_logo_path
      ? `${supabaseUrl}/storage/v1/object/public/barangay-assets/${data.city_logo_path}`
      : null

    return NextResponse.json({
      ...data,
      logo_url: logoUrl,
      city_logo_url: cityLogoUrl,
    })
  } catch {
    return NextResponse.json({
      barangay_name: process.env.NEXT_PUBLIC_BARANGAY_NAME ?? 'Barangay IV',
      city: process.env.NEXT_PUBLIC_CITY ?? 'Tangub City',
      province: process.env.NEXT_PUBLIC_PROVINCE ?? 'Misamis Occidental',
      region: process.env.NEXT_PUBLIC_REGION ?? 'Region X',
      logo_url: null,
      city_logo_url: null,
      contact_number: null,
      email_address: null,
    })
  }
}