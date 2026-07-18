'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import type { Purok, Household } from '@/lib/types'
import {
  sanitizeName, sanitizeText, sanitizeStreet,
  sanitizeHouseNumber, sanitizeNumeric,
  validateName, validateContactNumber, validateEmail,
  validateDateOfBirth, validateHouseNumber, validateStreet,
  validateIncome, validateRemarks,
  validateResidentForm,
  checkDuplicateResident,
  type FieldErrors
} from '@/lib/validation'

const CIVIL_STATUSES = ['Single', 'Married', 'Widowed', 'Legally Separated', 'Annulled']
const EDUCATIONAL_ATTAINMENTS = [
  'No Formal Education', 'Elementary Undergraduate', 'Elementary Graduate',
  'High School Undergraduate', 'High School Graduate', 'Senior High School Graduate',
  'Vocational / Tech-Voc', 'College Undergraduate', 'College Graduate', 'Post Graduate'
]
const EMPLOYMENT_STATUSES = ['Employed', 'Self-Employed', 'Unemployed', 'Student', 'Retired', 'OFW']
const HOUSEHOLD_ROLES = ['Head', 'Spouse', 'Child', 'Dependent', 'Boarder', 'Other']
const SUFFIXES = ['', 'Jr.', 'Sr.', 'II', 'III', 'IV']
const TODAY = new Date().toISOString().split('T')[0]

// ============================================================
// Sub-components
// ============================================================

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
      <AlertCircle size={12} color="#dc2626" />
      <span style={{ fontSize: 12, color: '#dc2626' }}>{message}</span>
    </div>
  )
}

function DuplicateWarning({ matches, currentId }: { matches: any[], currentId: string }) {
  const others = matches.filter(m => m.id !== currentId)
  if (!others.length) return null
  return (
    <div style={{
      marginTop: 8, padding: '10px 12px', borderRadius: 8,
      background: '#fffbeb', border: '1px solid #fcd34d',
      display: 'flex', gap: 8
    }}>
      <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 500, color: '#92400e' }}>
          Possible duplicate detected
        </p>
        {others.map(m => (
          <p key={m.id} style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
            {m.last_name}, {m.first_name} {m.middle_name ?? ''} —
            Born {new Date(m.date_of_birth).toLocaleDateString('en-PH')}
          </p>
        ))}
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#b45309' }}>
          You can still save if this is a different person. Please double-check.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12,
      border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden'
    }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#fffbf5' }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#c2410c' }}>{title}</h2>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  )
}

function Field({
  label, required, error, half, children
}: {
  label: string, required?: boolean,
  error?: string, half?: boolean,
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16, width: half ? 'calc(50% - 8px)' : '100%' }}>
      <label style={{
        display: 'block', fontSize: 13,
        fontWeight: 500, color: '#374151', marginBottom: 6
      }}>
        {label} {required && <span style={{ color: '#e8820c' }}>*</span>}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

function getInputStyle(hasError?: boolean) {
  return {
    width: '100%', padding: '8px 12px',
    border: `1px solid ${hasError ? '#fca5a5' : '#e2e8f0'}`,
    borderRadius: 8, fontSize: 14, color: '#0f172a',
    outline: 'none', boxSizing: 'border-box' as const,
    background: hasError ? '#fff5f5' : 'white',
    transition: 'border-color 0.15s'
  }
}

// ============================================================
// Main Page
// ============================================================

export default function EditResidentPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [puroks, setPuroks] = useState<Purok[]>([])
  const [households, setHouseholds] = useState<Household[]>([])

  const [form, setForm] = useState({
    last_name: '', first_name: '', middle_name: '',
    suffix: '', date_of_birth: '', place_of_birth: '',
    sex: 'Male', civil_status: 'Single',
    nationality: 'Filipino', religion: '',
    contact_number: '', email_address: '',
    purok_id: '', household_id: '',
    household_role: 'Head', house_number: '', street: '',
    educational_attainment: '', employment_status: '',
    occupation: '', monthly_income: '',
    voter_id_number: '', philsys_number: '',
    sss_number: '', philhealth_number: '',
    pagibig_number: '', tin_number: '',
    is_voter: false, is_pwd: false,
    pwd_id_number: '', pwd_disability_type: '',
    is_senior_citizen: false, senior_citizen_id: '',
    is_solo_parent: false, solo_parent_id: '',
    is_4ps_beneficiary: false, is_indigent: false,
    is_ofw: false, remarks: ''
  })

  // Load resident data
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('residents')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setForm({
        last_name: data.last_name ?? '',
        first_name: data.first_name ?? '',
        middle_name: data.middle_name ?? '',
        suffix: data.suffix ?? '',
        date_of_birth: data.date_of_birth ?? '',
        place_of_birth: data.place_of_birth ?? '',
        sex: data.sex ?? 'Male',
        civil_status: data.civil_status ?? 'Single',
        nationality: data.nationality ?? 'Filipino',
        religion: data.religion ?? '',
        contact_number: data.contact_number ?? '',
        email_address: data.email_address ?? '',
        purok_id: data.purok_id ?? '',
        household_id: data.household_id ?? '',
        household_role: data.household_role ?? 'Head',
        house_number: data.house_number ?? '',
        street: data.street ?? '',
        educational_attainment: data.educational_attainment ?? '',
        employment_status: data.employment_status ?? '',
        occupation: data.occupation ?? '',
        monthly_income: data.monthly_income?.toString() ?? '',
        voter_id_number: data.voter_id_number ?? '',
        philsys_number: data.philsys_number ?? '',
        sss_number: data.sss_number ?? '',
        philhealth_number: data.philhealth_number ?? '',
        pagibig_number: data.pagibig_number ?? '',
        tin_number: data.tin_number ?? '',
        is_voter: data.is_voter ?? false,
        is_pwd: data.is_pwd ?? false,
        pwd_id_number: data.pwd_id_number ?? '',
        pwd_disability_type: data.pwd_disability_type ?? '',
        is_senior_citizen: data.is_senior_citizen ?? false,
        senior_citizen_id: data.senior_citizen_id ?? '',
        is_solo_parent: data.is_solo_parent ?? false,
        solo_parent_id: data.solo_parent_id ?? '',
        is_4ps_beneficiary: data.is_4ps_beneficiary ?? false,
        is_indigent: data.is_indigent ?? false,
        is_ofw: data.is_ofw ?? false,
        remarks: data.remarks ?? '',
      })

      setLoading(false)
    }

    supabase.from('puroks').select('*')
  .eq('is_active', true)
  .order('name')
  .then(({ data }) => setPuroks(data ?? []))

    load()
  }, [id])

  // Load households when purok changes
  useEffect(() => {
    if (!form.purok_id) { setHouseholds([]); return }
    supabase.from('households').select('*')
      .eq('purok_id', form.purok_id).order('household_number')
      .then(({ data }) => setHouseholds(data ?? []))
  }, [form.purok_id])

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function clearError(field: string) {
    setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
  }

  function setFieldError(field: string, message: string) {
    if (message) setErrors(prev => ({ ...prev, [field]: message }))
    else clearError(field)
  }

  function onBlurName(field: string, value: string, label: string, required = false) {
    setFieldError(field, validateName(value, label, required))
    if (['last_name', 'first_name', 'date_of_birth'].includes(field)) {
      triggerDuplicateCheck(
        field === 'last_name' ? value : form.last_name,
        field === 'first_name' ? value : form.first_name,
        field === 'date_of_birth' ? value : form.date_of_birth
      )
    }
  }

  function onBlurDob(value: string) {
    setFieldError('date_of_birth', validateDateOfBirth(value))
    triggerDuplicateCheck(form.last_name, form.first_name, value)
  }

  async function triggerDuplicateCheck(last: string, first: string, dob: string) {
    if (!last.trim() || !first.trim() || !dob) { setDuplicates([]); return }
    const { matches } = await checkDuplicateResident(
      supabase, last, first, dob, id as string
    )
    setDuplicates(matches)
  }

  function onKeyDownName(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = /^[a-zA-ZÀ-ÿñÑ\s\-'\.]$/
    const controlKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!controlKeys.includes(e.key) && !allowed.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  function onKeyDownNumeric(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = /^[0-9.]$/
    const controlKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!controlKeys.includes(e.key) && !allowed.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  function onFocus(e: React.FocusEvent<any>, hasError: boolean) {
    if (!hasError) e.target.style.borderColor = '#e8820c'
  }

  function onBlurBorder(e: React.FocusEvent<any>, hasError: boolean) {
    if (!hasError) e.target.style.borderColor = '#e2e8f0'
  }

  async function handleSave() {
    setSubmitError('')

    const formErrors = validateResidentForm(form)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      setSubmitError('Please fix the errors below before saving.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const payload = {
      last_name: form.last_name.trim().toUpperCase(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      suffix: form.suffix || null,
      date_of_birth: form.date_of_birth,
      place_of_birth: form.place_of_birth.trim() || null,
      sex: form.sex,
      civil_status: form.civil_status,
      nationality: form.nationality.trim() || 'Filipino',
      religion: form.religion.trim() || null,
      contact_number: form.contact_number.trim() || null,
      email_address: form.email_address.trim() || null,
      purok_id: form.purok_id || null,
      household_id: form.household_id || null,
      household_role: form.household_role || null,
      house_number: form.house_number.trim() || null,
      street: form.street.trim() || null,
      educational_attainment: form.educational_attainment || null,
      employment_status: form.employment_status || null,
      occupation: form.occupation.trim() || null,
      monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
      voter_id_number: form.voter_id_number.trim() || null,
      philsys_number: form.philsys_number.trim() || null,
      sss_number: form.sss_number.trim() || null,
      philhealth_number: form.philhealth_number.trim() || null,
      pagibig_number: form.pagibig_number.trim() || null,
      tin_number: form.tin_number.trim() || null,
      is_voter: form.is_voter,
      is_pwd: form.is_pwd,
      pwd_id_number: form.pwd_id_number.trim() || null,
      pwd_disability_type: form.pwd_disability_type.trim() || null,
      is_senior_citizen: form.is_senior_citizen,
      senior_citizen_id: form.senior_citizen_id.trim() || null,
      is_solo_parent: form.is_solo_parent,
      solo_parent_id: form.solo_parent_id.trim() || null,
      is_4ps_beneficiary: form.is_4ps_beneficiary,
      is_indigent: form.is_indigent,
      is_ofw: form.is_ofw,
      remarks: form.remarks.trim() || null,
      updated_by: user?.id ?? null,
    }

    const { error: updateError } = await supabase
      .from('residents')
      .update(payload)
      .eq('id', id)

    if (updateError) {
      setSubmitError('Error updating resident: ' + updateError.message)
      setSaving(false)
      return
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'UPDATE',
      table_name: 'residents',
      record_id: id as string,
      notes: `Resident updated: ${payload.last_name}, ${payload.first_name}`,
    })

    router.push(`/dashboard/residents/${id}`)
  }

  const s = getInputStyle

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      Loading resident data...
    </div>
  )

  if (notFound) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      Resident not found.{' '}
      <Link href="/dashboard/residents" style={{ color: '#e8820c' }}>
        Back to list
      </Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href={`/dashboard/residents/${id}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          border: '1px solid #e2e8f0', background: 'white',
          color: '#64748b', textDecoration: 'none'
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Edit Resident
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Barangay IV, Tangub City — Fields marked{' '}
            <span style={{ color: '#e8820c' }}>*</span> are required
          </p>
        </div>
      </div>

      {submitError && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fecaca',
          fontSize: 14, color: '#dc2626',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      {duplicates.length > 0 && (
        <DuplicateWarning matches={duplicates} currentId={id as string} />
      )}

      {/* Personal Information */}
      <Section title="Personal Information">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>

          <Field label="Last Name" required error={errors.last_name} half>
            <input
              style={s(!!errors.last_name)}
              value={form.last_name}
              onChange={e => set('last_name', sanitizeName(e.target.value).toUpperCase())}
              onKeyDown={onKeyDownName}
              onBlur={e => onBlurName('last_name', e.target.value, 'Last name', true)}
              onFocus={e => onFocus(e, !!errors.last_name)}
              placeholder="DELA CRUZ"
              maxLength={100}
            />
          </Field>

          <Field label="First Name" required error={errors.first_name} half>
            <input
              style={s(!!errors.first_name)}
              value={form.first_name}
              onChange={e => set('first_name', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              onBlur={e => onBlurName('first_name', e.target.value, 'First name', true)}
              onFocus={e => onFocus(e, !!errors.first_name)}
              placeholder="Juan"
              maxLength={100}
            />
          </Field>

          <Field label="Middle Name" error={errors.middle_name} half>
            <input
              style={s(!!errors.middle_name)}
              value={form.middle_name}
              onChange={e => set('middle_name', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              onBlur={e => onBlurName('middle_name', e.target.value, 'Middle name')}
              onFocus={e => onFocus(e, !!errors.middle_name)}
              placeholder="Santos"
              maxLength={100}
            />
          </Field>

          <Field label="Suffix" half>
            <select
              style={s(false)}
              value={form.suffix}
              onChange={e => set('suffix', e.target.value)}
              onFocus={e => onFocus(e, false)}
              onBlur={e => onBlurBorder(e, false)}
            >
              {SUFFIXES.map(sx => (
                <option key={sx} value={sx}>{sx || '— None —'}</option>
              ))}
            </select>
          </Field>

          <Field label="Date of Birth" required error={errors.date_of_birth} half>
            <input
              style={s(!!errors.date_of_birth)}
              type="date"
              value={form.date_of_birth}
              max={TODAY}
              onChange={e => set('date_of_birth', e.target.value)}
              onBlur={e => onBlurDob(e.target.value)}
              onFocus={e => onFocus(e, !!errors.date_of_birth)}
            />
          </Field>

          <Field label="Place of Birth" error={errors.place_of_birth} half>
            <input
              style={s(!!errors.place_of_birth)}
              value={form.place_of_birth}
              onChange={e => set('place_of_birth', sanitizeText(e.target.value))}
              onFocus={e => onFocus(e, !!errors.place_of_birth)}
              onBlur={e => onBlurBorder(e, !!errors.place_of_birth)}
              placeholder="Tangub City"
              maxLength={100}
            />
          </Field>

          <Field label="Sex" required error={errors.sex} half>
            <select
              style={s(!!errors.sex)}
              value={form.sex}
              onChange={e => { set('sex', e.target.value); clearError('sex') }}
              onFocus={e => onFocus(e, !!errors.sex)}
              onBlur={e => onBlurBorder(e, !!errors.sex)}
            >
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>

          <Field label="Civil Status" required error={errors.civil_status} half>
            <select
              style={s(!!errors.civil_status)}
              value={form.civil_status}
              onChange={e => { set('civil_status', e.target.value); clearError('civil_status') }}
              onFocus={e => onFocus(e, !!errors.civil_status)}
              onBlur={e => onBlurBorder(e, !!errors.civil_status)}
            >
              {CIVIL_STATUSES.map(cs => (
                <option key={cs} value={cs}>{cs}</option>
              ))}
            </select>
          </Field>

          <Field label="Nationality" error={errors.nationality} half>
            <input
              style={s(!!errors.nationality)}
              value={form.nationality}
              onChange={e => set('nationality', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              onFocus={e => onFocus(e, !!errors.nationality)}
              onBlur={e => onBlurBorder(e, !!errors.nationality)}
              maxLength={50}
            />
          </Field>

          <Field label="Religion" error={errors.religion} half>
            <input
              style={s(!!errors.religion)}
              value={form.religion}
              onChange={e => set('religion', sanitizeText(e.target.value))}
              onFocus={e => onFocus(e, !!errors.religion)}
              onBlur={e => onBlurBorder(e, !!errors.religion)}
              placeholder="Roman Catholic"
              maxLength={80}
            />
          </Field>
        </div>
      </Section>

      {/* Contact Information */}
      <Section title="Contact Information">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
          <Field label="Contact Number" error={errors.contact_number} half>
            <input
              style={s(!!errors.contact_number)}
              value={form.contact_number}
              onChange={e => set('contact_number', e.target.value.replace(/[^0-9+\s]/g, ''))}
              onKeyDown={onKeyDownNumeric}
              onBlur={e => setFieldError('contact_number', validateContactNumber(e.target.value))}
              onFocus={e => onFocus(e, !!errors.contact_number)}
              placeholder="09XXXXXXXXX"
              maxLength={13}
            />
          </Field>

          <Field label="Email Address" error={errors.email_address} half>
            <input
              style={s(!!errors.email_address)}
              type="email"
              value={form.email_address}
              onChange={e => set('email_address', e.target.value)}
              onBlur={e => setFieldError('email_address', validateEmail(e.target.value))}
              onFocus={e => onFocus(e, !!errors.email_address)}
              placeholder="juan@email.com"
              maxLength={150}
            />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section title="Address">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>

          <Field label="Purok" error={errors.purok_id} half>
            <select
              style={s(!!errors.purok_id)}
              value={form.purok_id}
              onChange={e => {
                set('purok_id', e.target.value)
                set('household_id', '')
                clearError('purok_id')
              }}
              onFocus={e => onFocus(e, !!errors.purok_id)}
              onBlur={e => onBlurBorder(e, !!errors.purok_id)}
            >
              <option value="">— Select Purok —</option>
              {puroks.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Household" half>
            <select
              style={s(false)}
              value={form.household_id}
              onChange={e => set('household_id', e.target.value)}
              disabled={!form.purok_id}
              onFocus={e => onFocus(e, false)}
              onBlur={e => onBlurBorder(e, false)}
            >
              <option value="">— Select Household —</option>
              {households.map(h => (
                <option key={h.id} value={h.id}>
                  {h.household_number}{h.street ? ' · ' + h.street : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Household Role" half>
            <select
              style={s(false)}
              value={form.household_role}
              onChange={e => set('household_role', e.target.value)}
              onFocus={e => onFocus(e, false)}
              onBlur={e => onBlurBorder(e, false)}
            >
              {HOUSEHOLD_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>

          <Field label="House Number" error={errors.house_number} half>
            <input
              style={s(!!errors.house_number)}
              value={form.house_number}
              onChange={e => set('house_number', sanitizeHouseNumber(e.target.value))}
              onBlur={e => setFieldError('house_number', validateHouseNumber(e.target.value))}
              onFocus={e => onFocus(e, !!errors.house_number)}
              placeholder="e.g. 101 or B-12"
              maxLength={20}
            />
          </Field>

          <Field label="Street" error={errors.street}>
            <input
              style={s(!!errors.street)}
              value={form.street}
              onChange={e => set('street', sanitizeStreet(e.target.value))}
              onBlur={e => setFieldError('street', validateStreet(e.target.value))}
              onFocus={e => onFocus(e, !!errors.street)}
              placeholder="Rizal Street"
              maxLength={100}
            />
          </Field>
        </div>
      </Section>

      {/* Socio-Economic */}
      <Section title="Socio-Economic Information">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>

          <Field label="Educational Attainment" half>
            <select
              style={s(false)}
              value={form.educational_attainment}
              onChange={e => set('educational_attainment', e.target.value)}
              onFocus={e => onFocus(e, false)}
              onBlur={e => onBlurBorder(e, false)}
            >
              <option value="">— Select —</option>
              {EDUCATIONAL_ATTAINMENTS.map(ea => (
                <option key={ea} value={ea}>{ea}</option>
              ))}
            </select>
          </Field>

          <Field label="Employment Status" half>
            <select
              style={s(false)}
              value={form.employment_status}
              onChange={e => set('employment_status', e.target.value)}
              onFocus={e => onFocus(e, false)}
              onBlur={e => onBlurBorder(e, false)}
            >
              <option value="">— Select —</option>
              {EMPLOYMENT_STATUSES.map(es => (
                <option key={es} value={es}>{es}</option>
              ))}
            </select>
          </Field>

          <Field label="Occupation" error={errors.occupation} half>
            <input
              style={s(!!errors.occupation)}
              value={form.occupation}
              onChange={e => set('occupation', sanitizeText(e.target.value))}
              onFocus={e => onFocus(e, !!errors.occupation)}
              onBlur={e => onBlurBorder(e, !!errors.occupation)}
              placeholder="Farmer, Teacher, etc."
              maxLength={100}
            />
          </Field>

          <Field label="Monthly Income (₱)" error={errors.monthly_income} half>
            <input
              style={s(!!errors.monthly_income)}
              type="number"
              min="0"
              step="0.01"
              value={form.monthly_income}
              onChange={e => set('monthly_income', e.target.value)}
              onKeyDown={onKeyDownNumeric}
              onBlur={e => setFieldError('monthly_income', validateIncome(e.target.value))}
              onFocus={e => onFocus(e, !!errors.monthly_income)}
              placeholder="0.00"
            />
          </Field>
        </div>
      </Section>

      {/* Government IDs */}
      <Section title="Government IDs">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
          {[
            { label: 'Voter ID Number', field: 'voter_id_number' },
            { label: 'PhilSys Number', field: 'philsys_number' },
            { label: 'SSS Number', field: 'sss_number' },
            { label: 'PhilHealth Number', field: 'philhealth_number' },
            { label: 'Pag-IBIG Number', field: 'pagibig_number' },
            { label: 'TIN Number', field: 'tin_number' },
          ].map(({ label, field }) => (
            <Field key={field} label={label} error={errors[field]} half>
              <input
                style={s(!!errors[field])}
                value={(form as any)[field]}
                onChange={e => set(field, sanitizeText(e.target.value))}
                onFocus={e => onFocus(e, !!errors[field])}
                onBlur={e => onBlurBorder(e, !!errors[field])}
                maxLength={30}
              />
            </Field>
          ))}
        </div>
      </Section>

      {/* Classifications */}
      <Section title="Classifications & Special Categories">
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' as const }}>
          <div style={{ minWidth: 200 }}>
            {[
              { field: 'is_voter', label: 'Registered Voter' },
              { field: 'is_indigent', label: 'Indigent' },
              { field: 'is_4ps_beneficiary', label: '4Ps Beneficiary' },
              { field: 'is_ofw', label: 'OFW (Overseas Filipino Worker)' },
            ].map(({ field, label }) => (
              <label key={field} style={{
                display: 'flex', alignItems: 'center',
                gap: 8, fontSize: 14, color: '#374151',
                cursor: 'pointer', marginBottom: 10
              }}>
                <input
                  type="checkbox"
                  checked={(form as any)[field]}
                  onChange={e => set(field, e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#e8820c' }}
                />
                {label}
              </label>
            ))}
          </div>

          <div style={{ minWidth: 200, flex: 1 }}>
            <label style={{
              display: 'flex', alignItems: 'center',
              gap: 8, fontSize: 14, color: '#374151',
              cursor: 'pointer', marginBottom: 10
            }}>
              <input type="checkbox" checked={form.is_pwd}
                onChange={e => set('is_pwd', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#e8820c' }} />
              Person with Disability (PWD)
            </label>
            {form.is_pwd && (
              <div style={{ marginLeft: 24, marginBottom: 12, display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                <Field label="PWD ID Number" error={errors.pwd_id_number} half>
                  <input style={s(!!errors.pwd_id_number)} value={form.pwd_id_number}
                    onChange={e => set('pwd_id_number', sanitizeText(e.target.value))}
                    onFocus={e => onFocus(e, !!errors.pwd_id_number)}
                    onBlur={e => onBlurBorder(e, !!errors.pwd_id_number)} maxLength={30} />
                </Field>
                <Field label="Type of Disability" error={errors.pwd_disability_type} half>
                  <input style={s(!!errors.pwd_disability_type)} value={form.pwd_disability_type}
                    onChange={e => set('pwd_disability_type', sanitizeText(e.target.value))}
                    onFocus={e => onFocus(e, !!errors.pwd_disability_type)}
                    onBlur={e => onBlurBorder(e, !!errors.pwd_disability_type)}
                    placeholder="Visual, Hearing, Physical..." maxLength={80} />
                </Field>
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center',
              gap: 8, fontSize: 14, color: '#374151',
              cursor: 'pointer', marginBottom: 10
            }}>
              <input type="checkbox" checked={form.is_senior_citizen}
                onChange={e => set('is_senior_citizen', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#e8820c' }} />
              Senior Citizen
            </label>
            {form.is_senior_citizen && (
              <div style={{ marginLeft: 24, marginBottom: 12 }}>
                <Field label="Senior Citizen ID" error={errors.senior_citizen_id} half>
                  <input style={s(!!errors.senior_citizen_id)} value={form.senior_citizen_id}
                    onChange={e => set('senior_citizen_id', sanitizeText(e.target.value))}
                    onFocus={e => onFocus(e, !!errors.senior_citizen_id)}
                    onBlur={e => onBlurBorder(e, !!errors.senior_citizen_id)} maxLength={30} />
                </Field>
              </div>
            )}

            <label style={{
              display: 'flex', alignItems: 'center',
              gap: 8, fontSize: 14, color: '#374151',
              cursor: 'pointer', marginBottom: 10
            }}>
              <input type="checkbox" checked={form.is_solo_parent}
                onChange={e => set('is_solo_parent', e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#e8820c' }} />
              Solo Parent
            </label>
            {form.is_solo_parent && (
              <div style={{ marginLeft: 24, marginBottom: 12 }}>
                <Field label="Solo Parent ID" error={errors.solo_parent_id} half>
                  <input style={s(!!errors.solo_parent_id)} value={form.solo_parent_id}
                    onChange={e => set('solo_parent_id', sanitizeText(e.target.value))}
                    onFocus={e => onFocus(e, !!errors.solo_parent_id)}
                    onBlur={e => onBlurBorder(e, !!errors.solo_parent_id)} maxLength={30} />
                </Field>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Remarks */}
      <Section title="Remarks">
        <Field label="Additional Notes" error={errors.remarks}>
          <textarea
            style={{ ...s(!!errors.remarks), minHeight: 80, resize: 'vertical' as const }}
            value={form.remarks}
            onChange={e => set('remarks', sanitizeText(e.target.value))}
            onBlur={e => setFieldError('remarks', validateRemarks(e.target.value))}
            onFocus={e => onFocus(e as any, !!errors.remarks)}
            placeholder="Additional notes..."
            maxLength={500}
          />
          <div style={{ textAlign: 'right' as const, fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {form.remarks.length}/500
          </div>
        </Field>
      </Section>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 32 }}>
        <Link href={`/dashboard/residents/${id}`} style={{
          padding: '10px 20px', borderRadius: 8,
          border: '1px solid #e2e8f0', background: 'white',
          color: '#64748b', textDecoration: 'none', fontSize: 14
        }}>
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 24px', borderRadius: 8,
            background: saving
              ? '#f0a050'
              : 'linear-gradient(135deg, #f4a020, #c96008)',
            color: 'white', border: 'none',
            fontSize: 14, fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saving ? 'none' : '0 2px 8px rgba(232,130,12,0.3)'
          }}
        >
          {saving ? <Loader2 size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}