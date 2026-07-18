'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Clock, AlertTriangle, Trash2 } from 'lucide-react'
import styles from './styles/profile.module.css'

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

const TANOD_STATUS_COLORS: Record<string, { bg: string, color: string, border: string }> = {
  Active:    { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Inactive:  { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  Suspended: { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  Resigned:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
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

function InfoRow({ label, value }: { label: string, value?: string | null }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={value ? styles.infoValue : styles.infoEmpty}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  )
}

function OfficialProfilePageInner() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = searchParams.get('type') ?? 'official'
  const supabase = createClient()

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const isTanod = type === 'tanod'
  const isSK = type === 'sk'
  const tableName = isTanod
    ? 'barangay_tanod'
    : isSK ? 'sk_officials' : 'barangay_officials'

  useEffect(() => {
    async function load() {
      const [{ data: record }, { data: profile }] = await Promise.all([
        supabase.from(tableName).select('*').eq('id', id).single(),
        supabase.auth.getUser().then(async ({ data: { user } }) => {
          if (!user) return { data: null }
          return supabase.from('user_profiles').select('role').eq('id', user.id).single()
        })
      ])
      setData(record)
      if (profile) setUserRole((profile as any).role ?? '')
      setLoading(false)
    }
    load()
  }, [id, type])

  const canManage = ['super_admin', 'captain', 'secretary'].includes(userRole)

  async function handleDelete() {
    setDeleteError('')
    const confirmed = window.confirm(
      'Are you sure you want to delete this record? This cannot be undone.'
    )
    if (!confirmed) return

    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from(tableName).delete().eq('id', id)

    if (error) {
      setDeleteError('Error deleting: ' + error.message)
      setDeleting(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'DELETE',
      table_name: tableName,
      record_id: id as string,
      notes: `Record deleted: ${data?.full_name}`,
    })

    router.push('/dashboard/officials')
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Loading...
    </div>
  )

  if (!data) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Record not found.{' '}
      <Link href="/dashboard/officials" style={{ color: '#e8820c' }}>Back</Link>
    </div>
  )

  const initials = getInitials(data.full_name)
  const posColors = POSITION_COLORS[data.position] ?? {
    bg: '#f8fafc', color: '#64748b', border: '#e2e8f0'
  }
  const tanodColors = TANOD_STATUS_COLORS[data.status] ?? TANOD_STATUS_COLORS.Inactive
  const daysLeft = !isTanod && data.is_active
    ? getDaysUntilExpiry(data.term_end) : null

  const pageTitle = isTanod
    ? 'Tanod Profile'
    : isSK ? 'SK Official Profile' : 'Official Profile'

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <Link href="/dashboard/officials" className={styles.backButton}>
          <ArrowLeft size={16} />
        </Link>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
        {canManage && (
          <div className={styles.headerActions}>
            <Link
              href={`/dashboard/officials/${id}/edit?type=${type}`}
              className={styles.editButton}
            >
              <Edit size={14} /> Edit
            </Link>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={styles.deleteButton}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className={styles.errorBanner}>
          <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
          <p className={styles.bannerText} style={{ color: '#991b1b' }}>
            {deleteError}
          </p>
        </div>
      )}

      {/* Expiry warning */}
      {daysLeft !== null && daysLeft <= 90 && (
        <div className={`${styles.warningBanner} ${daysLeft < 0 ? styles.expiryExpired : styles.expiryWarning}`}>
          <Clock size={16} color={daysLeft < 0 ? '#dc2626' : '#d97706'} style={{ flexShrink: 0 }} />
          <p className={styles.bannerText}
            style={{ color: daysLeft < 0 ? '#991b1b' : '#92400e' }}
          >
            {daysLeft < 0
              ? `This official's term expired ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago. Please update the record.`
              : `This official's term ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Consider planning for succession.`
            }
          </p>
        </div>
      )}

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.profileAvatar}>{initials}</div>
        <div style={{ flex: 1 }}>
          <h2 className={styles.profileName}>{data.full_name}</h2>
          <div className={styles.badgeGroup}>
            {!isTanod && (
              <span
                className={styles.positionBadge}
                style={{
                  background: posColors.bg,
                  color: posColors.color,
                  border: `1px solid ${posColors.border}`
                }}
              >
                {data.position}
              </span>
            )}
            {isTanod && (
              <span
                className={styles.tanodBadge}
                style={{
                  background: tanodColors.bg,
                  color: tanodColors.color,
                  border: `1px solid ${tanodColors.border}`
                }}
              >
                {data.status}
              </span>
            )}
            {!isTanod && (
              <span className={data.is_active ? styles.activeBadge : styles.inactiveBadge}>
                {data.is_active ? 'Active' : 'Past Official'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Details */}
      <Section title="Details">
        <InfoRow label="Full Name" value={data.full_name} />
        {!isTanod && <InfoRow label="Position" value={data.position} />}
        {!isTanod && <InfoRow label="Committee" value={data.committee} />}
        {!isTanod && (
          <InfoRow
            label="Term of Office"
            value={
              `${new Date(data.term_start).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} – ` +
              `${new Date(data.term_end).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`
            }
          />
        )}
        {isTanod && <InfoRow label="Tanod ID" value={data.tanod_id_number} />}
        {isTanod && <InfoRow label="Status" value={data.status} />}
        {isTanod && data.date_appointed && (
          <InfoRow
            label="Date Appointed"
            value={new Date(data.date_appointed).toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          />
        )}
        {isTanod && data.date_ended && (
          <InfoRow
            label="Date Ended"
            value={new Date(data.date_ended).toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric', year: 'numeric'
            })}
          />
        )}
        <InfoRow label="Contact Number" value={data.contact_number} />
        {!isTanod && <InfoRow label="Email Address" value={data.email_address} />}
        {data.remarks && <InfoRow label="Remarks" value={data.remarks} />}
        <InfoRow
          label="Record Created"
          value={new Date(data.created_at).toLocaleDateString('en-PH', {
            month: 'long', day: 'numeric', year: 'numeric'
          })}
        />
      </Section>

      {/* Signature */}
      {!isTanod && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Signature</h2>
          </div>
          <div className={styles.signatureBody}>
            {data.signature_path ? (
              <p className={styles.signaturePresent}>
                ✓ Signature on file — will be used on printed documents
              </p>
            ) : (
              <p className={styles.signatureAbsent}>
                No signature uploaded yet.{' '}
                {canManage && (
                  <Link
                    href={`/dashboard/officials/${id}/edit?type=${type}`}
                    className={styles.signatureLink}
                  >
                    Upload via Edit
                  </Link>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
import { Suspense } from 'react'
export default function OfficialProfilePage() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <OfficialProfilePageInner />
    </Suspense>
  )
}
