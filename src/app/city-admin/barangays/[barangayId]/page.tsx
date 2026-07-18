'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Building2, Users, Home, FileText, BookOpen, UserCheck, Shield,
  ArrowLeft, Phone, Mail, MapPin, Calendar, Clock, Activity
} from 'lucide-react'
import styles from './barangay-detail.module.css'

interface BarangayData {
  id: string
  name: string
  city: string
  province: string
  status: string
  captain_name: string | null
  subscription_status: string | null
  onboarded_at: string | null
  last_activity_at: string | null
  logo_path: string | null
  contact_number: string | null
  email_address: string | null
  zip_code: string | null
}

interface Stats {
  totalResidents: number
  totalHouseholds: number
  totalVoters: number
  totalSenior: number
  totalPWD: number
  totalSoloParent: number
  totalOFW: number
  docsThisMonth: number
  blotterThisMonth: number
  activeUsers: number
  totalOfficials: number
  activeTanod: number
}

interface Official {
  full_name: string
  position: string
  contact_number: string | null
  term_end: string | null
  is_active: boolean
}

interface DocByType {
  type: string
  count: number
}

interface BlotterByStatus {
  status: string
  count: number
  color: string
}

export default function BarangayDetailPage() {
  const router = useRouter()
  const params = useParams()
  const barangayId = params.barangayId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [barangay, setBarangay] = useState<BarangayData | null>(null)
  const [stats, setStats] = useState<Stats>({
    totalResidents: 0,
    totalHouseholds: 0,
    totalVoters: 0,
    totalSenior: 0,
    totalPWD: 0,
    totalSoloParent: 0,
    totalOFW: 0,
    docsThisMonth: 0,
    blotterThisMonth: 0,
    activeUsers: 0,
    totalOfficials: 0,
    activeTanod: 0,
  })
  const [purokData, setPurokData] = useState<{ name: string; count: number }[]>([])
  const [officials, setOfficials] = useState<Official[]>([])
  const [skOfficials, setSkOfficials] = useState<any[]>([])
  const [tanodList, setTanodList] = useState<any[]>([])
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [recentBlotter, setRecentBlotter] = useState<any[]>([])
  const [docsByType, setDocsByType] = useState<DocByType[]>([])
  const [blotterByStatus, setBlotterByStatus] = useState<BlotterByStatus[]>([])
  const [monthlyDocs, setMonthlyDocs] = useState<{ month: string; count: number }[]>([])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: cityRole } = await supabase
          .from('city_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        if (!cityRole) {
          router.push('/dashboard')
          return
        }

        // 1. Barangay info
        const { data: brgy } = await supabase
          .from('barangays')
          .select('*')
          .eq('id', barangayId)
          .single()

        if (!brgy) {
          router.push('/city-admin/barangays')
          return
        }

        setBarangay(brgy)

        // 2. Residents stats
        const { data: residents } = await supabase
          .from('residents')
          .select('sex, is_pwd, is_senior_citizen, is_solo_parent, is_voter, is_ofw, purok:puroks(name)')
          .eq('barangay_id', barangayId)
          .eq('is_deceased', false)
          .eq('is_transferred', false)

        const residentsData = residents ?? []
        const purokMap: Record<string, number> = {}
        residentsData.forEach(r => {
          const purokName = r.purok?.name ?? 'No Purok'
          purokMap[purokName] = (purokMap[purokName] ?? 0) + 1
        })

        setPurokData(
          Object.entries(purokMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6)
        )

        // 3. Households count
        const { count: hhCount } = await supabase
          .from('households')
          .select('id', { count: 'exact' })
          .eq('barangay_id', barangayId)

        // 4. Officials
        const { data: offs } = await supabase
          .from('barangay_officials')
          .select('full_name, position, contact_number, term_end, is_active')
          .eq('barangay_id', barangayId)
          .eq('is_active', true)
          .order('position')

        setOfficials(offs ?? [])

        // 5. SK Officials
        const { data: sk } = await supabase
          .from('sk_officials')
          .select('full_name, position, is_active')
          .eq('barangay_id', barangayId)
          .eq('is_active', true)

        setSkOfficials(sk ?? [])

        // 6. Tanod
        const { data: tanod } = await supabase
          .from('barangay_tanod')
          .select('full_name, status')
          .eq('barangay_id', barangayId)

        setTanodList(tanod ?? [])

        // 7. Documents this month
        const thisMonth = new Date().toISOString().slice(0, 7)
        const { data: docs } = await supabase
          .from('issued_documents')
          .select('document_type, issued_date, status, resident_name')
          .eq('barangay_id', barangayId)
          .gte('issued_date', thisMonth + '-01')

        const docsData = docs ?? []
        const docsByTypeMap: Record<string, number> = {}
        docsData.forEach(d => {
          docsByTypeMap[d.document_type] = (docsByTypeMap[d.document_type] ?? 0) + 1
        })
        setDocsByType(
          Object.entries(docsByTypeMap)
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => b.count - a.count)
        )

        // 8. Recent docs
        const { data: recent } = await supabase
          .from('issued_documents')
          .select('resident_name, document_type, issued_date, status')
          .eq('barangay_id', barangayId)
          .order('created_at', { ascending: false })
          .limit(5)

        setRecentDocs(recent ?? [])

        // 9. Blotter this month
        const firstOfMonth = new Date()
        firstOfMonth.setDate(1)
        const { data: blotters } = await supabase
          .from('blotter_records')
          .select('status, incident_type_name, complainant_name, created_at')
          .eq('barangay_id', barangayId)
          .gte('created_at', firstOfMonth.toISOString())

        const blottersData = blotters ?? []
        const blotterByStatusMap: Record<string, number> = {}
        const statusColors: Record<string, string> = {
          'Filed': '#3B82F6',
          'Summoned': '#EAB308',
          'Mediation Scheduled': '#F97316',
          'Settled': '#22C55E',
          'Referred to Court': '#EF4444',
          'Dismissed': '#94A3B8',
        }
        blottersData.forEach(b => {
          blotterByStatusMap[b.status] = (blotterByStatusMap[b.status] ?? 0) + 1
        })
        setBlotterByStatus(
          Object.entries(blotterByStatusMap).map(([status, count]) => ({
            status,
            count,
            color: statusColors[status] ?? '#94A3B8',
          }))
        )

        // 10. Recent blotter
        const { data: recentBlo } = await supabase
          .from('blotter_records')
          .select('complainant_name, incident_type_name, status, created_at')
          .eq('barangay_id', barangayId)
          .order('created_at', { ascending: false })
          .limit(4)

        setRecentBlotter(recentBlo ?? [])

        // 11. Active users
        const { count: userCount } = await supabase
          .from('user_profiles')
          .select('id', { count: 'exact' })
          .eq('barangay_id', barangayId)
          .eq('is_active', true)

        // 12. Monthly docs
        const monthlyData: { month: string; count: number }[] = []
        for (let i = 5; i >= 0; i--) {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          const year = d.getFullYear()
          const month = d.getMonth()
          const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`
          const lastDay = new Date(year, month + 1, 0)
          const lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`
          const { count } = await supabase
            .from('issued_documents')
            .select('id', { count: 'exact' })
            .eq('barangay_id', barangayId)
            .gte('issued_date', firstDay)
            .lte('issued_date', lastDayStr)

          monthlyData.push({
            month: d.toLocaleDateString('en-PH', { month: 'short' }),
            count: count ?? 0,
          })
        }
        setMonthlyDocs(monthlyData)

        // Set all stats
        setStats({
          totalResidents: residentsData.length,
          totalHouseholds: hhCount ?? 0,
          totalVoters: residentsData.filter(r => r.is_voter).length,
          totalSenior: residentsData.filter(r => r.is_senior_citizen).length,
          totalPWD: residentsData.filter(r => r.is_pwd).length,
          totalSoloParent: residentsData.filter(r => r.is_solo_parent).length,
          totalOFW: residentsData.filter(r => r.is_ofw).length,
          docsThisMonth: docsData.length,
          blotterThisMonth: blottersData.length,
          activeUsers: userCount ?? 0,
          totalOfficials: (offs ?? []).length,
          activeTanod: (tanod ?? []).length,
        })

        setLoading(false)
      } catch (error) {
        console.error('Error loading barangay details:', error)
        setLoading(false)
      }
    }

    load()
  }, [barangayId])

  if (loading) {
    return <div className={styles.loading}>Loading barangay details...</div>
  }

  if (!barangay) {
    return <div className={styles.errorState}>Barangay not found</div>
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const logoUrl = barangay.logo_path
    ? `${supabaseUrl}/storage/v1/object/public/barangay-assets/${barangay.logo_path}`
    : null

  const maxPurok = Math.max(...purokData.map(p => p.count), 1)
  const maxDocType = Math.max(...docsByType.map(d => d.count), 1)
  const maxMonthly = Math.max(...monthlyDocs.map(m => m.count), 1)

  const kpiCards = [
    { label: 'Total Residents', value: stats.totalResidents, bg: '#EFF6FF', color: '#1E3A8A', icon: Users },
    { label: 'Total Households', value: stats.totalHouseholds, bg: '#F0FDF4', color: '#059669', icon: Home },
    { label: 'Registered Voters', value: stats.totalVoters, bg: '#ECFDF5', color: '#059669', icon: UserCheck },
    { label: 'Senior Citizens', value: stats.totalSenior, bg: '#FFF7ED', color: '#EA580C', icon: Users },
    { label: 'PWD', value: stats.totalPWD, bg: '#FDF2F8', color: '#DB2777', icon: Users },
    { label: 'Solo Parents', value: stats.totalSoloParent, bg: '#F5F3FF', color: '#7C3AED', icon: Users },
    { label: 'OFW', value: stats.totalOFW, bg: '#F0FDFA', color: '#0D9488', icon: Users },
    { label: 'Active Users', value: stats.activeUsers, bg: '#FFFBEB', color: '#D97706', icon: Activity },
    { label: 'Docs This Month', value: stats.docsThisMonth, bg: '#FFFBEB', color: '#D97706', icon: FileText },
    { label: 'Blotter This Month', value: stats.blotterThisMonth, bg: '#FEF2F2', color: '#DC2626', icon: BookOpen },
    { label: 'Active Tanod', value: stats.activeTanod, bg: '#ECFDF5', color: '#059669', icon: Shield },
    { label: 'Active Officials', value: stats.totalOfficials, bg: '#EFF6FF', color: '#1E3A8A', icon: UserCheck },
  ]

  const tabs = ['overview', 'officials', 'certificates', 'blotter', 'reports', 'users', 'settings']
  const tabLabels: Record<string, string> = {
    overview: 'Overview',
    officials: 'Officials',
    certificates: 'Certificates',
    blotter: 'Blotter',
    reports: 'Reports',
    users: 'Users',
    settings: 'Settings',
  }

  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/city-admin" className={styles.breadcrumbItem}>
          City Admin
        </Link>
        <span className={styles.breadcrumbSeparator}>›</span>
        <Link href="/city-admin/barangays" className={styles.breadcrumbItem}>
          Barangays
        </Link>
        <span className={styles.breadcrumbSeparator}>›</span>
        <span>{barangay.name}</span>
      </div>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <Link href="/city-admin/barangays" className={styles.backButton}>
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className={styles.pageTitle}>{barangay.name}</h1>
          <span
            className={styles.statusBadge}
            style={{
              background: barangay.status === 'active' ? '#F0FDF4' : '#F3F4F6',
              color: barangay.status === 'active' ? '#16a34a' : '#64748b',
            }}
          >
            {barangay.status || 'inactive'}
          </span>
        </div>
      </div>

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.logoCircle}>
          {logoUrl ? (
            <img src={logoUrl} alt={barangay.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '28px',
              fontWeight: 700,
            }}>
              {barangay.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className={styles.profileInfo}>
          <p className={styles.profileName}>{barangay.name}</p>
          <p className={styles.profileCity}>
            {barangay.city}, {barangay.province}
          </p>

          <div className={styles.infoGrid}>
            {barangay.contact_number && (
              <div className={styles.infoItem}>
                <Phone size={16} className={styles.infoIcon} />
                <span className={styles.infoText}>{barangay.contact_number}</span>
              </div>
            )}
            {barangay.email_address && (
              <div className={styles.infoItem}>
                <Mail size={16} className={styles.infoIcon} />
                <span className={styles.infoText}>{barangay.email_address}</span>
              </div>
            )}
            <div className={styles.infoItem}>
              <MapPin size={16} className={styles.infoIcon} />
              <span className={styles.infoText}>Tangub City, Misamis Occidental</span>
            </div>
            {barangay.onboarded_at && (
              <div className={styles.infoItem}>
                <Calendar size={16} className={styles.infoIcon} />
                <span className={styles.infoText}>
                  Onboarded: {new Date(barangay.onboarded_at).toLocaleDateString('en-PH')}
                </span>
              </div>
            )}
            <div className={styles.infoItem}>
              <Clock size={16} className={styles.infoIcon} />
              <span className={styles.infoText}>
                Last Activity: {barangay.last_activity_at ? new Date(barangay.last_activity_at).toLocaleDateString('en-PH') : 'No activity yet'}
              </span>
            </div>
            <div className={styles.infoItem}>
              <Users size={16} className={styles.infoIcon} />
              <span className={styles.infoText}>{stats.activeUsers} Active Users</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabBar}>
        <div className={styles.tabList}>
          {tabs.map(tab => (
            <button
              key={tab}
              className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div style={{ paddingTop: '24px' }}>
          {/* KPI Cards */}
          <h2 className={styles.sectionLabel}>Barangay Statistics</h2>
          <div className={styles.kpiGrid}>
            {kpiCards.map((card, idx) => (
              <div key={idx} className={styles.kpiCard}>
                <div className={styles.kpiIconBox} style={{ background: card.bg }}>
                  <card.icon size={20} color={card.color} />
                </div>
                <p className={styles.kpiLabel}>{card.label}</p>
                <p className={styles.kpiNumber}>{card.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className={styles.twoCol}>
            {/* Population by Purok */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Population by Purok</h3>
              </div>
              {purokData.length === 0 ? (
                <p className={styles.empty}>No purok data</p>
              ) : (
                <div className={styles.barChart}>
                  {purokData.map(p => (
                    <div key={p.name} className={styles.barRow}>
                      <span className={styles.barLabel}>{p.name}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{ width: `${(p.count / maxPurok) * 100}%` }}
                        />
                      </div>
                      <span className={styles.barValue}>{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Documents by Type */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Documents by Type</h3>
              </div>
              {docsByType.length === 0 ? (
                <p className={styles.empty}>No documents</p>
              ) : (
                <div className={styles.barChart}>
                  {docsByType.map(d => (
                    <div key={d.type} className={styles.barRow}>
                      <span className={styles.barLabel}>{d.type}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={styles.barFill}
                          style={{
                            width: `${(d.count / maxDocType) * 100}%`,
                            background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
                          }}
                        />
                      </div>
                      <span className={styles.barValue}>{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Charts Row 2 */}
          <div className={styles.twoCol}>
            {/* Monthly Docs */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Documents - Last 6 Months</h3>
              </div>
              {monthlyDocs.every(m => m.count === 0) ? (
                <p className={styles.empty}>No documents</p>
              ) : (
                <div className={styles.trendChart}>
                  {monthlyDocs.map(m => (
                    <div key={m.month} className={styles.trendCol}>
                      {m.count > 0 && <span className={styles.trendValue}>{m.count}</span>}
                      <div
                        className={styles.trendBar}
                        style={{
                          height: `${Math.max((m.count / maxMonthly) * 100, m.count > 0 ? 12 : 4)}px`,
                          background: m.count > 0 ? 'linear-gradient(180deg, #F59E0B 0%, #D97706 100%)' : '#F3F4F6',
                        }}
                      />
                      <span className={styles.trendLabel}>{m.month}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Blotter by Status */}
            <div className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <h3 className={styles.chartTitle}>Blotter Cases</h3>
              </div>
              {blotterByStatus.length === 0 ? (
                <p className={styles.empty}>No blotter cases</p>
              ) : (
                <div className={styles.blotterProgress}>
                  {blotterByStatus.map(b => (
                    <div key={b.status} className={styles.blotterRow}>
                      <div className={styles.blotterRowTop}>
                        <span className={styles.blotterLabel}>{b.status}</span>
                        <span className={styles.blotterCount}>{b.count}</span>
                      </div>
                      <div className={styles.blotterTrack}>
                        <div className={styles.blotterFill} style={{ width: '100%', background: b.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className={styles.twoCol}>
            {/* Recent Documents */}
            <div className={styles.recentCard}>
              <div className={styles.recentHeader}>
                <h3 className={styles.chartTitle}>Recent Documents</h3>
                <Link href="#" className={styles.viewAllLink}>
                  View All →
                </Link>
              </div>
              {recentDocs.length === 0 ? (
                <p className={styles.empty}>No documents</p>
              ) : (
                <div className={styles.recentList}>
                  {recentDocs.map((doc, idx) => (
                    <div key={idx} className={styles.recentItem}>
                      <div className={styles.recentIcon} style={{ background: '#FFFBEB' }}>
                        <FileText size={14} color="#D97706" />
                      </div>
                      <div className={styles.recentBody}>
                        <p className={styles.recentTitle}>{doc.resident_name}</p>
                        <p className={styles.recentSub}>{doc.document_type}</p>
                      </div>
                      <span
                        className={styles.recentBadge}
                        style={{
                          background: doc.status === 'Issued' ? '#F0FDF4' : '#FEF2F2',
                          color: doc.status === 'Issued' ? '#16a34a' : '#dc2626',
                        }}
                      >
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Blotter */}
            <div className={styles.recentCard}>
              <div className={styles.recentHeader}>
                <h3 className={styles.chartTitle}>Recent Blotter</h3>
                <Link href="#" className={styles.viewAllLink}>
                  View All →
                </Link>
              </div>
              {recentBlotter.length === 0 ? (
                <p className={styles.empty}>No blotter cases</p>
              ) : (
                <div className={styles.recentList}>
                  {recentBlotter.map((blotter, idx) => (
                    <div key={idx} className={styles.recentItem}>
                      <div className={styles.recentIcon} style={{ background: '#FEF2F2' }}>
                        <BookOpen size={14} color="#DC2626" />
                      </div>
                      <div className={styles.recentBody}>
                        <p className={styles.recentTitle}>{blotter.complainant_name}</p>
                        <p className={styles.recentSub}>{blotter.incident_type_name}</p>
                      </div>
                      <span
                        className={styles.recentBadge}
                        style={{
                          background: blotter.status === 'Settled' ? '#F0FDF4' : '#FEF3C7',
                          color: blotter.status === 'Settled' ? '#16a34a' : '#92400e',
                        }}
                      >
                        {blotter.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'officials' && (
        <div style={{ paddingTop: '24px' }}>
          {/* Barangay Officials */}
          <div className={styles.officialsSection}>
            <h3 className={styles.officialsTitle}>Barangay Officials</h3>
            {officials.length === 0 ? (
              <p className={styles.empty}>No officials</p>
            ) : (
              <table className={styles.officialsTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                    <th>Contact</th>
                    <th>Term End</th>
                  </tr>
                </thead>
                <tbody>
                  {officials.map((off, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td>{off.full_name}</td>
                      <td>{off.position}</td>
                      <td>{off.contact_number || '—'}</td>
                      <td>{off.term_end ? new Date(off.term_end).toLocaleDateString('en-PH') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* SK Officials */}
          <div className={styles.officialsSection}>
            <h3 className={styles.officialsTitle}>SK Officials</h3>
            {skOfficials.length === 0 ? (
              <p className={styles.empty}>No SK officials</p>
            ) : (
              <table className={styles.officialsTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Position</th>
                  </tr>
                </thead>
                <tbody>
                  {skOfficials.map((sk, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td>{sk.full_name}</td>
                      <td>{sk.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Tanod */}
          <div className={styles.officialsSection}>
            <h3 className={styles.officialsTitle}>Barangay Tanod</h3>
            {tanodList.length === 0 ? (
              <p className={styles.empty}>No tanod</p>
            ) : (
              <table className={styles.officialsTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tanodList.map((tanod, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                      <td>{tanod.full_name}</td>
                      <td>{tanod.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {['certificates', 'blotter', 'reports', 'users', 'settings'].includes(activeTab) && (
        <div className={styles.comingSoon}>
          <div className={styles.comingSoonIcon}>
            <Building2 size={48} color="#E2E8F0" />
          </div>
          <h3 className={styles.comingSoonTitle}>Coming Soon</h3>
          <p className={styles.comingSoonText}>This section is under development</p>
        </div>
      )}
    </div>
  )
}
