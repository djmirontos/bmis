'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2,
  AlertCircle, Search, X
} from 'lucide-react'
import type { Resident, IncidentType } from '@/lib/types'
import styles from '../styles/blotter.module.css'

const TODAY = new Date().toISOString().split('T')[0]

function Field({ label, required, error, half, children }: {
  label: string
  required?: boolean
  error?: string
  half?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={half ? styles.fieldHalf : styles.field}>
      <label className={styles.fieldLabel}>
        {label}
        {required && (
          <span className={styles.fieldRequired}> *</span>
        )}
      </label>
      {children}
      {error && (
        <div className={styles.fieldError}>
          <AlertCircle size={12} color="#dc2626" />
          <span className={styles.fieldErrorText}>{error}</span>
        </div>
      )}
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

export default function NewBlotterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([])

  // Complainant search
  const [complainantSearch, setComplainantSearch] = useState('')
  const [complainantResults, setComplainantResults] = useState<Resident[]>([])
  const [searchingComplainant, setSearchingComplainant] = useState(false)
  const [selectedComplainant, setSelectedComplainant] =
    useState<Resident | null>(null)
  const [isWalkIn, setIsWalkIn] = useState(false)

  const [form, setForm] = useState({
    incident_type_id: '',
    incident_type_name: '',
    incident_date: TODAY,
    incident_time: '',
    incident_place: '',
    narrative: '',
    witnesses: '',
    evidence_remarks: '',
    complainant_name: '',
    complainant_address: '',
    complainant_contact: '',
    complainant_age: '',
    complainant_civil_status: '',
    respondents: '',
  })

  useEffect(() => {
    supabase.from('incident_types')
      .select('*').eq('is_active', true).order('name')
      .then(({ data }: { data: any }) => setIncidentTypes(data ?? []))
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
    }
  }

  async function searchComplainant() {
    if (!complainantSearch.trim()) return
    setSearchingComplainant(true)
    const { data } = await supabase
      .from('residents')
      .select('*, purok:puroks(id,name)')
      .or(
        `last_name.ilike.%${complainantSearch}%,` +
        `first_name.ilike.%${complainantSearch}%`
      )
      .eq('is_deceased', false)
      .eq('is_transferred', false)
      .limit(8)
    setComplainantResults(data ?? [])
    setSearchingComplainant(false)
  }

  function selectComplainant(resident: Resident) {
    setSelectedComplainant(resident)
    setComplainantResults([])
    setComplainantSearch('')

    const address = [
      resident.house_number,
      resident.street,
      (resident.purok as any)?.name,
      'Barangay IV',
    ].filter(Boolean).join(', ')

    setForm(prev => ({
      ...prev,
      complainant_name:
        `${resident.last_name}, ${resident.first_name} ${resident.middle_name ?? ''}`.trim(),
      complainant_address: address,
      complainant_contact: resident.contact_number ?? '',
      complainant_age: '',
      complainant_civil_status: resident.civil_status ?? '',
    }))
  }

  function clearComplainant() {
    setSelectedComplainant(null)
    setIsWalkIn(false)
    setForm(prev => ({
      ...prev,
      complainant_name: '',
      complainant_address: '',
      complainant_contact: '',
      complainant_age: '',
      complainant_civil_status: '',
    }))
  }

  function handleIncidentTypeChange(id: string) {
    const found = incidentTypes.find(t => t.id === id)
    setForm(prev => ({
      ...prev,
      incident_type_id: id,
      incident_type_name: found?.name ?? '',
    }))
    if (errors.incident_type_id) {
      setErrors(prev => {
        const e = { ...prev }
        delete e.incident_type_id
        return e
      })
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (!form.incident_type_id)
      newErrors.incident_type_id = 'Incident type is required.'
    if (!form.incident_date)
      newErrors.incident_date = 'Incident date is required.'
    if (!form.incident_place.trim())
      newErrors.incident_place = 'Place of incident is required.'
    if (!form.narrative.trim())
      newErrors.narrative = 'Narrative is required.'
    if (!form.complainant_name.trim())
      newErrors.complainant_name = 'Complainant name is required.'
    if (!form.respondents.trim())
      newErrors.respondents = 'Respondent(s) is required.'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    setSubmitError('')
    if (!validate()) {
      setSubmitError('Please fill in all required fields.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('id', user!.id)
      .single()

    const { data: captain } = await supabase
      .from('barangay_officials')
      .select('full_name')
      .eq('position', 'Punong Barangay')
      .eq('is_active', true)
      .single()

    const payload = {
      blotter_number: '',
      incident_type_id: form.incident_type_id || null,
      incident_type_name: form.incident_type_name,
      incident_date: form.incident_date,
      incident_time: form.incident_time || null,
      incident_place: form.incident_place.trim(),
      narrative: form.narrative.trim(),
      witnesses: form.witnesses.trim() || null,
      evidence_remarks: form.evidence_remarks.trim() || null,
      complainant_resident_id: selectedComplainant?.id ?? null,
      complainant_name: form.complainant_name.trim(),
      complainant_address: form.complainant_address.trim() || null,
      complainant_contact: form.complainant_contact.trim() || null,
      complainant_age: form.complainant_age
        ? parseInt(form.complainant_age) : null,
      complainant_civil_status:
        form.complainant_civil_status.trim() || null,
      respondents: form.respondents.trim(),
      status: 'Filed',
      recorded_by_name: profile?.full_name ?? user?.email,
      punong_barangay: captain?.full_name ?? null,
      created_by: user?.id,
    }

    const { data: inserted, error } = await supabase
      .from('blotter_records')
      .insert(payload)
      .select('id, blotter_number')
      .single()

    if (error) {
      setSubmitError('Error filing blotter: ' + error.message)
      setSaving(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'INSERT',
      table_name: 'blotter_records',
      record_id: inserted.id,
      notes: `Blotter filed: ${inserted.blotter_number}`,
    })

    router.push(`/dashboard/blotter/${inserted.id}`)
  }

  return (
    <div className={styles.formContainer}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <Link href="/dashboard/blotter" className={styles.backButton}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className={styles.pageTitle}>File Blotter Report</h1>
          <p className={styles.pageSubtitle}>
            Barangay IV, Tangub City
          </p>
        </div>
      </div>

      {submitError && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} /> {submitError}
        </div>
      )}

      {/* Complainant */}
      <Section title="Complainant Information">

        {/* Search or Walk-in toggle */}
        {!selectedComplainant && !isWalkIn && (
          <div style={{ marginBottom: 16 }}>
            <p style={{
              fontSize: 13, color: '#64748b',
              margin: '0 0 10px'
            }}>
              Search if complainant is a registered resident,
              or enter manually for walk-in.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{
                position: 'relative', flex: 1
              }}>
                <input
                  className={styles.input}
                  value={complainantSearch}
                  onChange={e =>
                    setComplainantSearch(e.target.value)
                  }
                  onKeyDown={e =>
                    e.key === 'Enter' && searchComplainant()
                  }
                  placeholder="Search resident by name..."
                />
              </div>
              <button
                onClick={searchComplainant}
                disabled={searchingComplainant}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 6, padding: '9px 16px',
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #f4a020, #c96008)',
                  color: 'white', border: 'none',
                  fontSize: 13, cursor: 'pointer'
                }}
              >
                {searchingComplainant
                  ? <Loader2 size={14} />
                  : <Search size={14} />
                }
                Search
              </button>
              <button
                onClick={() => setIsWalkIn(true)}
                style={{
                  padding: '9px 16px', borderRadius: 8,
                  border: '1px solid #e2e0d9',
                  background: 'white', color: '#374151',
                  fontSize: 13, cursor: 'pointer'
                }}
              >
                Walk-in / Manual
              </button>
            </div>

            {/* Search Results */}
            {complainantResults.length > 0 && (
              <div className={styles.searchResultsBox}>
                {complainantResults.map(r => (
                  <div
                    key={r.id}
                    className={styles.searchResultItem}
                    onClick={() => selectComplainant(r)}
                  >
                    <div className={styles.residentAvatar}>
                      {r.first_name[0]}{r.last_name[0]}
                    </div>
                    <div>
                      <p className={styles.residentName}>
                        {r.last_name}, {r.first_name}{' '}
                        {r.middle_name ?? ''}
                      </p>
                      <p className={styles.residentAddress}>
                        {r.street
                          ? `${r.street}, `
                          : ''
                        }
                        {(r.purok as any)?.name ?? ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Resident Card */}
        {selectedComplainant && (
          <div className={styles.selectedCard}>
            <div className={styles.residentAvatar}>
              {selectedComplainant.first_name[0]}
              {selectedComplainant.last_name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{
                margin: '0 0 2px', fontSize: 14,
                fontWeight: 500, color: '#0f172a'
              }}>
                {selectedComplainant.last_name},{' '}
                {selectedComplainant.first_name}{' '}
                {selectedComplainant.middle_name ?? ''}
              </p>
              <p style={{
                margin: 0, fontSize: 12, color: '#94a3b8'
              }}>
                Registered Resident ·{' '}
                {form.complainant_address}
              </p>
            </div>
            <button
              onClick={clearComplainant}
              className={styles.changeButton}
            >
              Change
            </button>
          </div>
        )}

        {/* Manual / Walk-in Fields */}
        {(isWalkIn || selectedComplainant) && (
          <div style={{ marginTop: 12 }}>
            {isWalkIn && (
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 12
              }}>
                <span style={{
                  fontSize: 12, color: '#e8820c',
                  fontWeight: 500
                }}>
                  Walk-in / Non-resident
                </span>
                <button
                  onClick={clearComplainant}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: 4, fontSize: 12, color: '#64748b',
                    background: 'none', border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <X size={12} /> Clear
                </button>
              </div>
            )}
            <div className={styles.fieldRow}>
              <Field
                label="Full Name"
                required
                error={errors.complainant_name}
              >
                <input
                  className={`${styles.input} ${errors.complainant_name ? styles.inputError : ''}`}
                  value={form.complainant_name}
                  onChange={e =>
                    set('complainant_name', e.target.value)
                  }
                  placeholder="Last, First Middle"
                  disabled={!!selectedComplainant}
                />
              </Field>
              <Field label="Address" half>
                <input
                  className={styles.input}
                  value={form.complainant_address}
                  onChange={e =>
                    set('complainant_address', e.target.value)
                  }
                  placeholder="Full address"
                  disabled={!!selectedComplainant}
                />
              </Field>
              <Field label="Contact Number" half>
                <input
                  className={styles.input}
                  value={form.complainant_contact}
                  onChange={e =>
                    set('complainant_contact', e.target.value)
                  }
                  placeholder="09XXXXXXXXX"
                />
              </Field>
              <Field label="Age" half>
                <input
                  className={styles.input}
                  type="number"
                  min="1"
                  max="120"
                  value={form.complainant_age}
                  onChange={e =>
                    set('complainant_age', e.target.value)
                  }
                  placeholder="Age"
                />
              </Field>
              <Field label="Civil Status" half>
                <select
                  className={styles.select}
                  value={form.complainant_civil_status}
                  onChange={e =>
                    set('complainant_civil_status', e.target.value)
                  }
                >
                  <option value="">— Select —</option>
                  <option>Single</option>
                  <option>Married</option>
                  <option>Widowed</option>
                  <option>Legally Separated</option>
                  <option>Annulled</option>
                </select>
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* Respondent(s) */}
      <Section title="Respondent(s)">
        <Field
          label="Name(s) of Respondent(s)"
          required
          error={errors.respondents}
        >
          <textarea
            className={`${styles.textarea} ${errors.respondents ? styles.inputError : ''}`}
            value={form.respondents}
            onChange={e => set('respondents', e.target.value)}
            placeholder={
              'List all respondents, one per line.\n' +
              'Example:\nDELA CRUZ, JUAN — Purok 2\n' +
              'SANTOS, MARIA — Non-resident'
            }
            rows={4}
          />
          <div className={styles.charCount}>
            {form.respondents.length} characters
          </div>
        </Field>
      </Section>

      {/* Incident Details */}
      <Section title="Incident Details">
        <div className={styles.fieldRow}>
          <Field
            label="Incident Type"
            required
            error={errors.incident_type_id}
            half
          >
            <select
              className={`${styles.select} ${errors.incident_type_id ? styles.inputError : ''}`}
              value={form.incident_type_id}
              onChange={e =>
                handleIncidentTypeChange(e.target.value)
              }
            >
              <option value="">— Select Type —</option>
              {incidentTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Date of Incident"
            required
            error={errors.incident_date}
            half
          >
            <input
              className={`${styles.input} ${errors.incident_date ? styles.inputError : ''}`}
              type="date"
              max={TODAY}
              value={form.incident_date}
              onChange={e => set('incident_date', e.target.value)}
            />
          </Field>
          <Field label="Time of Incident" half>
            <input
              className={styles.input}
              type="time"
              value={form.incident_time}
              onChange={e => set('incident_time', e.target.value)}
            />
          </Field>
          <Field
            label="Place of Incident"
            required
            error={errors.incident_place}
            half
          >
            <input
              className={`${styles.input} ${errors.incident_place ? styles.inputError : ''}`}
              value={form.incident_place}
              onChange={e => set('incident_place', e.target.value)}
              placeholder="e.g. Purok 2, near the basketball court"
              maxLength={200}
            />
          </Field>
        </div>

        <Field
          label="Narrative / Description of Incident"
          required
          error={errors.narrative}
        >
          <textarea
            className={`${styles.textarea} ${errors.narrative ? styles.inputError : ''}`}
            value={form.narrative}
            onChange={e => set('narrative', e.target.value)}
            placeholder="Describe in detail what happened — who was involved, what occurred, how it started, and any other relevant information..."
            rows={6}
          />
          <div className={styles.charCount}>
            {form.narrative.length} characters
          </div>
        </Field>

        <Field label="Witnesses (if any)">
          <textarea
            className={styles.textarea}
            value={form.witnesses}
            onChange={e => set('witnesses', e.target.value)}
            placeholder="List witness names and contact info if available..."
            rows={3}
          />
        </Field>

        <Field label="Evidence / Remarks">
          <textarea
            className={styles.textarea}
            value={form.evidence_remarks}
            onChange={e => set('evidence_remarks', e.target.value)}
            placeholder="Note any evidence, injuries, property damage, etc..."
            rows={3}
          />
        </Field>
      </Section>

      {/* Actions */}
      <div className={styles.actions}>
        <Link
          href="/dashboard/blotter"
          className={styles.cancelButton}
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${styles.saveButton} ${saving ? styles.saveButtonDisabled : ''}`}
        >
          {saving ? <Loader2 size={16} /> : <Save size={16} />}
          {saving ? 'Filing...' : 'File Blotter Report'}
        </button>
      </div>
    </div>
  )
}