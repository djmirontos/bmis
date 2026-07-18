'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  Building2, Users, Home, FileText, BookOpen, UserCheck, Activity
} from 'lucide-react'
import styles from './city-admin.module.css'

interface CityUser {
  full_name: string
  role: string
}

interface Barangay {
  id: string
  name: string
  status: string
  captain_name: string | null
  subscription_status: string | null
  onboarded_at: string | null
  last_activity_at: string | null
}

interface CityStats {
  totalBarangays: number
  activeBarangays: number
  totalResidents: number
  totalHouseholds: number
  totalDocuments: number
  totalBlotter: number
  totalPWD: number
  totalSenior: number
  totalVoters: number
  totalSoloParent: number
}

interface RecentActivity {
  id: string
  resident_name: string
  document_type: string
  issued_date: string
  barangay_id: string
}

export default function CityAdminDashboard() {
  const supabase = createClient()
  const [cityUser, setCityUser] = useState<CityUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [cityStats, setCityStats] = useState<CityStats>({
    totalBarangays: 0,
    activeBarangays: 0,
    totalResidents: 0,
    totalHouseholds: 0,
    totalDocuments: 0,
    totalBlotter: 0,
    totalPWD: 0,
    totalSenior: 0,
    totalVoters: 0,
    totalSoloParent: 0,
  })
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([])
  const [monthlyDocs, setMonthlyDocs] = useState<{ month: string; count: number }[]>([])

  useEffect(() => {
    async function load() {
      try {
        // Get city user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: cityRole } = await supabase
          .from('city_roles')
          .select('role, full_name')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single()

        if (cityRole) setCityUser(cityRole)

        // Get all barangays
        const { data: brgyList } = await supabase
          .from('barangays')
          .select('id, name, status, captain_name, subscription_status, onboarded_at, last_activity_at')
          .order('name')

        setBarangays(brgyList ?? [])

        // Fetch all stats in parallel
        const [
          { count: totalRes },
          { count: totalHh },
          { count: totalDocs },
          { count: totalBlotters },
          { data: pwdRes },
          { data: seniorRes },
          { data: voterRes },
          { data: soloParentRes },
        ] = await Promise.all([
          supabase.from('residents').select('id', { count: 'exact' }).eq('is_deceased', false).eq('is_transferred', false),
          supabase.from('households').select('id', { count: 'exact' }),
          supabase.from('issued_documents').select('id', { count: 'exact' }).eq('status', 'Issued'),
          supabase.from('blotter_records').select('id', { count: 'exact' }),
          supabase.from('residents').select('id', { count: 'exact' }).eq('is_pwd', true).eq('is_deceased', false),
          supabase.from('residents').select('id', { count: 'exact' }).eq('is_senior_citizen', true).eq('is_deceased', false),
          supabase.from('residents').select('id', { count: 'exact' }).eq('is_voter', true).eq('is_deceased', false),
          supabase.from('residents').select('id', { count: 'exact' }).eq('is_solo_parent', true).eq('is_deceased', false),
        ])

        const activeCount = (brgyList ?? []).filter(b => b.status === 'active').length

        setCityStats({
          totalBarangays: brgyList?.length ?? 0,
          activeBarangays: activeCount,
          totalResidents: totalRes ?? 0,
          totalHouseholds: totalHh ?? 0,
          totalDocuments: totalDocs ?? 0,
          totalBlotter: totalBlotters ?? 0,
          totalPWD: pwdRes?.length ?? 0,
          totalSenior: seniorRes?.length ?? 0,
          totalVoters: voterRes?.length ?? 0,
          totalSoloParent: soloParentRes?.length ?? 0,
        })

        // Recent activity
        const { data: recentDocs } = await supabase
          .from('issued_documents')
          .select('id, resident_name, document_type, issued_date, barangay_id')
          .order('issued_date', { ascending: false })
          .limit(5)

        setRecentActivity(recentDocs ?? [])

        // Monthly docs
        const months: { month: string; count: number }[] = []
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
            .gte('issued_date', firstDay)
            .lte('issued_date', lastDayStr)
            .eq('status', 'Issued')

          const monthName = d.toLocaleDateString('en-PH', { month: 'short' })
          months.push({ month: monthName, count: count ?? 0 })
        }
        setMonthlyDocs(months)

        setLoading(false)
      } catch (error) {
        console.error('Error loading dashboard:', error)
        setLoading(false)
      }
    }

    load()
  }, [])

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const maxDocs = Math.max(...monthlyDocs.map(m => m.count), 1)

  const kpiCards = [
    { label: 'Active Barangays', value: cityStats.activeBarangays, icon: Building2, bg: '#EFF6FF', color: '#1E3A8A' },
    { label: 'Total Residents', value: cityStats.totalResidents, icon: Users, bg: '#F0FDF4', color: '#059669' },
    { label: 'Total Households', value: cityStats.totalHouseholds, icon: Home, bg: '#F5F3FF', color: '#7C3AED' },
    { label: 'Documents Issued', value: cityStats.totalDocuments, icon: FileText, bg: '#FFFBEB', color: '#D97706' },
    { label: 'Blotter Cases', value: cityStats.totalBlotter, icon: BookOpen, bg: '#FEF2F2', color: '#DC2626' },
    { label: 'Registered Voters', value: cityStats.totalVoters, icon: UserCheck, bg: '#ECFDF5', color: '#059669' },
    { label: 'Senior Citizens', value: cityStats.totalSenior, icon: Users, bg: '#FFF7ED', color: '#EA580C' },
    { label: 'PWD', value: cityStats.totalPWD, icon: Users, bg: '#FDF2F8', color: '#DB2777' },
  ]

  if (loading) return <div className={styles.loading}>Loading command center...</div>

  return (
    <div className={styles.dashboardContainer}>
      {/* Hero Banner */}
      <div className={styles.heroBanner}>
        <div className={styles.heroLeft}>
          <p className={styles.heroLabel}>Tangub City Local Government Unit</p>
          <h1 className={styles.heroTitle}>Command Center</h1>
          <p className={styles.heroSubtitle}>
            City-wide Barangay Management & Analytics Platform
          </p>
        </div>

        <div className={styles.heroRight}>
          <p className={styles.heroWelcome}>
            Welcome, <strong>{cityUser?.full_name}</strong>
          </p>
          <span className={styles.welcomeBadge}>
            {cityUser?.role.replace(/_/g, ' ')}
          </span>
          <p className={styles.heroDate}>{today}</p>
          <div className={styles.heroStats}>
            <div className={styles.heroStatItem}>
              {cityStats.activeBarangays} <span>Active Barangays</span>
            </div>
            <div className={styles.heroStatItem}>
              {cityStats.totalResidents.toLocaleString()} <span>Residents</span>
            </div>
            <div className={styles.heroStatItem}>
              {cityStats.totalDocuments.toLocaleString()} <span>Documents</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <h2 className={styles.sectionLabel}>City-Wide Overview</h2>
      <div className={styles.kpiGrid}>
        {kpiCards.map((card, idx) => (
          <div key={idx} className={styles.kpiCard}>
            <div className={styles.kpiIconBox} style={{ background: card.bg }}>
              <card.icon size={22} color={card.color} />
            </div>
            <p className={styles.kpiLabel}>{card.label}</p>
            <p className={styles.kpiNumber}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Barangay Table */}
      <h2 className={styles.sectionLabel} style={{ marginTop: '32px' }}>Barangay Overview</h2>
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead className={styles.tableHead}>
              <tr>
                <th className={styles.tableCell}>Barangay Name</th>
                <th className={styles.tableCell}>Status</th>
                <th className={styles.tableCell}>Captain</th>
                <th className={styles.tableCell}>Subscription</th>
                <th className={styles.tableCell}>Onboarded</th>
                <th className={styles.tableCell}>Last Activity</th>
                <th className={styles.tableCell}>Action</th>
              </tr>
            </thead>
            <tbody>
              {barangays.map((brgy, idx) => (
                <tr key={brgy.id} className={styles.tableRow} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                  <td className={styles.tableCell}>{brgy.name}</td>
                  <td className={styles.tableCell}>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: brgy.status === 'active' ? '#F0FDF4' : brgy.status === 'suspended' ? '#FEF2F2' : '#F3F4F6',
                        color: brgy.status === 'active' ? '#16a34a' : brgy.status === 'suspended' ? '#dc2626' : '#64748b',
                      }}
                    >
                      {brgy.status || 'inactive'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>{brgy.captain_name || '—'}</td>
                  <td className={styles.tableCell}>
                    <span
                      className={styles.statusBadge}
                      style={{
                        background: brgy.subscription_status === 'active' ? '#F0FDF4' : '#FEF3C7',
                        color: brgy.subscription_status === 'active' ? '#16a34a' : '#92400e',
                      }}
                    >
                      {brgy.subscription_status || 'trial'}
                    </span>
                  </td>
                  <td className={styles.tableCell}>
                    {brgy.onboarded_at ? new Date(brgy.onboarded_at).toLocaleDateString('en-PH') : '—'}
                  </td>
                  <td className={styles.tableCell}>
                    {brgy.last_activity_at ? new Date(brgy.last_activity_at).toLocaleDateString('en-PH') : '—'}
                  </td>
                  <td className={styles.tableCell}>
                    <Link href={`/city-admin/barangays/${brgy.id}`} className={styles.viewButton}>
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Charts + Activity */}
      <div className={styles.twoCol}>
        {/* Monthly Docs Chart */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Documents Issued — Last 6 Months</h3>
          </div>
          <div className={styles.docsChart}>
            {monthlyDocs.map(m => (
              <div key={m.month} className={styles.docsBarn}>
                {m.count > 0 && (
                  <div className={styles.docsBarValue}>{m.count}</div>
                )}
                <div
                  className={styles.docsBarFill}
                  style={{ height: `${Math.max((m.count / maxDocs) * 100, m.count > 0 ? 12 : 4)}px` }}
                />
                <span className={styles.docsBarLabel}>{m.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className={styles.activityCard}>
          <div className={styles.activityCardHeader}>
            <h3 className={styles.chartTitle}>Recent Activity</h3>
          </div>
          <div className={styles.activityList}>
            {recentActivity.length === 0 ? (
              <p className={styles.empty}>No recent activity</p>
            ) : (
              recentActivity.map(activity => (
                <div key={activity.id} className={styles.activityItem}>
                  <div className={styles.activityIcon} style={{ background: '#FFFBEB' }}>
                    <FileText size={14} color="#D97706" />
                  </div>
                  <div className={styles.activityBody}>
                    <p className={styles.activityTitle}>
                      Document issued to <strong>{activity.resident_name}</strong>
                    </p>
                    <p className={styles.activityMeta}>
                      {activity.document_type} • {new Date(activity.issued_date).toLocaleDateString('en-PH')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
