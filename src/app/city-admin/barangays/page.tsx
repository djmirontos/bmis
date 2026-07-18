'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'

interface Barangay {
  id: string
  name: string
  city: string
  status: string
  captain_name: string | null
  subscription_status: string | null
  onboarded_at: string | null
}

export default function BarangaysPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [cityName, setCityName] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: roleData } = await supabase
          .from('city_roles')
          .select('city_id, cities(name)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (!roleData) {
          router.push('/dashboard')
          return
        }

        const cityId = roleData?.city_id
        const cityNameVal = roleData?.cities?.name ?? 'City'
        setCityName(cityNameVal)

        const { data: brgyList } = await supabase
          .from('barangays')
          .select('id, name, city, status, captain_name, subscription_status, onboarded_at')
          .eq('city_id', cityId)
          .order('name')

        setBarangays(brgyList ?? [])
      } catch (error) {
        console.error('Error loading barangays:', error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const filteredBarangays = barangays.filter(b =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8' }}>
        Loading barangays...
      </div>
    )
  }

  return (
    <div style={{ padding: '32px' }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '24px' }}>
        <Link href="/city-admin" style={{ color: '#1E3A8A', textDecoration: 'none' }}>
          City Admin
        </Link>
        <span style={{ margin: '0 8px' }}>›</span>
        <span>Barangays</span>
      </div>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>
          Barangays
        </h1>
        <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
          {cityName && `${cityName} — `}All participating barangays
        </p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '24px' }}>
        <input
          type="text"
          placeholder="Search barangays..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid #E2E8F0',
            fontSize: '14px',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Table */}
      <div style={{
        background: 'white',
        border: '1px solid #E2E8F0',
        borderRadius: '14px',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
          }}>
            <thead>
              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>Barangay Name</th>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>City</th>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>Status</th>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>Captain</th>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>Subscription</th>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>Onboarded</th>
                <th style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#94A3B8',
                  padding: '12px 16px',
                  textAlign: 'left',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredBarangays.map((brgy, idx) => (
                <tr
                  key={brgy.id}
                  style={{
                    background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  <td style={{ padding: '12px 16px', color: '#0F172A' }}>{brgy.name}</td>
                  <td style={{ padding: '12px 16px', color: '#0F172A' }}>{brgy.city}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: brgy.status === 'active' ? '#F0FDF4' : brgy.status === 'suspended' ? '#FEF2F2' : '#F3F4F6',
                        color: brgy.status === 'active' ? '#16a34a' : brgy.status === 'suspended' ? '#dc2626' : '#64748b',
                      }}
                    >
                      {brgy.status || 'inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0F172A' }}>
                    {brgy.captain_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: brgy.subscription_status === 'active' ? '#F0FDF4' : '#FEF3C7',
                        color: brgy.subscription_status === 'active' ? '#16a34a' : '#92400e',
                      }}
                    >
                      {brgy.subscription_status || 'trial'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#0F172A' }}>
                    {brgy.onboarded_at ? new Date(brgy.onboarded_at).toLocaleDateString('en-PH') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link
                      href={`/city-admin/barangays/${brgy.id}`}
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#1E3A8A',
                        border: '1px solid #E2E8F0',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        textDecoration: 'none',
                        display: 'inline-block',
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#1E3A8A'
                        e.currentTarget.style.background = 'rgba(30, 58, 138, 0.05)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#E2E8F0'
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredBarangays.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
          No barangays found
        </div>
      )}
    </div>
  )
}
