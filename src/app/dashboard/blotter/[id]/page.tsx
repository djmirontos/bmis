'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Printer, AlertCircle, Loader2,
  CheckCircle, Clock, FileText, BookOpen
} from 'lucide-react'
import type { BlotterRecord, BlotterStatus } from '@/lib/types'
import styles from '../styles/blotter.module.css'

const STATUS_FLOW: BlotterStatus[] = [
  'Filed',
  'Summoned',
  'Mediation Scheduled',
  'Settled',
  'Referred to Court',
  'Dismissed',
]

const STATUS_CLASSES: Record<BlotterStatus, string> = {
  'Filed': styles.statusFiled,
  'Summoned': styles.statusSummoned,
  'Mediation Scheduled': styles.statusMediation,
  'Settled': styles.statusSettled,
  'Referred to Court': styles.statusReferred,
  'Dismissed': styles.statusDismissed,
}

const STATUS_NEXT: Record<BlotterStatus, BlotterStatus[]> = {
  'Filed': ['Summoned', 'Dismissed'],
  'Summoned': ['Mediation Scheduled', 'Dismissed'],
  'Mediation Scheduled': ['Settled', 'Referred to Court', 'Dismissed'],
  'Settled': [],
  'Referred to Court': [],
  'Dismissed': [],
}

function InfoRow({ label, value }: {
  label: string
  value?: string | null
}) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={value ? styles.infoValue : styles.infoEmpty}>
        {value || '—'}
      </span>
    </div>
  )
}

function Section({ title, children }: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <div className={styles.sectionBody}>{children}</div>
    </div>
  )
}

export default function BlotterDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [record, setRecord] = useState<BlotterRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showStatusForm, setShowStatusForm] = useState(false)

  // Status update form
  const [newStatus, setNewStatus] = useState<BlotterStatus>('Filed')
  const [summonsDate, setSummonsDate] = useState('')
  const [mediationDate, setMediationDate] = useState('')
  const [mediationTime, setMediationTime] = useState('')
  const [mediationVenue, setMediationVenue] = useState('')
  const [mediatorName, setMediatorName] = useState('')
  const [resolutionDate, setResolutionDate] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')

  const TODAY = new Date().toISOString().split('T')[0]

  useEffect(() => {
    async function load() {
      const [{ data: rec }, { data: { user } }] = await Promise.all([
        supabase.from('blotter_records')
          .select('*').eq('id', id).single(),
        supabase.auth.getUser(),
      ])
      setRecord(rec)
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const canManage = ['super_admin', 'captain', 'secretary']
    .includes(userRole)
  const nextStatuses = record
    ? STATUS_NEXT[record.status]
    : []
  const isClosed = record?.status === 'Settled' ||
    record?.status === 'Referred to Court' ||
    record?.status === 'Dismissed'

  async function handleStatusUpdate() {
    if (!record) return
    setError('')
    setUpdating(true)

    const { data: { user } } = await supabase.auth.getUser()

    let controlNumber: string | null = null

    // Generate control number for summons
    if (newStatus === 'Summoned') {
      const { data } = await supabase
        .rpc('generate_blotter_doc_control_number', {
          p_type: 'summons'
        })
      controlNumber = data
    }

    // Generate CFA control number
    if (newStatus === 'Referred to Court') {
      const { data } = await supabase
        .rpc('generate_blotter_doc_control_number', {
          p_type: 'cfa'
        })
      controlNumber = data
    }

    // Generate settlement control number
    if (newStatus === 'Settled') {
      const { data } = await supabase
        .rpc('generate_blotter_doc_control_number', {
          p_type: 'settlement'
        })
      controlNumber = data
    }

    const updatePayload: any = {
      status: newStatus,
      updated_by: user?.id,
    }

    if (newStatus === 'Summoned') {
      updatePayload.summons_date = summonsDate || TODAY
      updatePayload.summons_issued_by = user?.id
      updatePayload.summons_control_number = controlNumber
    }

    if (newStatus === 'Mediation Scheduled') {
      updatePayload.mediation_date = mediationDate || null
      updatePayload.mediation_time = mediationTime || null
      updatePayload.mediation_venue = mediationVenue || null
      updatePayload.mediator_name = mediatorName || null
    }

    if (newStatus === 'Settled' ||
      newStatus === 'Referred to Court' ||
      newStatus === 'Dismissed') {
      updatePayload.resolution_date = resolutionDate || TODAY
      updatePayload.resolution_notes = resolutionNotes || null
    }

    if (newStatus === 'Referred to Court') {
      updatePayload.cfa_control_number = controlNumber
    }

    if (newStatus === 'Settled') {
      updatePayload.settlement_control_number = controlNumber
    }

    const { data: updated, error: updateError } = await supabase
      .from('blotter_records')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      setError('Error updating: ' + updateError.message)
      setUpdating(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'UPDATE',
      table_name: 'blotter_records',
      record_id: id as string,
      notes: `Blotter status updated to ${newStatus}: ${record.blotter_number}`,
    })

    setRecord(updated)
    setShowStatusForm(false)
    setSuccess(`Status updated to ${newStatus} successfully!`)
    setTimeout(() => setSuccess(''), 4000)
    setUpdating(false)
  }

  if (loading) return (
    <div style={{
      padding: 48, textAlign: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Loading blotter record...
    </div>
  )

  if (!record) return (
    <div style={{
      padding: 48, textAlign: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Record not found.{' '}
      <Link href="/dashboard/blotter"
        style={{ color: '#e8820c' }}>
        Back
      </Link>
    </div>
  )

  return (
    <div className={styles.formContainer}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <Link
          href="/dashboard/blotter"
          className={styles.backButton}
        >
          <ArrowLeft size={16} />
        </Link>
        <div style={{ flex: 1 }}>
          <h1 className={styles.pageTitle}>
            Blotter Record
          </h1>
          <p className={styles.pageSubtitle}>
            {record.blotter_number} · Filed{' '}
            {new Date(record.created_at)
              .toLocaleDateString('en-PH', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Print Buttons */}
          {record.summons_control_number && (
            <Link
              href={`/print/blotter/${record.id}?doc=summons`}
              target="_blank"
              style={{
                display: 'flex', alignItems: 'center',
                gap: 6, padding: '7px 13px',
                borderRadius: 8, fontSize: 13,
                border: '1px solid #e2e0d9',
                background: 'white', color: '#374151',
                textDecoration: 'none'
              }}
            >
              <Printer size={13} /> Summons
            </Link>
          )}
          {record.cfa_control_number && (
            <Link
              href={`/print/blotter/${record.id}?doc=cfa`}
              target="_blank"
              style={{
                display: 'flex', alignItems: 'center',
                gap: 6, padding: '7px 13px',
                borderRadius: 8, fontSize: 13,
                border: '1px solid #e2e0d9',
                background: 'white', color: '#374151',
                textDecoration: 'none'
              }}
            >
              <Printer size={13} /> CFA
            </Link>
          )}
          {record.settlement_control_number && (
            <Link
              href={`/print/blotter/${record.id}?doc=settlement`}
              target="_blank"
              style={{
                display: 'flex', alignItems: 'center',
                gap: 6, padding: '7px 13px',
                borderRadius: 8, fontSize: 13,
                border: '1px solid #e2e0d9',
                background: 'white', color: '#374151',
                textDecoration: 'none'
              }}
            >
              <Printer size={13} /> Settlement
            </Link>
          )}
        </div>
      </div>

      {/* Banners */}
      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '12px 16px', borderRadius: 10,
          marginBottom: 16, background: '#f0fdf4',
          border: '1px solid #bbf7d0', fontSize: 14,
          color: '#16a34a', display: 'flex',
          alignItems: 'center', gap: 8
        }}>
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.profileIcon}>
          <BookOpen size={24} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 className={styles.profileTitle}>
            {record.blotter_number}
          </h2>
          <div className={styles.badgeGroup}>
            <span className={STATUS_CLASSES[record.status]}>
              {record.status}
            </span>
            <span style={{
              padding: '3px 10px', borderRadius: 20,
              fontSize: 12, background: '#f8fafc',
              color: '#64748b', border: '1px solid #e2e8f0'
            }}>
              {record.incident_type_name}
            </span>
          </div>
        </div>
      </div>

      {/* Status Update */}
      {canManage && !isClosed && nextStatuses.length > 0 && (
        <div style={{
          background: 'white', borderRadius: 12,
          border: '1px solid #e8e6df', marginBottom: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
        }}>
          <div style={{
            padding: '13px 20px',
            borderBottom: showStatusForm
              ? '1px solid #f1f0eb' : 'none',
            background: 'linear-gradient(to right, #fffbf5, #fef9f2)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <h2 style={{
              margin: 0, fontSize: 13, fontWeight: 600,
              color: '#c2410c', textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Update Case Status
            </h2>
            <button
              onClick={() => setShowStatusForm(v => !v)}
              style={{
                padding: '5px 14px', borderRadius: 7,
                border: '1px solid #e8820c',
                background: showStatusForm ? '#fff7ed' : 'white',
                color: '#e8820c', fontSize: 13,
                cursor: 'pointer'
              }}
            >
              {showStatusForm ? 'Cancel' : 'Update Status'}
            </button>
          </div>

          {showStatusForm && (
            <div style={{ padding: 20 }}>

              {/* Next Status Buttons */}
              <p style={{
                fontSize: 13, color: '#64748b',
                margin: '0 0 12px'
              }}>
                Move case to:
              </p>
              <div style={{
                display: 'flex', gap: 8,
                flexWrap: 'wrap', marginBottom: 16
              }}>
                {nextStatuses.map(s => (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 8, fontSize: 13,
                      cursor: 'pointer',
                      border: `2px solid ${newStatus === s ? '#e8820c' : '#e2e0d9'}`,
                      background: newStatus === s
                        ? '#fff7ed' : 'white',
                      color: newStatus === s
                        ? '#c2410c' : '#64748b',
                      fontWeight: newStatus === s ? 500 : 400,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Summons Date */}
              {newStatus === 'Summoned' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block', fontSize: 13,
                    fontWeight: 500, color: '#374151',
                    marginBottom: 6
                  }}>
                    Date Summoned
                  </label>
                  <input
                    type="date"
                    className={styles.input}
                    style={{ maxWidth: 200 }}
                    value={summonsDate}
                    onChange={e =>
                      setSummonsDate(e.target.value)
                    }
                    max={TODAY}
                  />
                  <p style={{
                    fontSize: 12, color: '#94a3b8',
                    margin: '6px 0 0'
                  }}>
                    A Summons Letter (SL) will be generated
                    automatically.
                  </p>
                </div>
              )}

              {/* Mediation Fields */}
              {newStatus === 'Mediation Scheduled' && (
                <div style={{ marginBottom: 16 }}>
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Mediation Date
                      </label>
                      <input
                        type="date"
                        className={styles.input}
                        value={mediationDate}
                        onChange={e =>
                          setMediationDate(e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Mediation Time
                      </label>
                      <input
                        type="time"
                        className={styles.input}
                        value={mediationTime}
                        onChange={e =>
                          setMediationTime(e.target.value)
                        }
                      />
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Venue
                      </label>
                      <input
                        className={styles.input}
                        value={mediationVenue}
                        onChange={e =>
                          setMediationVenue(e.target.value)
                        }
                        placeholder="e.g. Barangay Hall"
                      />
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Mediator Name
                      </label>
                      <input
                        className={styles.input}
                        value={mediatorName}
                        onChange={e =>
                          setMediatorName(e.target.value)
                        }
                        placeholder="Punong Barangay or Lupon Member"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Resolution Fields */}
              {(newStatus === 'Settled' ||
                newStatus === 'Referred to Court' ||
                newStatus === 'Dismissed') && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    display: 'flex', gap: 16,
                    marginBottom: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <label className={styles.fieldLabel}>
                        Resolution Date
                      </label>
                      <input
                        type="date"
                        className={styles.input}
                        value={resolutionDate}
                        onChange={e =>
                          setResolutionDate(e.target.value)
                        }
                        max={TODAY}
                      />
                    </div>
                  </div>
                  <label className={styles.fieldLabel}>
                    Resolution Notes
                  </label>
                  <textarea
                    className={styles.textarea}
                    value={resolutionNotes}
                    onChange={e =>
                      setResolutionNotes(e.target.value)
                    }
                    placeholder={
                      newStatus === 'Settled'
                        ? 'Describe the terms of settlement...'
                        : newStatus === 'Referred to Court'
                          ? 'Reason for referral to court...'
                          : 'Reason for dismissal...'
                    }
                    rows={3}
                  />
                  {newStatus === 'Settled' && (
                    <p style={{
                      fontSize: 12, color: '#94a3b8',
                      margin: '6px 0 0'
                    }}>
                      An Amicable Settlement (AS) document will
                      be generated automatically.
                    </p>
                  )}
                  {newStatus === 'Referred to Court' && (
                    <p style={{
                      fontSize: 12, color: '#94a3b8',
                      margin: '6px 0 0'
                    }}>
                      A Certificate to File Action (CFA) will
                      be generated automatically.
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleStatusUpdate}
                disabled={updating}
                className={`${styles.saveButton} ${updating ? styles.saveButtonDisabled : ''}`}
              >
                {updating
                  ? <><Loader2 size={15} /> Updating...</>
                  : <><CheckCircle size={15} />
                    Confirm Update to {newStatus}
                  </>
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* Case Summary */}
      <Section title="Case Summary">
        <InfoRow
          label="Blotter Number"
          value={record.blotter_number}
        />
        <InfoRow
          label="Current Status"
          value={record.status}
        />
        <InfoRow
          label="Incident Type"
          value={record.incident_type_name}
        />
        <InfoRow
          label="Date of Incident"
          value={new Date(record.incident_date)
            .toLocaleDateString('en-PH', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
        />
        <InfoRow
          label="Time of Incident"
          value={record.incident_time
            ? record.incident_time.slice(0, 5)
            : null}
        />
        <InfoRow
          label="Place of Incident"
          value={record.incident_place}
        />
        <InfoRow
          label="Date Filed"
          value={new Date(record.created_at)
            .toLocaleDateString('en-PH', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            })}
        />
        <InfoRow
          label="Recorded By"
          value={record.recorded_by_name}
        />
      </Section>

      {/* Complainant */}
      <Section title="Complainant">
        <InfoRow
          label="Name"
          value={record.complainant_name}
        />
        <InfoRow
          label="Address"
          value={record.complainant_address}
        />
        <InfoRow
          label="Contact Number"
          value={record.complainant_contact}
        />
        <InfoRow
          label="Age"
          value={record.complainant_age?.toString()}
        />
        <InfoRow
          label="Civil Status"
          value={record.complainant_civil_status}
        />
        {record.complainant_resident_id && (
          <div style={{
            marginTop: 8, paddingTop: 8,
            borderTop: '1px solid #f8f7f3'
          }}>
            <Link
              href={`/dashboard/residents/${record.complainant_resident_id}`}
              style={{
                fontSize: 13, color: '#e8820c',
                textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 5
              }}
            >
              <FileText size={13} /> View Resident Profile
            </Link>
          </div>
        )}
      </Section>

      {/* Respondents */}
      <Section title="Respondent(s)">
        <p className={styles.narrativeText}>
          {record.respondents}
        </p>
      </Section>

      {/* Narrative */}
      <Section title="Incident Narrative">
        <p className={styles.narrativeText}>
          {record.narrative}
        </p>
      </Section>

      {/* Witnesses & Evidence */}
      {(record.witnesses || record.evidence_remarks) && (
        <Section title="Witnesses & Evidence">
          {record.witnesses && (
            <InfoRow
              label="Witnesses"
              value={record.witnesses}
            />
          )}
          {record.evidence_remarks && (
            <InfoRow
              label="Evidence / Remarks"
              value={record.evidence_remarks}
            />
          )}
        </Section>
      )}

      {/* Summons Info */}
      {record.summons_date && (
        <Section title="Summons Information">
          <InfoRow
            label="Date Summoned"
            value={new Date(record.summons_date)
              .toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric',
                year: 'numeric'
              })}
          />
          <InfoRow
            label="Summons Control No."
            value={record.summons_control_number}
          />
        </Section>
      )}

      {/* Mediation Info */}
      {record.mediation_date && (
        <Section title="Mediation Information">
          <InfoRow
            label="Mediation Date"
            value={new Date(record.mediation_date)
              .toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric',
                year: 'numeric'
              })}
          />
          <InfoRow
            label="Mediation Time"
            value={record.mediation_time
              ? record.mediation_time.slice(0, 5)
              : null}
          />
          <InfoRow
            label="Venue"
            value={record.mediation_venue}
          />
          <InfoRow
            label="Mediator"
            value={record.mediator_name}
          />
        </Section>
      )}

      {/* Resolution */}
      {record.resolution_date && (
        <Section title="Resolution">
          <InfoRow
            label="Resolution Date"
            value={new Date(record.resolution_date)
              .toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric',
                year: 'numeric'
              })}
          />
          <InfoRow
            label="Resolution Notes"
            value={record.resolution_notes}
          />
          {record.cfa_control_number && (
            <InfoRow
              label="CFA Control No."
              value={record.cfa_control_number}
            />
          )}
          {record.settlement_control_number && (
            <InfoRow
              label="Settlement Control No."
              value={record.settlement_control_number}
            />
          )}
        </Section>
      )}

    </div>
  )
}