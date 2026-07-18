'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit } from 'lucide-react'
import type { Resident } from '@/lib/types'
import styles from './styles/profile.module.css'

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

export default function ResidentProfilePage() {
  const { id } = useParams()
  const supabase = createClient()
  const [resident, setResident] = useState<Resident | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('residents')
      .select('*, purok:puroks(id, name), household:households(id, household_number, street)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setResident(data)
        setLoading(false)
      })
  }, [id])

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Loading resident profile...
    </div>
  )

  if (!resident) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Resident not found.{' '}
      <Link href="/dashboard/residents" style={{ color: '#e8820c' }}>Back to list</Link>
    </div>
  )

  const age = getAge(resident.date_of_birth)
  const fullName = `${resident.last_name}, ${resident.first_name} ${resident.middle_name ?? ''} ${resident.suffix ?? ''}`.trim()
  const initials = getInitials(resident.first_name, resident.last_name)

  const tags = [
    resident.is_voter && 'Registered Voter',
    resident.is_pwd && 'PWD',
    resident.is_senior_citizen && 'Senior Citizen',
    resident.is_solo_parent && 'Solo Parent',
    resident.is_4ps_beneficiary && '4Ps Beneficiary',
    resident.is_indigent && 'Indigent',
    resident.is_ofw && 'OFW',
  ].filter(Boolean) as string[]

  const isActive = !resident.is_deceased && !resident.is_transferred

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <Link href="/dashboard/residents" className={styles.backButton}>
          <ArrowLeft size={16} />
        </Link>
        <h1 className={styles.pageTitle}>Resident Profile</h1>
        <div className={styles.headerActions}>
          <Link href={`/dashboard/residents/${id}/edit`} className={styles.editButton}>
            <Edit size={14} /> Edit
          </Link>
        </div>
      </div>

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.profileAvatar}>{initials}</div>
        <div style={{ flex: 1 }}>
          <h2 className={styles.profileName}>{fullName}</h2>
          <p className={styles.profileMeta}>
            {age} years old · {resident.sex} · {resident.civil_status}
          </p>
          <div className={styles.tagGroup}>
            {tags.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
            {tags.length === 0 && (
              <span className={styles.tagEmpty}>No special classifications</span>
            )}
          </div>
        </div>
        <span className={`${styles.statusBadge} ${isActive ? styles.statusActive : styles.statusInactive}`}>
          {resident.is_deceased ? 'Deceased' : resident.is_transferred ? 'Transferred' : 'Active'}
        </span>
      </div>

      {/* Personal Information */}
      <Section title="Personal Information">
        <InfoRow label="Full Name" value={fullName} />
        <InfoRow label="Date of Birth" value={new Date(resident.date_of_birth).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })} />
        <InfoRow label="Place of Birth" value={resident.place_of_birth} />
        <InfoRow label="Age" value={`${age} years old`} />
        <InfoRow label="Sex" value={resident.sex} />
        <InfoRow label="Civil Status" value={resident.civil_status} />
        <InfoRow label="Nationality" value={resident.nationality} />
        <InfoRow label="Religion" value={resident.religion} />
      </Section>

      {/* Contact & Address */}
      <Section title="Contact & Address">
        <InfoRow label="Contact Number" value={resident.contact_number} />
        <InfoRow label="Email Address" value={resident.email_address} />
        <InfoRow label="Purok" value={(resident.purok as any)?.name} />
        <InfoRow label="Household" value={(resident.household as any)?.household_number} />
        <InfoRow label="Household Role" value={resident.household_role} />
        <InfoRow label="House Number" value={resident.house_number} />
        <InfoRow label="Street" value={resident.street} />
      </Section>

      {/* Socio-Economic */}
      <Section title="Socio-Economic">
        <InfoRow label="Educational Attainment" value={resident.educational_attainment} />
        <InfoRow label="Employment Status" value={resident.employment_status} />
        <InfoRow label="Occupation" value={resident.occupation} />
        <InfoRow label="Monthly Income" value={resident.monthly_income ? `₱${Number(resident.monthly_income).toLocaleString()}` : null} />
      </Section>

      {/* Government IDs */}
      <Section title="Government IDs">
        <InfoRow label="Voter ID Number" value={resident.voter_id_number} />
        <InfoRow label="PhilSys Number" value={resident.philsys_number} />
        <InfoRow label="SSS Number" value={resident.sss_number} />
        <InfoRow label="PhilHealth Number" value={resident.philhealth_number} />
        <InfoRow label="Pag-IBIG Number" value={resident.pagibig_number} />
        <InfoRow label="TIN Number" value={resident.tin_number} />
      </Section>

      {/* Special Classifications */}
      {(resident.is_pwd || resident.is_senior_citizen || resident.is_solo_parent) && (
        <Section title="Special Classifications Detail">
          {resident.is_pwd && (
            <>
              <InfoRow label="PWD ID Number" value={resident.pwd_id_number} />
              <InfoRow label="Type of Disability" value={resident.pwd_disability_type} />
            </>
          )}
          {resident.is_senior_citizen && (
            <InfoRow label="Senior Citizen ID" value={resident.senior_citizen_id} />
          )}
          {resident.is_solo_parent && (
            <InfoRow label="Solo Parent ID" value={resident.solo_parent_id} />
          )}
        </Section>
      )}

      {/* Remarks */}
      {resident.remarks && (
        <Section title="Remarks">
          <p style={{ fontSize: 14, color: '#374151', margin: '8px 0' }}>
            {resident.remarks}
          </p>
        </Section>
      )}

      <p className={styles.footer}>
        Record created {new Date(resident.created_at).toLocaleDateString('en-PH', {
          year: 'numeric', month: 'long', day: 'numeric'
        })}
      </p>
    </div>
  )
}