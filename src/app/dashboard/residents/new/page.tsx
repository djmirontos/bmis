'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import type { Purok, Household } from '@/lib/types'
import {
  sanitizeName, sanitizeText, sanitizeStreet,
  sanitizeHouseNumber,
  validateName, validateContactNumber, validateEmail,
  validateDateOfBirth, validateHouseNumber, validateStreet,
  validateIncome, validateRemarks,
  validateResidentForm,
  checkDuplicateResident,
  type FieldErrors
} from '@/lib/validation'
import styles from '../styles/form.module.css'

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

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div className={styles.fieldError}>
      <AlertCircle size={12} color="#dc2626" />
      <span className={styles.fieldErrorText}>{message}</span>
    </div>
  )
}

function DuplicateWarning({ matches }: { matches: any[] }) {
  if (!matches.length) return null
  return (
    <div className={styles.warningBanner}>
      <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <p className={styles.warningBannerTitle}>Possible duplicate detected</p>
        {matches.map(m => (
          <p key={m.id} className={styles.warningBannerText}>
            {m.last_name}, {m.first_name} {m.middle_name ?? ''} —
            Born {new Date(m.date_of_birth).toLocaleDateString('en-PH')}
          </p>
        ))}
        <p className={styles.warningBannerText} style={{ marginTop: 4 }}>
          You can still save if this is a different person. Please double-check.
        </p>
      </div>
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

function Field({ label, required, error, half, children }: {
  label: string, required?: boolean,
  error?: string, half?: boolean, children: React.ReactNode
}) {
  return (
    <div className={half ? styles.fieldHalf : styles.field}>
      <label className={styles.fieldLabel}>
        {label} {required && <span className={styles.fieldRequired}>*</span>}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  )
}

function NewResidentPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillHouseholdId = searchParams.get('household_id') ?? ''
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
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
    purok_id: '', household_id: prefillHouseholdId,
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

  useEffect(() => {
  supabase
    .from('puroks')
    .select('*')
    .eq('is_active', true)
    .order('name')
    .then(({ data }) => setPuroks(data ?? []))
}, [])

useEffect(() => {
  if (!form.purok_id) {
    setHouseholds([])
    return
  }

  supabase
    .from('households')
    .select('*')
    .eq('purok_id', form.purok_id)
    .order('household_number')
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
    const { matches } = await checkDuplicateResident(supabase, last, first, dob)
    setDuplicates(matches)
  }

  function onKeyDownName(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = /^[a-zA-ZÀ-ÿñÑ\s\-'\.]/
    const controlKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!controlKeys.includes(e.key) && !allowed.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
  }

  function onKeyDownNumeric(e: React.KeyboardEvent<HTMLInputElement>) {
    const allowed = /^[0-9.]/
    const controlKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!controlKeys.includes(e.key) && !allowed.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
    }
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
      ...form,
      last_name: form.last_name.trim().toUpperCase(),
      first_name: form.first_name.trim(),
      middle_name: form.middle_name.trim() || null,
      suffix: form.suffix || null,
      place_of_birth: form.place_of_birth.trim() || null,
      religion: form.religion.trim() || null,
      contact_number: form.contact_number.trim() || null,
      email_address: form.email_address.trim() || null,
      purok_id: form.purok_id || null,
      household_id: form.household_id || null,
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
      pwd_id_number: form.pwd_id_number.trim() || null,
      pwd_disability_type: form.pwd_disability_type.trim() || null,
      senior_citizen_id: form.senior_citizen_id.trim() || null,
      solo_parent_id: form.solo_parent_id.trim() || null,
      remarks: form.remarks.trim() || null,
      household_role: form.household_role || null,
      created_by: user?.id ?? null,
    }

    const { data, error: insertError } = await supabase
      .from('residents').insert(payload).select('id').single()

    if (insertError) {
      setSubmitError('Error saving resident: ' + insertError.message)
      setSaving(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'INSERT',
      table_name: 'residents',
      record_id: data.id,
      notes: `New resident registered: ${payload.last_name}, ${payload.first_name}`,
    })

    router.push(`/dashboard/residents/${data.id}`)
  }

  function inputClass(hasError?: boolean) {
    return `${styles.input} ${hasError ? styles.inputError : ''}`
  }

  function selectClass(hasError?: boolean) {
    return `${styles.select} ${hasError ? styles.selectError : ''}`
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <Link href="/dashboard/residents" className={styles.backButton}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className={styles.pageTitle}>Register New Resident</h1>
          <p className={styles.pageSubtitle}>
            Barangay IV, Tangub City — Fields marked{' '}
            <span className={styles.fieldRequired}>*</span> are required
          </p>
        </div>
      </div>

      {submitError && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} /> {submitError}
        </div>
      )}

      {duplicates.length > 0 && <DuplicateWarning matches={duplicates} />}

      {/* Personal Information */}
      <Section title="Personal Information">
        <div className={styles.fieldRow}>
          <Field label="Last Name" required error={errors.last_name} half>
            <input
              className={inputClass(!!errors.last_name)}
              value={form.last_name}
              onChange={e => set('last_name', sanitizeName(e.target.value).toUpperCase())}
              onKeyDown={onKeyDownName}
              onBlur={e => onBlurName('last_name', e.target.value, 'Last name', true)}
              placeholder="DELA CRUZ"
              maxLength={100}
            />
          </Field>
          <Field label="First Name" required error={errors.first_name} half>
            <input
              className={inputClass(!!errors.first_name)}
              value={form.first_name}
              onChange={e => set('first_name', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              onBlur={e => onBlurName('first_name', e.target.value, 'First name', true)}
              placeholder="Juan"
              maxLength={100}
            />
          </Field>
          <Field label="Middle Name" error={errors.middle_name} half>
            <input
              className={inputClass(!!errors.middle_name)}
              value={form.middle_name}
              onChange={e => set('middle_name', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              onBlur={e => onBlurName('middle_name', e.target.value, 'Middle name')}
              placeholder="Santos"
              maxLength={100}
            />
          </Field>
          <Field label="Suffix" half>
            <select
              className={selectClass()}
              value={form.suffix}
              onChange={e => set('suffix', e.target.value)}
            >
              {SUFFIXES.map(s => (
                <option key={s} value={s}>{s || '— None —'}</option>
              ))}
            </select>
          </Field>
          <Field label="Date of Birth" required error={errors.date_of_birth} half>
            <input
              className={inputClass(!!errors.date_of_birth)}
              type="date"
              value={form.date_of_birth}
              max={TODAY}
              onChange={e => set('date_of_birth', e.target.value)}
              onBlur={e => onBlurDob(e.target.value)}
            />
          </Field>
          <Field label="Place of Birth" half>
            <input
              className={inputClass()}
              value={form.place_of_birth}
              onChange={e => set('place_of_birth', sanitizeText(e.target.value))}
              placeholder="Tangub City"
              maxLength={100}
            />
          </Field>
          <Field label="Sex" required error={errors.sex} half>
            <select
              className={selectClass(!!errors.sex)}
              value={form.sex}
              onChange={e => { set('sex', e.target.value); clearError('sex') }}
            >
              <option value="">— Select —</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </Field>
          <Field label="Civil Status" required error={errors.civil_status} half>
            <select
              className={selectClass(!!errors.civil_status)}
              value={form.civil_status}
              onChange={e => { set('civil_status', e.target.value); clearError('civil_status') }}
            >
              {CIVIL_STATUSES.map(cs => (
                <option key={cs} value={cs}>{cs}</option>
              ))}
            </select>
          </Field>
          <Field label="Nationality" half>
            <input
              className={inputClass()}
              value={form.nationality}
              onChange={e => set('nationality', sanitizeName(e.target.value))}
              onKeyDown={onKeyDownName}
              maxLength={50}
            />
          </Field>
          <Field label="Religion" half>
            <input
              className={inputClass()}
              value={form.religion}
              onChange={e => set('religion', sanitizeText(e.target.value))}
              placeholder="Roman Catholic"
              maxLength={80}
            />
          </Field>
        </div>
      </Section>

      {/* Contact */}
      <Section title="Contact Information">
        <div className={styles.fieldRow}>
          <Field label="Contact Number" error={errors.contact_number} half>
            <input
              className={inputClass(!!errors.contact_number)}
              value={form.contact_number}
              onChange={e => set('contact_number', e.target.value.replace(/[^0-9+\s]/g, ''))}
              onKeyDown={onKeyDownNumeric}
              onBlur={e => setFieldError('contact_number', validateContactNumber(e.target.value))}
              placeholder="09XXXXXXXXX"
              maxLength={13}
            />
          </Field>
          <Field label="Email Address" error={errors.email_address} half>
            <input
              className={inputClass(!!errors.email_address)}
              type="email"
              value={form.email_address}
              onChange={e => set('email_address', e.target.value)}
              onBlur={e => setFieldError('email_address', validateEmail(e.target.value))}
              placeholder="juan@email.com"
              maxLength={150}
            />
          </Field>
        </div>
      </Section>

      {/* Address */}
      <Section title="Address">
        <div className={styles.fieldRow}>
          <Field label="Purok" half>
            <select
              className={selectClass()}
              value={form.purok_id}
              onChange={e => { set('purok_id', e.target.value); set('household_id', '') }}
            >
              <option value="">— Select Purok —</option>
              {puroks.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Household" half>
            <select
              className={selectClass()}
              value={form.household_id}
              onChange={e => set('household_id', e.target.value)}
              disabled={!form.purok_id}
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
              className={selectClass()}
              value={form.household_role}
              onChange={e => set('household_role', e.target.value)}
            >
              {HOUSEHOLD_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="House Number" error={errors.house_number} half>
            <input
              className={inputClass(!!errors.house_number)}
              value={form.house_number}
              onChange={e => set('house_number', sanitizeHouseNumber(e.target.value))}
              onBlur={e => setFieldError('house_number', validateHouseNumber(e.target.value))}
              placeholder="e.g. 101 or B-12"
              maxLength={20}
            />
          </Field>
          <Field label="Street" error={errors.street}>
            <input
              className={inputClass(!!errors.street)}
              value={form.street}
              onChange={e => set('street', sanitizeStreet(e.target.value))}
              onBlur={e => setFieldError('street', validateStreet(e.target.value))}
              placeholder="Rizal Street"
              maxLength={100}
            />
          </Field>
        </div>
      </Section>

      {/* Socio-Economic */}
      <Section title="Socio-Economic Information">
        <div className={styles.fieldRow}>
          <Field label="Educational Attainment" half>
            <select className={selectClass()} value={form.educational_attainment}
              onChange={e => set('educational_attainment', e.target.value)}>
              <option value="">— Select —</option>
              {EDUCATIONAL_ATTAINMENTS.map(ea => (
                <option key={ea} value={ea}>{ea}</option>
              ))}
            </select>
          </Field>
          <Field label="Employment Status" half>
            <select className={selectClass()} value={form.employment_status}
              onChange={e => set('employment_status', e.target.value)}>
              <option value="">— Select —</option>
              {EMPLOYMENT_STATUSES.map(es => (
                <option key={es} value={es}>{es}</option>
              ))}
            </select>
          </Field>
          <Field label="Occupation" error={errors.occupation} half>
            <input className={inputClass(!!errors.occupation)} value={form.occupation}
              onChange={e => set('occupation', sanitizeText(e.target.value))}
              placeholder="Farmer, Teacher, etc." maxLength={100} />
          </Field>
          <Field label="Monthly Income (₱)" error={errors.monthly_income} half>
            <input className={inputClass(!!errors.monthly_income)}
              type="number" min="0" step="0.01" value={form.monthly_income}
              onChange={e => set('monthly_income', e.target.value)}
              onKeyDown={onKeyDownNumeric}
              onBlur={e => setFieldError('monthly_income', validateIncome(e.target.value))}
              placeholder="0.00" />
          </Field>
        </div>
      </Section>

      {/* Government IDs */}
      <Section title="Government IDs">
        <div className={styles.fieldRow}>
          {[
            { label: 'Voter ID Number', field: 'voter_id_number' },
            { label: 'PhilSys Number', field: 'philsys_number' },
            { label: 'SSS Number', field: 'sss_number' },
            { label: 'PhilHealth Number', field: 'philhealth_number' },
            { label: 'Pag-IBIG Number', field: 'pagibig_number' },
            { label: 'TIN Number', field: 'tin_number' },
          ].map(({ label, field }) => (
            <Field key={field} label={label} half>
              <input className={inputClass()} value={(form as any)[field]}
                onChange={e => set(field, sanitizeText(e.target.value))} maxLength={30} />
            </Field>
          ))}
        </div>
      </Section>

      {/* Classifications */}
      <Section title="Classifications & Special Categories">
        <div className={styles.fieldRow}>
          <div style={{ minWidth: 200 }}>
            {[
              { field: 'is_voter', label: 'Registered Voter' },
              { field: 'is_indigent', label: 'Indigent' },
              { field: 'is_4ps_beneficiary', label: '4Ps Beneficiary' },
              { field: 'is_ofw', label: 'OFW' },
            ].map(({ field, label }) => (
              <label key={field} className={styles.checkboxLabel}>
                <input type="checkbox" className={styles.checkbox}
                  checked={(form as any)[field]}
                  onChange={e => set(field, e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
          <div style={{ minWidth: 200, flex: 1 }}>
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className={styles.checkbox}
                checked={form.is_pwd}
                onChange={e => set('is_pwd', e.target.checked)} />
              Person with Disability (PWD)
            </label>
            {form.is_pwd && (
              <div style={{ marginLeft: 24, marginBottom: 8 }}>
                <Field label="PWD ID Number" half>
                  <input className={inputClass()} value={form.pwd_id_number}
                    onChange={e => set('pwd_id_number', sanitizeText(e.target.value))} maxLength={30} />
                </Field>
                <Field label="Type of Disability" half>
                  <input className={inputClass()} value={form.pwd_disability_type}
                    onChange={e => set('pwd_disability_type', sanitizeText(e.target.value))}
                    placeholder="Visual, Hearing, Physical..." maxLength={80} />
                </Field>
              </div>
            )}
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className={styles.checkbox}
                checked={form.is_senior_citizen}
                onChange={e => set('is_senior_citizen', e.target.checked)} />
              Senior Citizen
            </label>
            {form.is_senior_citizen && (
              <div style={{ marginLeft: 24, marginBottom: 8 }}>
                <Field label="Senior Citizen ID" half>
                  <input className={inputClass()} value={form.senior_citizen_id}
                    onChange={e => set('senior_citizen_id', sanitizeText(e.target.value))} maxLength={30} />
                </Field>
              </div>
            )}
            <label className={styles.checkboxLabel}>
              <input type="checkbox" className={styles.checkbox}
                checked={form.is_solo_parent}
                onChange={e => set('is_solo_parent', e.target.checked)} />
              Solo Parent
            </label>
            {form.is_solo_parent && (
              <div style={{ marginLeft: 24, marginBottom: 8 }}>
                <Field label="Solo Parent ID" half>
                  <input className={inputClass()} value={form.solo_parent_id}
                    onChange={e => set('solo_parent_id', sanitizeText(e.target.value))} maxLength={30} />
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
            className={`${styles.textarea} ${errors.remarks ? styles.inputError : ''}`}
            value={form.remarks}
            onChange={e => set('remarks', sanitizeText(e.target.value))}
            onBlur={e => setFieldError('remarks', validateRemarks(e.target.value))}
            placeholder="Additional notes..."
            maxLength={500}
          />
          <div className={styles.charCount}>{form.remarks.length}/500</div>
        </Field>
      </Section>

      {/* Actions */}
      <div className={styles.actions}>
        <Link href="/dashboard/residents" className={styles.cancelButton}>
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${styles.saveButton} ${saving ? styles.saveButtonDisabled : ''}`}
        >
          {saving ? <Loader2 size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : 'Save Resident'}
        </button>
      </div>
    </div>
  )
}

import { Suspense } from 'react'
export default function NewResidentPage() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <NewResidentPageInner />
    </Suspense>
  )
}
