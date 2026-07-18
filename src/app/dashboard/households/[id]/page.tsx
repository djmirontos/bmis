'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Users, Home, Trash2, AlertTriangle } from 'lucide-react'
import type { Resident } from '@/lib/types'
import styles from './styles/profile.module.css'

const STATUS_COLORS: Record<string, { bg: string, color: string, border: string }> = {
  Active:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Vacant:      { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
  Demolished:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Transferred: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  Condemned:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
}

const STATUS_WARNINGS: Record<string, string> = {
  Vacant:      'This household is currently vacant. No residents should be actively linked here.',
  Demolished:  'This household has been demolished. All linked residents must be transferred.',
  Transferred: 'This household has transferred out of the barangay.',
  Condemned:   'This household has been condemned as unsafe. Residents must be relocated immediately.',
}

function getInitials(first: string, last: string) {
  return (first[0] + last[0]).toUpperCase()
}

function getAge(dob: string) {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
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

const ROLE_ORDER = ['Head', 'Spouse', 'Child', 'Dependent', 'Boarder', 'Other']

export default function HouseholdProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [household, setHousehold] = useState<any>(null)
  const [members, setMembers] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    async function load() {
      const [{ data: hh }, { data: res }, { data: profile }] = await Promise.all([
        supabase.from('households')
          .select('*, purok:puroks(id, name)')
          .eq('id', id).single(),
        supabase.from('residents').select('*')
          .eq('household_id', id)
          .eq('is_deceased', false)
          .eq('is_transferred', false),
        supabase.auth.getUser().then(async ({ data: { user } }) => {
          if (!user) return { data: null }
          return supabase.from('user_profiles')
            .select('role').eq('id', user.id).single()
        })
      ])

      setHousehold(hh)
      const sorted = (res ?? []).sort((a, b) =>
        ROLE_ORDER.indexOf(a.household_role ?? 'Other') -
        ROLE_ORDER.indexOf(b.household_role ?? 'Other')
      )
      setMembers(sorted)
      if (profile) setUserRole((profile as any).role ?? '')
      setLoading(false)
    }
    load()
  }, [id])

  const canEdit = ['super_admin', 'captain', 'secretary'].includes(userRole)
  const canDelete = ['super_admin', 'captain'].includes(userRole)

  async function handleDelete() {
    setDeleteError('')
    if (members.length > 0) {
      setDeleteError(
        `Cannot delete — this household has ${members.length} active ` +
        `resident${members.length !== 1 ? 's' : ''} linked to it. ` +
        `Please transfer or update all residents first.`
      )
      return
    }
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete household ${household.household_number}? This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('households').delete().eq('id', id)

    if (error) {
      setDeleteError('Error deleting: ' + error.message)
      setDeleting(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'DELETE',
      table_name: 'households',
      record_id: id as string,
      notes: `Household deleted: ${household.household_number}`,
    })

    router.push('/dashboard/households')
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Loading household...
    </div>
  )

  if (!household) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Household not found.{' '}
      <Link href="/dashboard/households" style={{ color: '#e8820c' }}>Back</Link>
    </div>
  )

  const status = household.status ?? 'Active'
  const sc = STATUS_COLORS[status]
  const statusWarning = STATUS_WARNINGS[status]

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <Link href="/dashboard/households" className={styles.backButton}>
          <ArrowLeft size={16} />
        </Link>
        <h1 className={styles.pageTitle}>Household Profile</h1>
        <div className={styles.headerActions}>
          {canEdit && (
            <Link
              href={`/dashboard/households/${id}/edit`}
              className={styles.editButton}
            >
              <Edit size={14} /> Edit
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`${styles.deleteButton} ${deleting ? styles.deleteButtonDisabled : ''}`}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div
          className={styles.errorBanner}
          style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <AlertTriangle size={16} color="#dc2626" style={{ flexShrink: 0 }} />
          <p className={styles.bannerText} style={{ color: '#991b1b' }}>
            {deleteError}
          </p>
        </div>
      )}

      {/* Status warning */}
      {statusWarning && (
        <div
          className={styles.warningBanner}
          style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
        >
          <AlertTriangle size={16} color={sc.color} style={{ flexShrink: 0, marginTop: 1 }} />
          <p className={styles.bannerText} style={{ color: sc.color }}>
            {statusWarning}
          </p>
        </div>
      )}

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.profileIcon}>
          <Home size={26} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 className={styles.householdNumber}>{household.household_number}</h2>
          <p className={styles.householdAddress}>
            {[household.house_number, household.street, household.purok?.name]
              .filter(Boolean).join(' · ')}
          </p>
          <div className={styles.profileMeta}>
            <span
              className={styles.statusBadge}
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
            >
              {status}
            </span>
            {household.is_4ps_beneficiary && (
              <span className={styles.badge4ps}>4Ps</span>
            )}
            <div className={styles.memberMeta}>
              <Users size={13} color="#94a3b8" />
              <span>{members.length} member{members.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Household Details</h2>
        </div>
        <div className={styles.sectionBody}>
          <InfoRow label="Household Number" value={household.household_number} />
          <InfoRow label="Purok" value={household.purok?.name} />
          <InfoRow label="House Number" value={household.house_number} />
          <InfoRow label="Street" value={household.street} />
          <InfoRow label="Dwelling Type" value={household.dwelling_type} />
          <InfoRow label="Water Source" value={household.water_source} />
          <InfoRow label="Toilet Facility" value={household.toilet_facility} />
          <InfoRow label="4Ps Beneficiary" value={household.is_4ps_beneficiary ? 'Yes' : 'No'} />
          <InfoRow label="Status" value={status} />
          {household.transferred_to && (
            <InfoRow label="Transferred To" value={household.transferred_to} />
          )}
          {household.status_remarks && (
            <InfoRow label="Status Remarks" value={household.status_remarks} />
          )}
          {household.status_changed_at && (
            <InfoRow
              label="Status Last Changed"
              value={new Date(household.status_changed_at).toLocaleDateString('en-PH', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            />
          )}
          {household.remarks && (
            <InfoRow label="General Remarks" value={household.remarks} />
          )}
        </div>
      </div>

      {/* Members */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Household Members ({members.length})
          </h2>
          {status === 'Active' ? (
            <Link
              href={`/dashboard/residents/new?household_id=${id}`}
              className={styles.sectionAction}
            >
              + Add Member
            </Link>
          ) : (
            <span className={styles.sectionActionDisabled}>
              Cannot add to {status.toLowerCase()} household
            </span>
          )}
        </div>

        {members.length === 0 ? (
          <div className={styles.emptyMembers}>
            No active members linked to this household.
          </div>
        ) : (
          <div className={styles.memberList}>
            {members.map(m => {
              const age = getAge(m.date_of_birth)
              const initials = getInitials(m.first_name, m.last_name)
              return (
                <Link
                  key={m.id}
                  href={`/dashboard/residents/${m.id}`}
                  className={styles.memberRow}
                >
                  <div className={styles.memberAvatar}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <p className={styles.memberName}>
                      {m.last_name}, {m.first_name}{' '}
                      {m.middle_name ? m.middle_name[0] + '.' : ''}
                    </p>
                    <p className={styles.memberMeta2}>
                      {m.household_role ?? 'Member'} · {age} yrs · {m.sex}
                    </p>
                  </div>
                  <div className={styles.memberTags}>
                    {m.is_pwd && <span className={styles.memberTag}>PWD</span>}
                    {m.is_senior_citizen && <span className={styles.memberTag}>Senior</span>}
                    {m.is_4ps_beneficiary && <span className={styles.memberTag}>4Ps</span>}
                  </div>
                  <span className={styles.memberChevron}>›</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <p className={styles.footer}>
        Record created{' '}
        {new Date(household.created_at).toLocaleDateString('en-PH', {
          year: 'numeric', month: 'long', day: 'numeric'
        })}
      </p>
    </div>
  )
}