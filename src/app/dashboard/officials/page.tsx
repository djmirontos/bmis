'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import {
  UserCheck, Plus, AlertTriangle,
  Clock, Shield, Users
} from 'lucide-react'
import type { BarangayOfficial, SKOfficial, BarangayTanod } from '@/lib/types'
import styles from './styles/officials.module.css'

const POSITION_ORDER = [
  'Punong Barangay', 'Barangay Secretary',
  'Barangay Treasurer', 'Barangay Kagawad'
]
const SK_POSITION_ORDER = [
  'SK Chairperson', 'SK Secretary',
  'SK Treasurer', 'SK Kagawad'
]
const TANOD_STATUS_COLORS: Record<string, { bg: string, color: string, border: string }> = {
  Active:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Inactive:  { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  Suspended: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  Resigned:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
}
const POSITION_COLORS: Record<string, { bg: string, color: string, border: string }> = {
  'Punong Barangay':    { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  'Barangay Kagawad':   { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'Barangay Secretary': { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'Barangay Treasurer': { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
  'SK Chairperson':     { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  'SK Kagawad':         { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  'SK Secretary':       { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
  'SK Treasurer':       { bg: '#fdf4ff', color: '#7e22ce', border: '#e9d5ff' },
}

function getDaysUntilExpiry(termEnd: string): number {
  const end = new Date(termEnd)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean)
    .slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function ExpiryBadge({ termEnd }: { termEnd: string }) {
  const days = getDaysUntilExpiry(termEnd)
  if (days > 90) return null
  if (days < 0) return (
    <span className={`${styles.expiryBadge} ${styles.expiryExpired}`}>
      <AlertTriangle size={10} /> Expired
    </span>
  )
  return (
    <span className={`${styles.expiryBadge} ${styles.expiryWarning}`}>
      <Clock size={10} /> {days}d left
    </span>
  )
}

function PositionBadge({ position }: { position: string }) {
  const colors = POSITION_COLORS[position] ?? {
    bg: '#f8fafc', color: '#64748b', border: '#e2e8f0'
  }
  return (
    <span
      className={styles.positionBadge}
      style={{ background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}
    >
      {position}
    </span>
  )
}

function OfficialAvatar({ name }: { name: string }) {
  return (
    <div className={styles.avatar}>{getInitials(name)}</div>
  )
}

function TabButton({ label, icon: Icon, active, count, onClick }: {
  label: string, icon: any, active: boolean, count: number, onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`${styles.tabButton} ${active ? styles.tabButtonActive : ''}`}
    >
      <Icon size={15} />
      {label}
      <span className={`${styles.tabCount} ${active ? styles.tabCountActive : ''}`}>
        {count}
      </span>
    </button>
  )
}

export default function OfficialsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'officials' | 'sk' | 'tanod'>('officials')
  const [showHistory, setShowHistory] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [officials, setOfficials] = useState<BarangayOfficial[]>([])
  const [skOfficials, setSKOfficials] = useState<SKOfficial[]>([])
  const [tanod, setTanod] = useState<BarangayTanod[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_profiles').select('role').eq('id', user.id).single()
      if (data) setUserRole(data.role)
    }
    getRole()
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: off }, { data: sk }, { data: tan }] = await Promise.all([
      supabase.from('barangay_officials').select('*')
        .eq('is_active', !showHistory)
        .order('term_end', { ascending: true }),
      supabase.from('sk_officials').select('*')
        .eq('is_active', !showHistory)
        .order('term_end', { ascending: true }),
      supabase.from('barangay_tanod').select('*')
        .order('full_name', { ascending: true }),
    ])

    setOfficials((off ?? []).sort((a, b) =>
      POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position)
    ))
    setSKOfficials((sk ?? []).sort((a, b) =>
      SK_POSITION_ORDER.indexOf(a.position) - SK_POSITION_ORDER.indexOf(b.position)
    ))
    setTanod(tan ?? [])
    setLoading(false)
  }, [showHistory])

  useEffect(() => { fetchData() }, [fetchData])

  const canManage = ['super_admin', 'captain', 'secretary'].includes(userRole)

  const addLinks = {
    officials: '/dashboard/officials/new',
    sk: '/dashboard/officials/new?type=sk',
    tanod: '/dashboard/officials/new?type=tanod',
  }
  const addLabels = {
    officials: 'Add Official',
    sk: 'Add SK Official',
    tanod: 'Add Tanod',
  }

  function OfficialsTab() {
    if (officials.length === 0) return (
      <div className={styles.emptyState}>
        <UserCheck size={44} className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          {showHistory ? 'No past officials found.' : 'No active officials registered yet.'}
        </p>
      </div>
    )
    return (
      <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Official</th>
              <th>Position</th>
              <th>Committee</th>
              <th>Term</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {officials.map(o => (
              <tr key={o.id} className={styles.tableRow}>
                <td className={styles.tableCell}>
                  <div className={styles.officialCell}>
                    <OfficialAvatar name={o.full_name} />
                    <span className={styles.officialName}>{o.full_name}</span>
                  </div>
                </td>
                <td className={styles.tableCell}>
                  <PositionBadge position={o.position} />
                </td>
                <td className={styles.tableCell} style={{ fontSize: 13, color: '#64748b' }}>
                  {o.committee ?? '—'}
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.termDates}>
                    {new Date(o.term_start).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} –{' '}
                    {new Date(o.term_end).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                  </div>
                  {o.is_active && <ExpiryBadge termEnd={o.term_end} />}
                </td>
                <td className={styles.tableCell} style={{ fontSize: 13, color: '#64748b' }}>
                  {o.contact_number ?? '—'}
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.actionGroup}>
                    <Link href={`/dashboard/officials/${o.id}`} className={styles.viewButton}>
                      View
                    </Link>
                    {canManage && (
                      <Link href={`/dashboard/officials/${o.id}/edit`} className={styles.editButton}>
                        Edit
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.cardList}>
        {officials.map(o => (
          <div key={o.id} className={styles.officialCard}>
            <div className={styles.cardAvatar}>{getInitials(o.full_name)}</div>
            <div className={styles.cardBody}>
              <p className={styles.cardName}>{o.full_name}</p>
              <div className={styles.cardMeta}>
                <span>{o.committee ?? 'No Committee'}</span>
                <span className={styles.cardMetaDot}>•</span>
                <span>{o.contact_number ?? 'No contact'}</span>
              </div>
              <div className={styles.cardBadges}>
                <PositionBadge position={o.position} />
                {o.is_active && <ExpiryBadge termEnd={o.term_end} />}
              </div>
              <div className={styles.cardMeta}>
                {new Date(o.term_start).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} –{' '}
                {new Date(o.term_end).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
              </div>
              <div className={styles.cardActionGroup}>
                <Link href={`/dashboard/officials/${o.id}`} className={styles.cardViewButton}>View</Link>
                {canManage && (
                  <Link href={`/dashboard/officials/${o.id}/edit`} className={styles.cardEditButton}>Edit</Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
    )
  }

  function SKTab() {
    if (skOfficials.length === 0) return (
      <div className={styles.emptyState}>
        <Users size={44} className={styles.emptyIcon} />
        <p className={styles.emptyText}>
          {showHistory ? 'No past SK officials found.' : 'No active SK officials registered yet.'}
        </p>
      </div>
    )
    return (
      <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>SK Official</th>
              <th>Position</th>
              <th>Committee</th>
              <th>Term</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {skOfficials.map(o => (
              <tr key={o.id} className={styles.tableRow}>
                <td className={styles.tableCell}>
                  <div className={styles.officialCell}>
                    <OfficialAvatar name={o.full_name} />
                    <span className={styles.officialName}>{o.full_name}</span>
                  </div>
                </td>
                <td className={styles.tableCell}>
                  <PositionBadge position={o.position} />
                </td>
                <td className={styles.tableCell} style={{ fontSize: 13, color: '#64748b' }}>
                  {o.committee ?? '—'}
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.termDates}>
                    {new Date(o.term_start).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} –{' '}
                    {new Date(o.term_end).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
                  </div>
                  {o.is_active && <ExpiryBadge termEnd={o.term_end} />}
                </td>
                <td className={styles.tableCell} style={{ fontSize: 13, color: '#64748b' }}>
                  {o.contact_number ?? '—'}
                </td>
                <td className={styles.tableCell}>
                  <div className={styles.actionGroup}>
                    <Link href={`/dashboard/officials/${o.id}?type=sk`} className={styles.viewButton}>
                      View
                    </Link>
                    {canManage && (
                      <Link href={`/dashboard/officials/${o.id}/edit?type=sk`} className={styles.editButton}>
                        Edit
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles.cardList}>
        {skOfficials.map(o => (
          <div key={o.id} className={styles.officialCard}>
            <div className={styles.cardAvatar}>{getInitials(o.full_name)}</div>
            <div className={styles.cardBody}>
              <p className={styles.cardName}>{o.full_name}</p>
              <div className={styles.cardMeta}>
                <span>{o.committee ?? 'No Committee'}</span>
                <span className={styles.cardMetaDot}>•</span>
                <span>{o.contact_number ?? 'No contact'}</span>
              </div>
              <div className={styles.cardBadges}>
                <PositionBadge position={o.position} />
                {o.is_active && <ExpiryBadge termEnd={o.term_end} />}
              </div>
              <div className={styles.cardMeta}>
                {new Date(o.term_start).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })} –{' '}
                {new Date(o.term_end).toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}
              </div>
              <div className={styles.cardActionGroup}>
                <Link href={`/dashboard/officials/${o.id}?type=sk`} className={styles.cardViewButton}>View</Link>
                {canManage && (
                  <Link href={`/dashboard/officials/${o.id}/edit?type=sk`} className={styles.cardEditButton}>Edit</Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
    )
  }

  function TanodTab() {
    if (tanod.length === 0) return (
      <div className={styles.emptyState}>
        <Shield size={44} className={styles.emptyIcon} />
        <p className={styles.emptyText}>No Tanod members registered yet.</p>
      </div>
    )
    return (
      <>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Tanod Member</th>
              <th>ID Number</th>
              <th>Status</th>
              <th>Date Appointed</th>
              <th>Contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tanod.map(t => {
              const sc = TANOD_STATUS_COLORS[t.status] ?? TANOD_STATUS_COLORS.Inactive
              return (
                <tr key={t.id} className={styles.tableRow}>
                  <td className={styles.tableCell}>
                    <div className={styles.officialCell}>
                      <OfficialAvatar name={t.full_name} />
                      <span className={styles.officialName}>{t.full_name}</span>
                    </div>
                  </td>
                  <td className={styles.tableCell}>
                    <span className={styles.tanodId}>{t.tanod_id_number}</span>
                  </td>
                  <td className={styles.tableCell}>
                    <span
                      className={styles.statusBadge}
                      style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className={styles.tableCell} style={{ fontSize: 13, color: '#64748b' }}>
                    {t.date_appointed
                      ? new Date(t.date_appointed).toLocaleDateString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })
                      : '—'}
                  </td>
                  <td className={styles.tableCell} style={{ fontSize: 13, color: '#64748b' }}>
                    {t.contact_number ?? '—'}
                  </td>
                  <td className={styles.tableCell}>
                    <div className={styles.actionGroup}>
                      <Link href={`/dashboard/officials/${t.id}?type=tanod`} className={styles.viewButton}>
                        View
                      </Link>
                      {canManage && (
                        <Link href={`/dashboard/officials/${t.id}/edit?type=tanod`} className={styles.editButton}>
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.cardList}>
        {tanod.map(t => {
          const sc = TANOD_STATUS_COLORS[t.status] ?? TANOD_STATUS_COLORS.Inactive
          return (
            <div key={t.id} className={styles.officialCard}>
              <div className={styles.cardAvatar}>{getInitials(t.full_name)}</div>
              <div className={styles.cardBody}>
                <p className={styles.cardName}>{t.full_name}</p>
                <div className={styles.cardMeta}>
                  <span className={styles.tanodId}>{t.tanod_id_number}</span>
                  <span className={styles.cardMetaDot}>•</span>
                  <span>{t.contact_number ?? 'No contact'}</span>
                </div>
                <div className={styles.cardBadges}>
                  <span className={styles.statusBadge}
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                    {t.status}
                  </span>
                  {t.date_appointed && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Appointed: {new Date(t.date_appointed).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                <div className={styles.cardActionGroup}>
                  <Link href={`/dashboard/officials/${t.id}?type=tanod`} className={styles.cardViewButton}>View</Link>
                  {canManage && (
                    <Link href={`/dashboard/officials/${t.id}/edit?type=tanod`} className={styles.cardEditButton}>Edit</Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      </>
    )
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <UserCheck size={22} color="white" />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Officials Directory</h1>
            <p className={styles.headerSubtitle}>Barangay IV, Tangub City</p>
          </div>
        </div>
        {canManage && (
          <Link href={addLinks[activeTab]} className={styles.addButton}>
            <Plus size={16} />
            {addLabels[activeTab]}
          </Link>
        )}
      </div>

      {/* Tab Card */}
      <div className={styles.tabCard}>

        {/* Tab Bar */}
        <div className={styles.tabBar}>
          <div className={styles.tabList}>
            <TabButton
              label="Barangay Officials"
              icon={UserCheck}
              active={activeTab === 'officials'}
              count={officials.length}
              onClick={() => setActiveTab('officials')}
            />
            <TabButton
              label="SK Officials"
              icon={Users}
              active={activeTab === 'sk'}
              count={skOfficials.length}
              onClick={() => setActiveTab('sk')}
            />
            <TabButton
              label="Barangay Tanod"
              icon={Shield}
              active={activeTab === 'tanod'}
              count={tanod.length}
              onClick={() => setActiveTab('tanod')}
            />
          </div>

          {activeTab !== 'tanod' && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`${styles.historyButton} ${showHistory ? styles.historyButtonActive : ''}`}
            >
              <Clock size={13} />
              {showHistory ? 'Showing History' : 'Show History'}
            </button>
          )}
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className={styles.loadingState}>Loading...</div>
        ) : (
          <>
            {activeTab === 'officials' && <OfficialsTab />}
            {activeTab === 'sk' && <SKTab />}
            {activeTab === 'tanod' && <TanodTab />}
          </>
        )}
      </div>
    </div>
  )
}