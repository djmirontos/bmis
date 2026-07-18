'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertCircle, Upload, X } from 'lucide-react'
import {
  sanitizeName, sanitizeText,
  validateName, validateContactNumber,
  validateEmail, validateRemarks,
  type FieldErrors
} from '@/lib/validation'
import styles from '../../styles/form.module.css'

const TODAY = new Date().toISOString().split('T')[0]

const BRGY_POSITIONS = [
  'Punong Barangay', 'Barangay Kagawad',
  'Barangay Secretary', 'Barangay Treasurer'
]
const SK_POSITIONS = [
  'SK Chairperson', 'SK Kagawad',
  'SK Secretary', 'SK Treasurer'
]
const TANOD_STATUSES = ['Active', 'Inactive', 'Suspended', 'Resigned']

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className={styles.fieldError}>
      <AlertCircle size={12} color="#dc2626" />
      <span className={styles.fieldErrorText}>{message}</span>
    </div>
  )
}

function Field({ label, required, error, half, children }: {
  label: string, required?: boolean,
  error?: string, half?: boolean,
  children: React.ReactNode
}) {
  return (
    <div className={half ? styles.fieldHalf : styles.field}>
      <label className={styles.fieldLabel}>
        {label}{' '}
        {required && <span className={styles.fieldRequired}>*</span>}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

function Section({ title, note, children }: {
  title: string, note?: string, children: React.ReactNode
}) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      <div className={styles.sectionBody}>
        {note && <p className={styles.sectionNote}>{note}</p>}
        {children}
      </div>
    </div>
  )
}

function EditOfficialPageInner() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const type = searchParams.get('type') ?? 'official'
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [committees, setCommittees] = useState<any[]>([])
  const [signatureFile, setSignatureFile] = useState<File | null>(null)
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState('')
  const [existingSignature, setExistingSignature] = useState<string | null>(null)

  const isTanod = type === 'tanod'
  const isSK = type === 'sk'
  const tableName = isTanod
    ? 'barangay_tanod'
    : isSK ? 'sk_officials' : 'barangay_officials'
  const positions = isSK ? SK_POSITIONS : BRGY_POSITIONS

  const [form, setForm] = useState({
    full_name: '',
    position: '',
    committee: '',
    term_start: '',
    term_end: '',
    is_active: true,
    date_appointed: '',
    date_ended: '',
    status: 'Active',
    contact_number: '',
    email_address: '',
    remarks: '',
  })

  useEffect(() => {
    async function load() {
      const [{ data: record }, { data: comms }] = await Promise.all([
        supabase.from(tableName).select('*').eq('id', id).single(),
        supabase.from('committees').select('*').order('name'),
      ])

      if (!record) { setNotFound(true); setLoading(false); return }

      setCommittees(comms ?? [])
      setExistingSignature(record.signature_path ?? null)

      setForm({
        full_name: record.full_name ?? '',
        position: record.position ?? '',
        committee: record.committee ?? '',
        term_start: record.term_start ?? '',
        term_end: record.term_end ?? '',
        is_active: record.is_active ?? true,
        date_appointed: record.date_appointed ?? '',
        date_ended: record.date_ended ?? '',
        status: record.status ?? 'Active',
        contact_number: record.contact_number ?? '',
        email_address: record.email_address ?? '',
        remarks: record.remarks ?? '',
      })

      setLoading(false)
    }
    load()
  }, [id, type])

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field])
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
  }

  function setFieldError(field: string, message: string) {
    if (message) setErrors(prev => ({ ...prev, [field]: message }))
    else setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
  }

  function onKeyDownName(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = /^[a-zA-ZÀ-ÿñÑ\s\-'\.,]$/
    const controlKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!controlKeys.includes(e.key) && !allowed.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  function handleSignatureChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'image/png') {
      setFieldError('signature', 'Signature must be a PNG file.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setFieldError('signature', 'Signature file must be 2MB or less.')
      return
    }
    setSignatureFile(file)
    setSignaturePreviewUrl(URL.createObjectURL(file))
    setFieldError('signature', '')
  }

  function validateForm(): boolean {
    const newErrors: FieldErrors = {}

    const nameErr = validateName(form.full_name, 'Full name', true)
    if (nameErr) newErrors.full_name = nameErr

    if (!isTanod && !form.position)
      newErrors.position = 'Position is required.'

    if (!isTanod) {
      if (!form.term_start) newErrors.term_start = 'Term start date is required.'
      if (!form.term_end) newErrors.term_end = 'Term end date is required.'
      if (form.term_start && form.term_end && form.term_end <= form.term_start)
        newErrors.term_end = 'Term end date must be after term start.'
    }

    const contactErr = validateContactNumber(form.contact_number)
    if (contactErr) newErrors.contact_number = contactErr

    const emailErr = validateEmail(form.email_address)
    if (emailErr) newErrors.email_address = emailErr

    const remarksErr = validateRemarks(form.remarks)
    if (remarksErr) newErrors.remarks = remarksErr

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    setSubmitError('')
    if (!validateForm()) {
      setSubmitError('Please fix the errors below before saving.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    let signaturePath = existingSignature
    if (signatureFile && !isTanod) {
      if (existingSignature) {
        await supabase.storage.from('signatures').remove([existingSignature])
      }
      const fileName = `${type}_${id}_${Date.now()}.png`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('signatures')
        .upload(fileName, signatureFile, { contentType: 'image/png', upsert: true })
      if (uploadError) {
        setSubmitError('Error uploading signature: ' + uploadError.message)
        setSaving(false)
        return
      }
      signaturePath = uploadData.path
    }

    let updatePayload: any = {
      full_name: form.full_name.trim(),
      contact_number: form.contact_number.trim() || null,
      remarks: form.remarks.trim() || null,
    }

    if (isTanod) {
      updatePayload = {
        ...updatePayload,
        status: form.status,
        date_appointed: form.date_appointed || null,
        date_ended: form.date_ended || null,
      }
    } else {
      updatePayload = {
        ...updatePayload,
        position: form.position,
        committee: form.committee || null,
        term_start: form.term_start,
        term_end: form.term_end,
        is_active: form.is_active,
        email_address: form.email_address.trim() || null,
        signature_path: signaturePath,
      }
    }

    const { error: updateError } = await supabase
      .from(tableName).update(updatePayload).eq('id', id)

    if (updateError) {
      setSubmitError('Error updating: ' + updateError.message)
      setSaving(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'UPDATE',
      table_name: tableName,
      record_id: id as string,
      notes: `Record updated: ${form.full_name}`,
    })

    router.push(`/dashboard/officials/${id}?type=${type}`)
  }

  function inputClass(hasError?: boolean) {
    return `${styles.input} ${hasError ? styles.inputError : ''}`
  }

  function selectClass(hasError?: boolean) {
    return `${styles.select} ${hasError ? styles.selectError : ''}`
  }

  const pageTitle = isTanod
    ? 'Edit Tanod'
    : isSK ? 'Edit SK Official' : 'Edit Official'

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Loading...
    </div>
  )

  if (notFound) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
      Record not found.{' '}
      <Link href="/dashboard/officials" style={{ color: '#e8820c' }}>Back</Link>
    </div>
  )

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <Link
          href={`/dashboard/officials/${id}?type=${type}`}
          className={styles.backButton}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          <p className={styles.pageSubtitle}>Barangay IV, Tangub City</p>
        </div>
      </div>

      {submitError && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} /> {submitError}
        </div>
      )}

      {/* Basic Information */}
      <Section title="Basic Information">
        <div className={styles.fieldRow}>
          <Field label="Full Name" required error={errors.full_name}>
            <input
              className={inputClass(!!errors.full_name)}
              value={form.full_name}
              onChange={e => set('full_name', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              onBlur={e => setFieldError('full_name',
                validateName(e.target.value, 'Full name', true))}
              maxLength={150}
            />
          </Field>

          {!isTanod && (
            <Field label="Position" required error={errors.position} half>
              <select
                className={selectClass(!!errors.position)}
                value={form.position}
                onChange={e => set('position', e.target.value)}
              >
                <option value="">— Select —</option>
                {positions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          )}

          {!isTanod && (
            <Field label="Committee" half>
              <select
                className={selectClass()}
                value={form.committee}
                onChange={e => set('committee', e.target.value)}
              >
                <option value="">— None / N/A —</option>
                {committees.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </Field>
          )}

          {isTanod && (
            <Field label="Status" required half>
              <select
                className={selectClass()}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {TANOD_STATUSES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </Field>
          )}

          {!isTanod && (
            <Field label="Active Status" half>
              <select
                className={selectClass()}
                value={form.is_active ? 'true' : 'false'}
                onChange={e => set('is_active', e.target.value === 'true')}
              >
                <option value="true">Active (Current Term)</option>
                <option value="false">Inactive (Past Official)</option>
              </select>
            </Field>
          )}
        </div>
      </Section>

      {/* Term / Appointment */}
      <Section title={isTanod ? 'Appointment Details' : 'Term of Office'}>
        <div className={styles.fieldRow}>
          {!isTanod ? (
            <>
              <Field label="Term Start" required error={errors.term_start} half>
                <input
                  className={inputClass(!!errors.term_start)}
                  type="date"
                  value={form.term_start}
                  onChange={e => set('term_start', e.target.value)}
                  onBlur={e => {
                    if (!e.target.value)
                      setFieldError('term_start', 'Term start is required.')
                    else setFieldError('term_start', '')
                  }}
                />
              </Field>
              <Field label="Term End" required error={errors.term_end} half>
                <input
                  className={inputClass(!!errors.term_end)}
                  type="date"
                  value={form.term_end}
                  onChange={e => set('term_end', e.target.value)}
                  onBlur={e => {
                    if (!e.target.value) {
                      setFieldError('term_end', 'Term end is required.')
                    } else if (form.term_start && e.target.value <= form.term_start) {
                      setFieldError('term_end', 'Term end must be after term start.')
                    } else {
                      setFieldError('term_end', '')
                    }
                  }}
                />
              </Field>
            </>
          ) : (
            <>
              <Field label="Date Appointed" half>
                <input
                  className={inputClass()}
                  type="date"
                  max={TODAY}
                  value={form.date_appointed}
                  onChange={e => set('date_appointed', e.target.value)}
                />
              </Field>
              <Field label="Date Ended" half>
                <input
                  className={inputClass()}
                  type="date"
                  max={TODAY}
                  value={form.date_ended}
                  onChange={e => set('date_ended', e.target.value)}
                />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact Information">
        <div className={styles.fieldRow}>
          <Field label="Contact Number" error={errors.contact_number} half>
            <input
              className={inputClass(!!errors.contact_number)}
              value={form.contact_number}
              onChange={e => set('contact_number',
                e.target.value.replace(/[^0-9+\s]/g, ''))}
              onBlur={e => setFieldError('contact_number',
                validateContactNumber(e.target.value))}
              placeholder="09XXXXXXXXX"
              maxLength={13}
            />
          </Field>
          {!isTanod && (
            <Field label="Email Address" error={errors.email_address} half>
              <input
                className={inputClass(!!errors.email_address)}
                type="email"
                value={form.email_address}
                onChange={e => set('email_address', e.target.value)}
                onBlur={e => setFieldError('email_address',
                  validateEmail(e.target.value))}
                placeholder="official@email.com"
                maxLength={150}
              />
            </Field>
          )}
        </div>
      </Section>

      {/* Signature */}
      {!isTanod && (
        <Section
          title="Signature (for document generation)"
          note={`PNG format only, transparent background recommended. Maximum 2MB.${existingSignature && !signatureFile ? ' ✓ Signature already on file.' : ''}`}
        >
          {!signatureFile ? (
            <label className={styles.uploadArea}>
              <Upload size={18} color="#94a3b8" />
              <span className={styles.uploadText}>
                {existingSignature
                  ? 'Click to replace signature'
                  : 'Click to upload signature PNG'}
              </span>
              <input
                type="file"
                accept="image/png"
                onChange={handleSignatureChange}
                style={{ display: 'none' }}
              />
            </label>
          ) : (
            <div className={styles.uploadPreview}>
              <div className={styles.uploadPreviewImage}>
                <img
                  src={signaturePreviewUrl}
                  alt="Signature preview"
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <p className={styles.uploadPreviewName}>{signatureFile.name}</p>
                <p className={styles.uploadPreviewMeta}>
                  {(signatureFile.size / 1024).toFixed(1)} KB · PNG
                </p>
              </div>
              <button
                className={styles.removeButton}
                onClick={() => {
                  setSignatureFile(null)
                  setSignaturePreviewUrl('')
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}
          <FieldError message={errors.signature} />
        </Section>
      )}

      {/* Remarks */}
      <Section title="Remarks">
        <Field label="Additional Notes" error={errors.remarks}>
          <textarea
            className={`${styles.textarea} ${errors.remarks ? styles.inputError : ''}`}
            value={form.remarks}
            onChange={e => set('remarks', sanitizeText(e.target.value))}
            onBlur={e => setFieldError('remarks', validateRemarks(e.target.value))}
            placeholder="Optional notes..."
            maxLength={500}
          />
          <div className={styles.charCount}>{form.remarks.length}/500</div>
        </Field>
      </Section>

      {/* Actions */}
      <div className={styles.actions}>
        <Link
          href={`/dashboard/officials/${id}?type=${type}`}
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
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
import { Suspense } from 'react'
export default function EditOfficialPage() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <EditOfficialPageInner />
    </Suspense>
  )
}
