'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { BookOpen, Plus, Search } from 'lucide-react'
import type { BlotterRecord, BlotterStatus } from '@/lib/types'
import styles from './styles/blotter.module.css'

const STATUS_CLASSES: Record<BlotterStatus, string> = {
  'Filed': 'statusFiled',
  'Summoned': 'statusSummoned',
  'Mediation Scheduled': 'statusMediation',
  'Settled': 'statusSettled',
  'Referred to Court': 'statusReferred',
  'Dismissed': 'statusDismissed',
}

export default function BlotterPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<BlotterRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({
    total: 0, filed: 0, mediation: 0, settled: 0
  })

  useEffect(() => {
    async function loadStats() {
      const { data } = await supabase
        .from('blotter_records')
        .select('status')
      if (data) {
        setStats({
          total: data.length,
          filed: data.filter(r =>
            r.status === 'Filed' || r.status === 'Summoned'
          ).length,
          mediation: data.filter(r =>
            r.status === 'Mediation Scheduled'
          ).length,
          settled: data.filter(r =>
            r.status === 'Settled' || r.status === 'Dismissed'
          ).length,
        })
      }
    }
    loadStats()
  }, [])

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('blotter_records')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search.trim()) {
      query = query.or(
        `blotter_number.ilike.%${search}%,` +
        `complainant_name.ilike.%${search}%,` +
        `respondents.ilike.%${search}%,` +
        `incident_type_name.ilike.%${search}%`
      )
    }
    if (filterStatus) query = query.eq('status', filterStatus)

    const { data, count } = await query.limit(100)
    setRecords(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, filterStatus])

  useEffect(() => {
    const timer = setTimeout(fetchRecords, 300)
    return () => clearTimeout(timer)
  }, [fetchRecords])

  const hasFilters = search || filterStatus

  function clearFilters() {
    setSearch('')
    setFilterStatus('')
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <BookOpen size={22} color="white" />
          </div>
          <div>
            <h1 className={styles.headerTitle}>
              Blotter & Incident Records
            </h1>
            <p className={styles.headerSubtitle}>
              {total.toLocaleString()} record{total !== 1 ? 's' : ''} on file
            </p>
          </div>
        </div>
        <Link href="/dashboard/blotter/new" className={styles.addButton}>
          <Plus size={16} /> File Blotter
        </Link>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{stats.total}</p>
          <p className={styles.statLabel}>Total Cases</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue} style={{ color: '#1d4ed8' }}>
            {stats.filed}
          </p>
          <p className={styles.statLabel}>Active / Summoned</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue} style={{ color: '#c2410c' }}>
            {stats.mediation}
          </p>
          <p className={styles.statLabel}>In Mediation</p>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue} style={{ color: '#16a34a' }}>
            {stats.settled}
          </p>
          <p className={styles.statLabel}>Resolved</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Search
              size={15}
              color="#94a3b8"
              className={styles.searchIcon}
            />
            <input
              type="text"
              placeholder="Search by blotter no., complainant, respondent..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="Filed">Filed</option>
            <option value="Summoned">Summoned</option>
            <option value="Mediation Scheduled">
              Mediation Scheduled
            </option>
            <option value="Settled">Settled</option>
            <option value="Referred to Court">Referred to Court</option>
            <option value="Dismissed">Dismissed</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className={styles.clearButton}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>
            Loading blotter records...
          </div>
        ) : records.length === 0 ? (
          <div className={styles.emptyState}>
            <BookOpen
              size={44}
              className={styles.emptyIcon}
            />
            <p className={styles.emptyText}>
              {hasFilters
                ? 'No records match your search.'
                : 'No blotter records filed yet.'}
            </p>
            {!hasFilters && (
              <Link
                href="/dashboard/blotter/new"
                className={styles.addButton}
              >
                File first blotter
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Blotter No.</th>
                  <th>Complainant</th>
                  <th>Respondent(s)</th>
                  <th>Incident Type</th>
                  <th>Date Filed</th>
                  <th>Incident Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>
                      <span className={styles.blotterNumber}>
                        {r.blotter_number}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <p className={styles.complainantName}>
                        {r.complainant_name}
                      </p>
                      <p className={styles.incidentType}>
                        {r.complainant_address ?? '—'}
                      </p>
                    </td>
                    <td className={styles.tableCell}>
                      <p style={{
                        fontSize: 13, color: '#374151',
                        margin: 0, maxWidth: 180,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {r.respondents}
                      </p>
                    </td>
                    <td className={styles.tableCell}>
                      <span style={{
                        fontSize: 12, color: '#64748b'
                      }}>
                        {r.incident_type_name}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <span style={{ fontSize: 13 }}>
                        {new Date(r.created_at)
                          .toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <span style={{ fontSize: 13 }}>
                        {new Date(r.incident_date)
                          .toLocaleDateString('en-PH', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <span className={
                        styles[STATUS_CLASSES[r.status] as keyof typeof styles]
                      }>
                        {r.status}
                      </span>
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.actionGroup}>
                        <Link
                          href={`/dashboard/blotter/${r.id}`}
                          className={styles.viewButton}
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className={styles.cardList}>
            {records.map(r => (
              <div key={r.id} className={styles.blotterCard}>
                <div className={styles.blotterCardIcon}>
                  <BookOpen size={20} color="white" />
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.cardBlotterNumber}>{r.blotter_number}</p>
                  <p className={styles.cardComplainantName}>{r.complainant_name}</p>
                  <p className={styles.cardRespondents}>vs. {r.respondents}</p>
                  <div className={styles.cardMeta}>
                    <span>{r.incident_type_name}</span>
                    <span className={styles.cardMetaDot}>•</span>
                    <span>{new Date(r.incident_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className={styles.cardBadges}>
                    <span className={styles[STATUS_CLASSES[r.status] as keyof typeof styles]}>
                      {r.status}
                    </span>
                  </div>
                  <Link href={`/dashboard/blotter/${r.id}`} className={styles.cardViewButton}>
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
          </>
        )}
      </div>
    </div>
  )
}