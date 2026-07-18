'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Search, User, AlertCircle,
  AlertTriangle, CheckCircle, FileText, Loader2
} from 'lucide-react'
import type { Resident, DocumentType, DocumentTypeSettings } from '@/lib/types'
import styles from '../styles/clearance.module.css'
import formStyles from
  '../../../dashboard/residents/styles/form.module.css'

const DOC_TYPES: DocumentType[] = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Certificate of Good Moral Character',
  'Certificate of No Income',
  'First-Time Jobseeker Certificate',
  'Business Clearance',
]

function getAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function buildAddress(resident: Resident): string {
  const parts = [
    resident.house_number,
    resident.street,
    (resident.purok as any)?.name,
    'Barangay IV',
    'Tangub City',
    'Misamis Occidental',
  ].filter(Boolean)
  return parts.join(', ')
}

export default function IssueDocumentPage() {
  const router = useRouter()
  const supabase = createClient()

  // Step: 'search' | 'select' | 'confirm'
  const [step, setStep] = useState<'search' | 'select' | 'confirm'>('search')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Resident[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null)
  const [selectedDocType, setSelectedDocType] = useState<DocumentType | null>(null)
  const [docSettings, setDocSettings] = useState <
    Record<DocumentType, DocumentTypeSettings>
  >({} as any)
  const [purpose, setPurpose] = useState('')
  const [orNumber, setOrNumber] = useState('')
  const [issuing, setIssuing] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [showOrNumber, setShowOrNumber] = useState(true)
  const [firstJobseekerWarning, setFirstJobseekerWarning] = useState(false)

  useEffect(() => {
    async function loadSettings() {
      const [{ data: d }, { data: s }] = await Promise.all([
        supabase.from('document_type_settings').select('*'),
        supabase.from('barangay_settings').select('show_or_number').single(),
      ])
      if (d) {
        const map: any = {}
        d.forEach((dt: any) => { map[dt.document_type] = dt })
        setDocSettings(map)
      }
      if (s) setShowOrNumber(s.show_or_number)
    }
    loadSettings()
  }, [])

  async function handleSearch() {
    if (!searchQuery.trim()) return
    setSearching(true)
    const { data } = await supabase
      .from('residents')
      .select('*, purok:puroks(id, name), household:households(id, household_number)')
      .or(`last_name.ilike.%${searchQuery}%,first_name.ilike.%${searchQuery}%`)
      .eq('is_deceased', false)
      .eq('is_transferred', false)
      .limit(10)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function selectResident(resident: Resident) {
    setError('')
    setWarning('')

    // Check if resident has an address
    const address = buildAddress(resident)
    const hasAddress = !!(
      resident.purok_id ||
      resident.household_id ||
      resident.street ||
      resident.house_number
    )

    if (!hasAddress) {
      setError(
        `${resident.first_name} ${resident.last_name} has no address on record. ` +
        `Please update their profile with a purok or household before issuing a document.`
      )
      return
    }

    setSelectedResident(resident)
    setStep('select')
  }

  async function selectDocType(docType: DocumentType) {
    setWarning('')
    setSelectedDocType(docType)

    // Check First-Time Jobseeker Certificate
    if (docType === 'First-Time Jobseeker Certificate' && selectedResident) {
      const { data } = await supabase
        .from('issued_documents')
        .select('id, control_number, issued_date')
        .eq('resident_id', selectedResident.id)
        .eq('document_type', 'First-Time Jobseeker Certificate')
        .eq('status', 'Issued')
        .limit(1)

      if (data && data.length > 0) {
        setFirstJobseekerWarning(true)
        setWarning(
          `Warning: ${selectedResident.first_name} ${selectedResident.last_name} ` +
          `already received a First-Time Jobseeker Certificate ` +
          `(${data[0].control_number} on ` +
          `${new Date(data[0].issued_date).toLocaleDateString('en-PH')}). ` +
          `RA 11261 allows only one issuance per person. Please verify before proceeding.`
        )
      } else {
        setFirstJobseekerWarning(false)
      }
    } else {
      setFirstJobseekerWarning(false)
    }

    setStep('confirm')
  }

  async function handleIssue() {
    if (!selectedResident || !selectedDocType) return
    setError('')
    setIssuing(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('user_profiles').select('full_name').eq('id', user!.id).single()

    // Get current Punong Barangay
    const { data: captain } = await supabase
      .from('barangay_officials')
      .select('full_name')
      .eq('position', 'Punong Barangay')
      .eq('is_active', true)
      .single()

    // Generate control number via function
    const { data: controlData, error: controlError } = await supabase
      .rpc('generate_control_number', { p_document_type: selectedDocType })

    if (controlError || !controlData) {
      setError('Error generating control number: ' + controlError?.message)
      setIssuing(false)
      return
    }

    const ds = docSettings[selectedDocType]
    const validityMonths = ds?.validity_months ?? 6
    const fee = ds?.fee ?? 0

    // Calculate expiry date
    const issuedDate = new Date()
    const expiryDate = new Date(issuedDate)
    expiryDate.setMonth(expiryDate.getMonth() + validityMonths)

    const address = buildAddress(selectedResident)
    const age = getAge(selectedResident.date_of_birth)

    const payload = {
      control_number: controlData,
      document_type: selectedDocType,
      resident_id: selectedResident.id,
      resident_name: `${selectedResident.last_name}, ${selectedResident.first_name} ${selectedResident.middle_name ?? ''}`.trim(),
      resident_address: address,
      resident_age: age,
      resident_civil_status: selectedResident.civil_status,
      purpose: purpose.trim() || null,
      fee_paid: fee,
      or_number: orNumber.trim() || null,
      status: 'Issued',
      validity_months: validityMonths,
      issued_date: issuedDate.toISOString().split('T')[0],
      expiry_date: expiryDate.toISOString().split('T')[0],
      punong_barangay: captain?.full_name ?? null,
      issued_by: user?.id,
      issued_by_name: profile?.full_name ?? user?.email,
    }

    const { data: issued, error: insertError } = await supabase
      .from('issued_documents')
      .insert(payload)
      .select('id')
      .single()

    if (insertError) {
      setError('Error issuing document: ' + insertError.message)
      setIssuing(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'INSERT',
      table_name: 'issued_documents',
      record_id: issued.id,
      notes: `Document issued: ${controlData} — ${selectedDocType} for ${payload.resident_name}`,
    })

    // Redirect to print page
    router.push(`/print/${issued.id}`)
  }

  const ds = selectedDocType ? docSettings[selectedDocType] : null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/dashboard/clearance" className={formStyles.backButton}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className={formStyles.pageTitle}>Issue Document</h1>
          <p className={formStyles.pageSubtitle}>
            Barangay IV, Tangub City
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 0, marginBottom: 28,
        background: 'white', borderRadius: 12,
        border: '1px solid #e8e6df', overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
      }}>
        {[
          { label: 'Find Resident', key: 'search', icon: Search },
          { label: 'Select Document', key: 'select', icon: FileText },
          { label: 'Confirm & Issue', key: 'confirm', icon: CheckCircle },
        ].map((s, i) => {
          const isActive = step === s.key
          const isDone = (
            (s.key === 'search' && (step === 'select' || step === 'confirm')) ||
            (s.key === 'select' && step === 'confirm')
          )
          return (
            <div
              key={s.key}
              style={{
                flex: 1, padding: '14px 16px',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                borderRight: i < 2 ? '1px solid #f1f0eb' : 'none',
                background: isActive
                  ? 'linear-gradient(to bottom, #fffbf5, #fef9f2)'
                  : 'white',
                transition: 'background 0.15s'
              }}
            >
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? '#e8820c' : isActive ? '#fff7ed' : '#f1f5f9',
                border: `1px solid ${isDone ? '#e8820c' : isActive ? '#fed7aa' : '#e2e8f0'}`,
                flexShrink: 0
              }}>
                {isDone
                  ? <CheckCircle size={14} color="white" />
                  : <s.icon size={13} color={isActive ? '#e8820c' : '#94a3b8'} />
                }
              </div>
              <span style={{
                fontSize: 13, fontWeight: isActive ? 500 : 400,
                color: isActive ? '#c2410c' : isDone ? '#e8820c' : '#94a3b8'
              }}>
                {s.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div className={formStyles.errorBanner} style={{ marginBottom: 16 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Warning */}
      {warning && (
        <div className={formStyles.warningBanner} style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>{warning}</p>
        </div>
      )}

      {/* ── Step 1: Search Resident ── */}
      {step === 'search' && (
        <div className={formStyles.section}>
          <div className={formStyles.sectionHeader}>
            <h2 className={formStyles.sectionTitle}>Find Resident</h2>
          </div>
          <div className={formStyles.sectionBody}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <input
                className={formStyles.input}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Type resident's last name or first name..."
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #f4a020, #c96008)',
                  color: 'white', border: 'none', fontSize: 14,
                  fontWeight: 500, cursor: searching ? 'not-allowed' : 'pointer'
                }}
              >
                {searching ? <Loader2 size={15} /> : <Search size={15} />}
                Search
              </button>
            </div>

            {searchResults.length > 0 && (
              <div style={{
                border: '1px solid #e8e6df',
                borderRadius: 10, overflow: 'hidden'
              }}>
                {searchResults.map((r, i) => {
                  const hasAddress = !!(
                    r.purok_id || r.household_id ||
                    r.street || r.house_number
                  )
                  const address = buildAddress(r)
                  return (
                    <div
                      key={r.id}
                      onClick={() => selectResident(r)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        gap: 12, padding: '12px 16px',
                        borderBottom: i < searchResults.length - 1
                          ? '1px solid #f8f7f3' : 'none',
                        cursor: 'pointer', transition: 'background 0.12s',
                        background: 'white'
                      }}
                      onMouseEnter={e =>
                        (e.currentTarget.style.background = '#fffbf5')}
                      onMouseLeave={e =>
                        (e.currentTarget.style.background = 'white')}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f4a020, #c96008)',
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14, fontWeight: 700, color: 'white',
                        flexShrink: 0
                      }}>
                        {r.first_name[0]}{r.last_name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{
                          margin: '0 0 2px', fontSize: 14,
                          fontWeight: 500, color: '#0f172a'
                        }}>
                          {r.last_name}, {r.first_name}{' '}
                          {r.middle_name ?? ''}
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                          {hasAddress
                            ? address
                            : '⚠ No address on record'
                          }
                        </p>
                      </div>
                      {!hasAddress && (
                        <AlertTriangle size={16} color="#d97706" />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {searchResults.length === 0 && searchQuery && !searching && (
              <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 24 }}>
                No residents found for "{searchQuery}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Select Document Type ── */}
      {step === 'select' && selectedResident && (
        <>
          {/* Selected Resident Card */}
          <div style={{
            background: 'white', borderRadius: 12,
            border: '1px solid #e8e6df', padding: 16,
            marginBottom: 16, display: 'flex',
            alignItems: 'center', gap: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #f4a020, #c96008)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0
            }}>
              {selectedResident.first_name[0]}{selectedResident.last_name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 600, color: '#0f172a' }}>
                {selectedResident.last_name}, {selectedResident.first_name}{' '}
                {selectedResident.middle_name ?? ''}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                {buildAddress(selectedResident)}
              </p>
            </div>
            <button
              onClick={() => { setStep('search'); setSelectedResident(null) }}
              style={{
                padding: '6px 12px', borderRadius: 7,
                border: '1px solid #e2e0d9', background: 'white',
                color: '#64748b', fontSize: 12, cursor: 'pointer'
              }}
            >
              Change
            </button>
          </div>

          <div className={formStyles.section}>
            <div className={formStyles.sectionHeader}>
              <h2 className={formStyles.sectionTitle}>Select Document Type</h2>
            </div>
            <div className={formStyles.sectionBody}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {DOC_TYPES.filter(dt => docSettings[dt]?.is_active !== false).map(dt => {
                  const ds = docSettings[dt]
                  const isFree = (ds?.fee ?? 0) === 0
                  return (
                    <div
                      key={dt}
                      onClick={() => selectDocType(dt)}
                      style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 16px', borderRadius: 10,
                        border: '1px solid #e8e6df',
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: 'white'
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#e8820c'
                        ;(e.currentTarget as HTMLElement).style.background = '#fffbf5'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#e8e6df'
                        ;(e.currentTarget as HTMLElement).style.background = 'white'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText size={18} color="#e8820c" />
                        <div>
                          <p style={{
                            margin: 0, fontSize: 14,
                            fontWeight: 500, color: '#0f172a'
                          }}>
                            {dt}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                            Valid for {ds?.validity_months ?? 6} months
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{
                          margin: 0, fontSize: 14, fontWeight: 600,
                          color: isFree ? '#16a34a' : '#0f172a'
                        }}>
                          {isFree ? 'Free' : `₱${ds?.fee?.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Step 3: Confirm & Issue ── */}
      {step === 'confirm' && selectedResident && selectedDocType && (
        <>
          {/* Resident Card */}
          <div style={{
            background: 'white', borderRadius: 12,
            border: '1px solid #e8e6df', padding: 16,
            marginBottom: 16, display: 'flex',
            alignItems: 'center', gap: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'linear-gradient(135deg, #f4a020, #c96008)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0
            }}>
              {selectedResident.first_name[0]}{selectedResident.last_name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                margin: '0 0 2px', fontSize: 15,
                fontWeight: 600, color: '#0f172a'
              }}>
                {selectedResident.last_name}, {selectedResident.first_name}{' '}
                {selectedResident.middle_name ?? ''}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
                {buildAddress(selectedResident)}
              </p>
            </div>
          </div>

          <div className={formStyles.section}>
            <div className={formStyles.sectionHeader}>
              <h2 className={formStyles.sectionTitle}>Confirm Document Details</h2>
            </div>
            <div className={formStyles.sectionBody}>

              {/* Document Summary */}
              <div style={{
                background: '#fffbf5', border: '1px solid #fed7aa',
                borderRadius: 10, padding: '14px 16px', marginBottom: 20
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', flexWrap: 'wrap', gap: 8
                }}>
                  <div>
                    <p style={{
                      margin: '0 0 4px', fontSize: 15,
                      fontWeight: 600, color: '#c2410c'
                    }}>
                      {selectedDocType}
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>
                      Valid for {ds?.validity_months ?? 6} months from issue date
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      margin: 0, fontSize: 18, fontWeight: 700,
                      color: (ds?.fee ?? 0) === 0 ? '#16a34a' : '#0f172a'
                    }}>
                      {(ds?.fee ?? 0) === 0
                        ? 'Free'
                        : `₱${(ds?.fee ?? 0).toFixed(2)}`
                      }
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>
                      Fee to collect
                    </p>
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div className={formStyles.field}>
                <label className={formStyles.fieldLabel}>Purpose</label>
                <input
                  className={formStyles.input}
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  placeholder="e.g. Employment, Loan Application, School Requirement..."
                  maxLength={200}
                />
              </div>

              {/* OR Number */}
              {showOrNumber && (
                <div className={formStyles.field}>
                  <label className={formStyles.fieldLabel}>
                    Official Receipt (OR) Number
                    {(ds?.fee ?? 0) === 0 && (
                      <span style={{
                        fontSize: 11, color: '#94a3b8',
                        fontWeight: 400, marginLeft: 6
                      }}>
                        (optional — free document)
                      </span>
                    )}
                  </label>
                  <input
                    className={formStyles.input}
                    value={orNumber}
                    onChange={e => setOrNumber(e.target.value)}
                    placeholder="e.g. 2025-001234"
                    maxLength={50}
                  />
                </div>
              )}

              {/* Actions */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 8
              }}>
                <button
                  onClick={() => setStep('select')}
                  style={{
                    padding: '9px 16px', borderRadius: 8,
                    border: '1px solid #e2e0d9', background: 'white',
                    color: '#64748b', fontSize: 14, cursor: 'pointer'
                  }}
                >
                  Back
                </button>
                <button
                  onClick={handleIssue}
                  disabled={issuing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 9,
                    background: issuing
                      ? '#f0a050'
                      : 'linear-gradient(135deg, #f4a020, #c96008)',
                    color: 'white', border: 'none',
                    fontSize: 14, fontWeight: 600,
                    cursor: issuing ? 'not-allowed' : 'pointer',
                    boxShadow: issuing ? 'none' : '0 4px 12px rgba(232,130,12,0.35)'
                  }}
                >
                  {issuing ? <Loader2 size={16} /> : <CheckCircle size={16} />}
                  {issuing ? 'Issuing...' : 'Issue & Print'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}