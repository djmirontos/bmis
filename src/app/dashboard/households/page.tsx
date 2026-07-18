'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Home, Plus, Search, Users } from 'lucide-react'
import type { Household, Purok, HouseholdStatus } from '@/lib/types'
import styles from './styles/households.module.css'

const STATUS_COLORS: Record<string, { bg: string, color: string, border: string }> = {
  Active:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Vacant:      { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
  Demolished:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Transferred: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  Condemned:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
}

function getRolePermissions(role: string) {
  return {
    canCreate: ['super_admin', 'captain', 'secretary', 'encoder'].includes(role),
    canEdit: ['super_admin', 'captain', 'secretary'].includes(role),
    canView: true,
  }
}

export default function HouseholdsPage() {
  const [households, setHouseholds] = useState<(Household & { resident_count: number })[]>([])
  const [puroks, setPuroks] = useState<Purok[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPurok, setFilterPurok] = useState('')
  const [filter4ps, setFilter4ps] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [total, setTotal] = useState(0)
  const [userRole, setUserRole] = useState('')
  const supabase = createClient()

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_profiles').select('role').eq('id', user.id).single()
      if (data) setUserRole(data.role)
    }
    getRole()
    supabase.from('puroks').select('*').order('name')
      .then(({ data }) => setPuroks(data ?? []))
  }, [])

  const fetchHouseholds = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('households')
      .select('*, purok:puroks(id, name)', { count: 'exact' })
      .order('household_number', { ascending: true })

    if (search.trim()) {
      query = query.or(
        `household_number.ilike.%${search}%,street.ilike.%${search}%,house_number.ilike.%${search}%`
      )
    }
    if (filterPurok) query = query.eq('purok_id', filterPurok)
    if (filter4ps === 'yes') query = query.eq('is_4ps_beneficiary', true)
    if (filter4ps === 'no') query = query.eq('is_4ps_beneficiary', false)
    if (filterStatus) query = query.eq('status', filterStatus)

    const { data, count } = await query.limit(100)

    if (data) {
      const withCounts = await Promise.all(
        data.map(async h => {
          const { count: rc } = await supabase
            .from('residents').select('id', { count: 'exact' })
            .eq('household_id', h.id)
            .eq('is_deceased', false)
            .eq('is_transferred', false)
          return { ...h, resident_count: rc ?? 0 }
        })
      )
      setHouseholds(withCounts)
    }

    setTotal(count ?? 0)
    setLoading(false)
  }, [search, filterPurok, filter4ps, filterStatus])

  useEffect(() => {
    const timer = setTimeout(fetchHouseholds, 300)
    return () => clearTimeout(timer)
  }, [fetchHouseholds])

  const perms = getRolePermissions(userRole)
  const hasFilters = search || filterPurok || filter4ps || filterStatus

  function clearFilters() {
    setSearch('')
    setFilterPurok('')
    setFilter4ps('')
    setFilterStatus('')
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Home size={22} color="white" />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Household Management</h1>
            <p className={styles.headerSubtitle}>
              {total.toLocaleString()} registered household{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {perms.canCreate && (
          <Link href="/dashboard/households/new" className={styles.addButton}>
            <Plus size={16} /> Add Household
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Search size={15} color="#94a3b8" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by household number or street..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <select
            value={filterPurok}
            onChange={e => setFilterPurok(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Puroks</option>
            {puroks.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filter4ps}
            onChange={e => setFilter4ps(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">4Ps: All</option>
            <option value="yes">4Ps Beneficiary</option>
            <option value="no">Non-4Ps</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Vacant">Vacant</option>
            <option value="Demolished">Demolished</option>
            <option value="Transferred">Transferred</option>
            <option value="Condemned">Condemned</option>
          </select>
          {hasFilters && (
            <button onClick={clearFilters} className={styles.clearButton}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>Loading households...</div>
        ) : households.length === 0 ? (
          <div className={styles.emptyState}>
            <Home size={44} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {hasFilters ? 'No households match your search.' : 'No households registered yet.'}
            </p>
            {!hasFilters && perms.canCreate && (
              <Link href="/dashboard/households/new" className={styles.emptyAction}>
                Add first household
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Household No.</th>
                  <th>Purok</th>
                  <th>Address</th>
                  <th>Members</th>
                  <th>Dwelling</th>
                  <th>4Ps</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {households.map(h => {
                  const sc = STATUS_COLORS[h.status ?? 'Active']
                  return (
                    <tr key={h.id} className={styles.tableRow}>
                      <td className={styles.tableCell}>
                        <span className={styles.householdNumber}>
                          {h.household_number}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        {(h.purok as any)?.name ?? '—'}
                      </td>
                      <td className={styles.tableCell}>
                        {[h.house_number, h.street].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.memberCount}>
                          <Users size={14} color="#94a3b8" />
                          <span>{h.resident_count}</span>
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.dwellingText}>
                          {h.dwelling_type ?? '—'}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        {h.is_4ps_beneficiary
                          ? <span className={styles.badge4ps}>4Ps</span>
                          : <span className={styles.badgeEmpty}>—</span>
                        }
                      </td>
                      <td className={styles.tableCell}>
                        <span
                          className={styles.statusBadge}
                          style={{
                            background: sc.bg,
                            color: sc.color,
                            border: `1px solid ${sc.border}`
                          }}
                        >
                          {h.status ?? 'Active'}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.actionGroup}>
                          <Link
                            href={`/dashboard/households/${h.id}`}
                            className={styles.viewButton}
                          >
                            View
                          </Link>
                          {perms.canEdit && (
                            <Link
                              href={`/dashboard/households/${h.id}/edit`}
                              className={styles.editButton}
                            >
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

          {/* Mobile Card List */}
          <div className={styles.cardList}>
            {households.map(h => {
              const sc = STATUS_COLORS[h.status ?? 'Active']
              return (
                <div key={h.id} className={styles.householdCard}>
                  <div className={styles.cardIcon}>
                    <Home size={20} color="white" />
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.cardHHNumber}>{h.household_number}</p>
                    <div className={styles.cardMeta}>
                      <span>{(h.purok as any)?.name ?? 'No Purok'}</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span>{[h.house_number, h.street].filter(Boolean).join(' ') || 'No address'}</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span>{h.resident_count} member{h.resident_count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className={styles.cardBadges}>
                      <span
                        className={styles.statusBadge}
                        style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
                      >
                        {h.status ?? 'Active'}
                      </span>
                      {h.is_4ps_beneficiary && (
                        <span className={styles.badge4ps}>4Ps</span>
                      )}
                      {h.dwelling_type && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>{h.dwelling_type}</span>
                      )}
                    </div>
                    <div className={styles.cardActionGroup}>
                      <Link href={`/dashboard/households/${h.id}`} className={styles.cardViewButton}>
                        View
                      </Link>
                      {perms.canEdit && (
                        <Link href={`/dashboard/households/${h.id}/edit`} className={styles.cardEditButton}>
                          Edit
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </div>
    </div>
  )
}