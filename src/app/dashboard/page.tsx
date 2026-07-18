'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Users, Home, UserCheck, Shield, FileText, BookOpen } from 'lucide-react'
import styles from './dashboard.module.css'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function getMonthName(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() - offset)
  return d.toLocaleDateString('en-PH', { month: 'short' })
}

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState({ barangay_name: 'Barangay IV', city: 'Tangub City', province: 'Misamis Occidental' })
  const [stats, setStats] = useState({ residents: 0, households: 0, officials: 0, tanod: 0, docsThisMonth: 0, activeBlotter: 0, male: 0, female: 0, residentsToday: 0, documentsToday: 0, pendingBlotters: 0 })
  const [purokData, setPurokData] = useState<{ name: string, count: number }[]>([])
  const [monthlyDocs, setMonthlyDocs] = useState<{ month: string, count: number }[]>([])
  const [blotterStats, setBlotterStats] = useState({ filed: 0, summoned: 0, mediation: 0, settled: 0, referred: 0, dismissed: 0, total: 0 })
  const [recentDocs, setRecentDocs] = useState<any[]>([])
  const [recentBlotter, setRecentBlotter] = useState<any[]>([])
  const [currentTime, setCurrentTime] = useState('')
  const countUpRefs = useRef<{ [key: string]: { current: number, target: number } }>({})

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-PH', {
        hour: '2-digit', minute: '2-digit', hour12: true
      }))
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    async function load() {
      // Barangay info
      const { data: s } = await supabase.from('barangay_settings').select('barangay_name, city, province').single()
      if (s) setInfo(s)

      const today = new Date().toISOString().split('T')[0]

      // Core stats
      const [res, hh, off, tan] = await Promise.all([
        supabase.from('residents').select('id, sex', { count: 'exact' }).eq('is_deceased', false).eq('is_transferred', false),
        supabase.from('households').select('id', { count: 'exact' }),
        supabase.from('barangay_officials').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('barangay_tanod').select('id', { count: 'exact' }).eq('status', 'Active'),
      ])

      const male = (res.data ?? []).filter((r: any) => r.sex === 'Male').length
      const female = (res.data ?? []).filter((r: any) => r.sex === 'Female').length

      // Docs this month
      const thisMonth = new Date().toISOString().slice(0, 7)
      const { count: docsCount } = await supabase
        .from('issued_documents')
        .select('id', { count: 'exact' })
        .gte('issued_date', thisMonth + '-01')

      // Residents added today
      const { count: residentsCount } = await supabase
        .from('residents')
        .select('id', { count: 'exact' })
        .gte('created_at', today + 'T00:00:00')
        .eq('is_deceased', false)
        .eq('is_transferred', false)

      // Documents issued today
      const { count: docsCountToday } = await supabase
        .from('issued_documents')
        .select('id', { count: 'exact' })
        .gte('issued_date', today)
        .eq('status', 'Issued')

      // Active blotter
      const { count: blotterCount } = await supabase
        .from('blotter_records')
        .select('id', { count: 'exact' })
        .in('status', ['Filed', 'Summoned', 'Mediation Scheduled'])

      setStats({
        residents: res.count ?? 0,
        households: hh.count ?? 0,
        officials: off.count ?? 0,
        tanod: tan.count ?? 0,
        docsThisMonth: docsCount ?? 0,
        activeBlotter: blotterCount ?? 0,
        male,
        female,
        residentsToday: residentsCount ?? 0,
        documentsToday: docsCountToday ?? 0,
        pendingBlotters: blotterCount ?? 0,
      })

      // Population by purok
      const { data: residents } = await supabase
        .from('residents')
        .select('purok:puroks(name)')
        .eq('is_deceased', false)
        .eq('is_transferred', false)

      const purokMap: Record<string, number> = {}
      ;(residents ?? []).forEach((r: any) => {
        const name = r.purok?.name ?? 'No Purok'
        purokMap[name] = (purokMap[name] ?? 0) + 1
      })
      setPurokData(
        Object.entries(purokMap)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
      )

      // Monthly docs - last 6 months
      const months: { month: string, count: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const ym = d.toISOString().slice(0, 7)
        const { count } = await supabase
          .from('issued_documents')
          .select('id', { count: 'exact' })
          .gte('issued_date', ym + '-01')
          .lte('issued_date', ym + '-31')
        months.push({ month: getMonthName(i), count: count ?? 0 })
      }
      setMonthlyDocs(months)

      // Blotter breakdown
      const { data: blotters } = await supabase
        .from('blotter_records')
        .select('status')
      const bs = { filed: 0, summoned: 0, mediation: 0, settled: 0, referred: 0, dismissed: 0, total: 0 }
      ;(blotters ?? []).forEach((b: any) => {
        bs.total++
        if (b.status === 'Filed') bs.filed++
        if (b.status === 'Summoned') bs.summoned++
        if (b.status === 'Mediation Scheduled') bs.mediation++
        if (b.status === 'Settled') bs.settled++
        if (b.status === 'Referred to Court') bs.referred++
        if (b.status === 'Dismissed') bs.dismissed++
      })
      setBlotterStats(bs)

      // Recent docs
      const { data: docs } = await supabase
        .from('issued_documents')
        .select('resident_name, document_type, issued_date, status')
        .order('created_at', { ascending: false })
        .limit(5)
      setRecentDocs(docs ?? [])

      // Recent blotter
      const { data: blo } = await supabase
        .from('blotter_records')
        .select('blotter_number, complainant_name, incident_type_name, status')
        .order('created_at', { ascending: false })
        .limit(4)
      setRecentBlotter(blo ?? [])

      setLoading(false)
    }
    load()
  }, [])

  const today = new Date().toLocaleDateString('en-PH', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  const maxPurok = Math.max(...purokData.map(p => p.count), 1)
  const maxDocs = Math.max(...monthlyDocs.map(m => m.count), 1)

  const kpiCards = [
    { label: 'Residents', value: stats.residents, sub: `${stats.male}M · ${stats.female}F`, icon: Users, href: '/dashboard/residents', className: styles.kpiResidents, badge: stats.residentsToday > 0 ? '● Active' : null },
    { label: 'Households', value: stats.households, sub: 'Registered', icon: Home, href: '/dashboard/households', className: styles.kpiHouseholds, badge: stats.households > 0 ? '● Active' : null },
    { label: 'Officials', value: stats.officials, sub: 'In office', icon: UserCheck, href: '/dashboard/officials', className: styles.kpiOfficials, badge: stats.officials > 0 ? '● Active' : null },
    { label: 'Tanod', value: stats.tanod, sub: 'On duty', icon: Shield, href: '/dashboard/officials', className: styles.kpiTanod, badge: stats.tanod > 0 ? '● Active' : null },
    { label: 'Documents This Month', value: stats.docsThisMonth, sub: 'Issued', icon: FileText, href: '/dashboard/clearance', className: styles.kpiDocuments, badge: stats.documentsToday > 0 ? '● Active' : null },
    { label: 'Active Cases', value: stats.activeBlotter, sub: 'Blotter', icon: BookOpen, href: '/dashboard/blotter', className: styles.kpiBlotter, badge: stats.pendingBlotters > 0 ? `● ${stats.pendingBlotters} Active` : null },
  ]

  if (loading) return (
    <div className={styles.loading}>Loading dashboard...</div>
  )

  const malePercent = stats.residents ? (stats.male / stats.residents) * 100 : 50
  const femalePercent = 100 - malePercent

  return (
    <div className={styles.container}>

      {/* SECTION 1: HERO BANNER */}
      <div className={styles.heroBanner}>
        <div className={styles.heroContent}>
          <p className={styles.heroLabel}>Barangay Management Information System</p>
          <h1 className={styles.heroGreeting}>
            {getGreeting()}, {info.barangay_name}! 👋
          </h1>
          <p className={styles.heroSubtitle}>
            {info.city} • {info.province} • Digital Barangay Services
          </p>
          <div className={styles.heroDivider} />
          <div className={styles.heroHighlights}>
            <span className={styles.heroHighlight}>Residents Added Today: +{stats.residentsToday}</span>
            <span className={styles.heroHighlight}>Documents Issued Today: {stats.documentsToday}</span>
            <span className={styles.heroHighlight}>Pending Blotters: {stats.pendingBlotters}</span>
          </div>
        </div>

        <div className={styles.heroRight}>
          <span className={styles.heroDate}>{today}</span>
          <span className={styles.heroClock}>{currentTime || '--:--'}</span>
          <div className={styles.heroButtons}>
            <button className={`${styles.heroButton} ${styles.heroBtnPrimary}`}>
              ＋ Issue Certificate
            </button>
            <button className={`${styles.heroButton} ${styles.heroBtnSecondary}`}>
              ＋ Add Resident
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: KPI CARDS (TODAY'S OVERVIEW) */}
      <h2 className={styles.sectionLabel}>Today's Overview</h2>
      <div className={styles.kpiGrid}>
        {kpiCards.map((card, idx) => (
          <div key={idx} className={`${styles.kpiCard} ${card.className}`}>
            <div className={styles.kpiTop}>
              <div className={styles.kpiIcon}>
                <card.icon size={24} />
              </div>
              {card.badge && (
                <span className={styles.kpiTrendBadge} style={{
                  background: card.label === 'Active Cases' ? '#FEF2F2' : '#F0FDF4',
                  color: card.label === 'Active Cases' ? '#DC2626' : '#059669'
                }}>
                  {card.badge}
                </span>
              )}
            </div>
            <p className={styles.kpiLabel}>{card.label}</p>
            <p className={styles.kpiNumber}>{card.value.toLocaleString()}</p>
            <p className={styles.kpiSub}>{card.sub}</p>
            <Link href={card.href} className={styles.kpiLink}>
              View →
            </Link>
          </div>
        ))}
      </div>

      {/* SECTION 3: COMMUNITY STATISTICS */}
      <h2 className={styles.sectionLabel}>Community Statistics</h2>
      <div className={styles.statsGrid}>
        {/* Left: Population by Purok */}
        <div className={styles.statCard}>
          <div className={styles.statCardTitle}>
            Population by Purok
            <span className={styles.statBadge}>{stats.residents} total</span>
          </div>
          {purokData.length === 0 ? (
            <p className={styles.empty}>No purok data yet</p>
          ) : (
            <div className={styles.purokChart}>
              {purokData.map(p => (
                <div key={p.name} className={styles.purokRow}>
                  <span className={styles.purokLabel}>{p.name}</span>
                  <div className={styles.purokTrack}>
                    <div
                      className={styles.purokFill}
                      style={{ width: `${(p.count / maxPurok) * 100}%` }}
                    >
                      {(p.count / maxPurok) * 100 > 15 && (
                        <span className={styles.purokValue}>{p.count}</span>
                      )}
                    </div>
                  </div>
                  {(p.count / maxPurok) * 100 <= 15 && (
                    <span className={styles.purokValue}>{p.count}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Sex Distribution + Docs Trend */}
        <div className={styles.statsRight}>
          {/* Sex Distribution */}
          <div className={styles.statCard}>
            <div className={styles.statCardTitle}>
              Sex Distribution
            </div>
            <div className={styles.sexContainer}>
              <div className={styles.sexGrid}>
                <div className={styles.sexBox} style={{ background: '#EFF6FF' }}>
                  <p className={styles.sexNumber} style={{ color: '#1E3A8A' }}>{stats.male}</p>
                  <p className={styles.sexLabel} style={{ color: '#1E3A8A' }}>Male</p>
                  <p className={styles.sexPercent} style={{ color: '#1E3A8A' }}>{malePercent.toFixed(1)}%</p>
                </div>
                <div className={styles.sexBox} style={{ background: '#FDF2F8' }}>
                  <p className={styles.sexNumber} style={{ color: '#DB2777' }}>{stats.female}</p>
                  <p className={styles.sexLabel} style={{ color: '#DB2777' }}>Female</p>
                  <p className={styles.sexPercent} style={{ color: '#DB2777' }}>{femalePercent.toFixed(1)}%</p>
                </div>
              </div>
              <div className={styles.sexSplitBar}>
                <div className={styles.sexMaleFill} style={{ flex: malePercent }} />
                <div className={styles.sexFemaleFill} style={{ flex: femalePercent }} />
              </div>
              <div className={styles.sexLegend}>
                <span style={{ color: '#1E3A8A' }}>● Male</span>
                <span style={{ color: '#DB2777' }}>Female ●</span>
              </div>
            </div>
          </div>

          {/* Documents 6-Month Trend */}
          <div className={styles.statCard}>
            <div className={styles.statCardTitle}>
              Documents Issued — Last 6 Months
            </div>
            {monthlyDocs.every(m => m.count === 0) ? (
              <p className={styles.empty}>No documents issued yet</p>
            ) : (
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
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: RECENT ACTIVITY */}
      <h2 className={styles.sectionLabel}>Recent Activity</h2>
      <div className={styles.activityGrid}>
        {/* Recent Documents */}
        <div className={styles.activityCard}>
          <div className={styles.activityHeader}>
            <h3 className={styles.activityTitle}>Recent Documents</h3>
            <Link href="/dashboard/clearance" className={styles.activityViewLink}>
              View All →
            </Link>
          </div>
          <div className={styles.activityBody}>
            {recentDocs.length === 0 ? (
              <p className={styles.empty}>No documents issued yet</p>
            ) : (
              <div className={styles.activityList}>
                {recentDocs.map((d, i) => {
                  let statusClass = styles.statusIssued
                  if (d.status === 'Voided') statusClass = styles.statusVoided
                  if (d.status === 'Reprinted') statusClass = styles.statusRepri

                  return (
                    <div key={i} className={styles.activityItem}>
                      <div className={styles.activityIcon} style={{ background: '#FFFBEB' }}>
                        <FileText size={16} color="#D97706" />
                      </div>
                      <div className={styles.activityContent}>
                        <p className={styles.activityName}>{d.resident_name}</p>
                        <p className={styles.activityMeta}>
                          {d.document_type} · {new Date(d.issued_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`${styles.activityStatus} ${statusClass}`}>
                        {d.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Blotter */}
        <div className={styles.activityCard}>
          <div className={styles.activityHeader}>
            <h3 className={styles.activityTitle}>Recent Blotter</h3>
            <Link href="/dashboard/blotter" className={styles.activityViewLink}>
              View All →
            </Link>
          </div>
          <div className={styles.activityBody}>
            {recentBlotter.length === 0 ? (
              <p className={styles.empty}>No blotter cases yet</p>
            ) : (
              <div className={styles.activityList}>
                {recentBlotter.map((b, i) => {
                  let statusClass = styles.statusFiled
                  if (b.status === 'Settled') statusClass = styles.statusSettled
                  if (!['Settled', 'Filed'].includes(b.status)) statusClass = styles.statusOther

                  return (
                    <div key={i} className={styles.activityItem}>
                      <div className={styles.activityIcon} style={{ background: '#FEF2F2' }}>
                        <BookOpen size={16} color="#DC2626" />
                      </div>
                      <div className={styles.activityContent}>
                        <p className={styles.activityName}>{b.complainant_name}</p>
                        <p className={styles.activityMeta}>
                          {b.blotter_number} · {b.incident_type_name}
                        </p>
                      </div>
                      <span className={`${styles.activityStatus} ${statusClass}`}>
                        {b.status}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
