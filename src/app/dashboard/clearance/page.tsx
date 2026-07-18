'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { FileText, Plus, Search } from 'lucide-react'
import type { IssuedDocument, DocumentType, DocumentStatus } from '@/lib/types'
import styles from './styles/clearance.module.css'

const DOC_TYPES: DocumentType[] = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Certificate of Good Moral Character',
  'Certificate of No Income',
  'First-Time Jobseeker Certificate',
  'Business Clearance',
]

function getExpiryStatus(expiryDate: string) {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const daysLeft = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysLeft < 0) return { label: 'Expired', class: 'expiryExpired' }
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, class: 'expirySoon' }
  return {
    label: new Date(expiryDate).toLocaleDateString('en-PH', {
      month: 'short', day: 'numeric', year: 'numeric'
    }),
    class: 'expiryValid'
  }
}

export default function ClearancePage() {
  const supabase = createClient()
  const [documents, setDocuments] = useState<IssuedDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [total, setTotal] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [userRole, setUserRole] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('user_profiles').select('role').eq('id', user.id).single()
        if (data) setUserRole(data.role)
      }

      const today = new Date().toISOString().split('T')[0]
      const { count } = await supabase
        .from('issued_documents')
        .select('id', { count: 'exact' })
        .eq('issued_date', today)
      setTodayCount(count ?? 0)
    }
    init()
  }, [])

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('issued_documents')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search.trim()) {
      query = query.or(
        `resident_name.ilike.%${search}%,control_number.ilike.%${search}%`
      )
    }
    if (filterType) query = query.eq('document_type', filterType)
    if (filterStatus) query = query.eq('status', filterStatus)

    const { data, count } = await query.limit(100)
    setDocuments(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, filterType, filterStatus])

  useEffect(() => {
    const timer = setTimeout(fetchDocuments, 300)
    return () => clearTimeout(timer)
  }, [fetchDocuments])

  const canIssue = ['super_admin', 'captain', 'secretary', 'encoder'].includes(userRole)
  const canPrint = ['super_admin', 'captain', 'secretary'].includes(userRole)
  const hasFilters = search || filterType || filterStatus

  function clearFilters() {
    setSearch('')
    setFilterType('')
    setFilterStatus('')
  }

  function getStatusClass(status: DocumentStatus) {
    if (status === 'Issued') return styles.statusIssued
    if (status === 'Voided') return styles.statusVoided
    return styles.statusReprinted
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <FileText size={22} color="white" />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Clearance & Certificates</h1>
            <p className={styles.headerSubtitle}>
              {total.toLocaleString()} document{total !== 1 ? 's' : ''} issued
            </p>
          </div>
        </div>
        {canIssue && (
          <Link href="/dashboard/clearance/issue" className={styles.issueButton}>
            <Plus size={16} /> Issue Document
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>{total.toLocaleString()}</p>
          <p className={styles.statLabel}>Total Issued</p>
        </div>
        <div className={styles.statCard}>
          <p className={`${styles.statValue} ${styles.statAccent}`}>
            {todayCount}
          </p>
          <p className={styles.statLabel}>Issued Today</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Search size={15} color="#94a3b8" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by name or control number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Document Types</option>
            {DOC_TYPES.map(dt => (
              <option key={dt} value={dt}>{dt}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Status</option>
            <option value="Issued">Issued</option>
            <option value="Reprinted">Reprinted</option>
            <option value="Voided">Voided</option>
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
          <div className={styles.loadingState}>Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={44} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {hasFilters
                ? 'No documents match your search.'
                : 'No documents issued yet.'}
            </p>
            {!hasFilters && canIssue && (
              <Link href="/dashboard/clearance/issue" className={styles.issueButton}>
                Issue first document
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Control No.</th>
                  <th>Resident</th>
                  <th>Document Type</th>
                  <th>Issued Date</th>
                  <th>Expiry</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => {
                  const expiry = getExpiryStatus(doc.expiry_date)
                  return (
                    <tr key={doc.id} className={styles.tableRow}>
                      <td className={styles.tableCell}>
                        <span className={styles.controlNumber}>
                          {doc.control_number}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        <p className={styles.residentName}>{doc.resident_name}</p>
                        <p className={styles.residentAddress}>
                          {doc.resident_address}
                        </p>
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles.docTypeBadge}>
                          {doc.document_type}
                        </span>
                      </td>
                      <td className={styles.tableCell} style={{ fontSize: 13 }}>
                        {new Date(doc.issued_date).toLocaleDateString('en-PH', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </td>
                      <td className={styles.tableCell}>
                        <span className={styles[expiry.class as keyof typeof styles]}>
                          {expiry.label}
                        </span>
                      </td>
                      <td className={styles.tableCell} style={{ fontSize: 13 }}>
                        {doc.fee_paid > 0
                          ? `₱${Number(doc.fee_paid).toLocaleString()}`
                          : <span style={{ color: '#94a3b8' }}>Free</span>
                        }
                      </td>
                      <td className={styles.tableCell}>
                        <span className={getStatusClass(doc.status)}>
                          {doc.status}
                        </span>
                      </td>
                      <td className={styles.tableCell}>
                        <div className={styles.actionGroup}>
                          <Link
                            href={`/print/${doc.id}`}
                            className={styles.viewButton}
                          >
                            View
                          </Link>
                          {canPrint && doc.status !== 'Voided' && (
                            <Link
                              href={`/print/${doc.id}`}
                              className={styles.printButton}
                              target="_blank"
                            >
                              Print
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
            {documents.map(doc => {
              const expiry = getExpiryStatus(doc.expiry_date)
              return (
                <div key={doc.id} className={styles.docCard}>
                  <div className={styles.docCardIcon}>
                    <FileText size={20} color="white" />
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.cardControlNumber}>{doc.control_number}</p>
                    <p className={styles.cardResidentName}>{doc.resident_name}</p>
                    <p className={styles.cardResidentAddress}>{doc.resident_address}</p>
                    <div className={styles.cardMeta}>
                      <span>{new Date(doc.issued_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span className={styles[expiry.class as keyof typeof styles]}>{expiry.label}</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span>{doc.fee_paid > 0 ? `₱${Number(doc.fee_paid).toLocaleString()}` : 'Free'}</span>
                    </div>
                    <div className={styles.cardBadges}>
                      <span className={styles.docTypeBadge}>{doc.document_type}</span>
                      <span className={getStatusClass(doc.status)}>{doc.status}</span>
                    </div>
                    <div className={styles.cardActionGroup}>
                      <Link href={`/print/${doc.id}`} className={styles.cardViewButton}>
                        View
                      </Link>
                      {canPrint && doc.status !== 'Voided' && (
                        <Link href={`/print/${doc.id}`} className={styles.cardPrintButton} target="_blank">
                          Print
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