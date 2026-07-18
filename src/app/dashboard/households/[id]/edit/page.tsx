'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2,
  AlertCircle, AlertTriangle, Info
} from 'lucide-react'
import {
  sanitizeText, sanitizeHouseNumber,
  sanitizeStreet, validateHouseholdForm,
  validateHouseNumber, validateStreet,
  validateRemarks, type FieldErrors
} from '@/lib/validation'
import type { Purok, HouseholdStatus } from '@/lib/types'

const DWELLING_TYPES = [
  'Owned - Fully Paid', 'Owned - With Mortgage', 'Rented',
  'Shared / Living with Relatives', 'Informal Settler',
  'Government Housing', 'Other',
]
const WATER_SOURCES = [
  'Tap Water (MWSS / Local Waterworks)', 'Deep Well (Private)',
  'Deep Well (Shared / Community)', 'Spring / River',
  'Bottled / Delivered Water', 'Other',
]
const TOILET_FACILITIES = [
  'Water-sealed (Private)', 'Water-sealed (Shared)',
  'Open Pit', 'None',
]

const STATUS_OPTIONS: HouseholdStatus[] = [
  'Active', 'Vacant', 'Demolished', 'Transferred', 'Condemned'
]

const STATUS_COLORS: Record<HouseholdStatus, { bg: string, color: string, border: string }> = {
  Active:      { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  Vacant:      { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' },
  Demolished:  { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  Transferred: { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
  Condemned:   { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
}

// ── Sub-components ──────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
      <AlertCircle size={12} color="#dc2626" />
      <span style={{ fontSize: 12, color: '#dc2626' }}>{message}</span>
    </div>
  )
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12,
      border: '1px solid #e2e8f0', marginBottom: 16, overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #f1f5f9',
        background: '#fffbf5'
      }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#c2410c' }}>
          {title}
        </h2>
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

// ── Main Page ───────────────────────────────────────────────

export default function EditHouseholdPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [puroks, setPuroks] = useState<Purok[]>([])
  const [memberCount, setMemberCount] = useState(0)
  const [originalPurokId, setOriginalPurokId] = useState('')
  const [showPurokWarning, setShowPurokWarning] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState('')

  const [form, setForm] = useState({
    purok_id: '',
    house_number: '',
    street: '',
    dwelling_type: '',
    water_source: '',
    toilet_facility: '',
    is_4ps_beneficiary: false,
    status: 'Active' as HouseholdStatus,
    transferred_to: '',
    status_remarks: '',
    remarks: '',
  })

  // Load household data
  useEffect(() => {
    async function load() {
      const [{ data: hh }, { data: puroksData }] = await Promise.all([
        supabase.from('households').select('*').eq('id', id).single(),
        supabase.from('puroks').select('*').order('name'),
      ])

      if (!hh) { setNotFound(true); setLoading(false); return }

      setPuroks(puroksData ?? [])
      setOriginalPurokId(hh.purok_id ?? '')

      setForm({
        purok_id: hh.purok_id ?? '',
        house_number: hh.house_number ?? '',
        street: hh.street ?? '',
        dwelling_type: hh.dwelling_type ?? '',
        water_source: hh.water_source ?? '',
        toilet_facility: hh.toilet_facility ?? '',
        is_4ps_beneficiary: hh.is_4ps_beneficiary ?? false,
        status: hh.status ?? 'Active',
        transferred_to: hh.transferred_to ?? '',
        status_remarks: hh.status_remarks ?? '',
        remarks: hh.remarks ?? '',
      })

      // Get member count
      const { count } = await supabase
        .from('residents')
        .select('id', { count: 'exact' })
        .eq('household_id', id)
        .eq('is_deceased', false)
        .eq('is_transferred', false)

      setMemberCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, [id])

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
    }
  }

  function setFieldError(field: string, message: string) {
    if (message) setErrors(prev => ({ ...prev, [field]: message }))
    else setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
  }

  function onFocus(e: React.FocusEvent<any>, hasError: boolean) {
    if (!hasError) e.target.style.borderColor = '#e8820c'
  }

  function onBlurBorder(e: React.FocusEvent<any>, hasError: boolean) {
    if (!hasError) e.target.style.borderColor = '#e2e8f0'
  }

  // Purok change warning
  function handlePurokChange(newPurokId: string) {
    set('purok_id', newPurokId)
    if (newPurokId !== originalPurokId && memberCount > 0) {
      setShowPurokWarning(true)
    } else {
      setShowPurokWarning(false)
    }
  }

  // Duplicate household check
  async function checkDuplicateHousehold() {
    if (!form.house_number.trim() || !form.street.trim() || !form.purok_id) {
      setDuplicateWarning('')
      return
    }
    const { data } = await supabase
      .from('households')
      .select('id, household_number')
      .eq('purok_id', form.purok_id)
      .ilike('house_number', form.house_number.trim())
      .ilike('street', form.street.trim())
      .neq('id', id)

    if (data && data.length > 0) {
      setDuplicateWarning(
        `A household at this address already exists: ${data[0].household_number}`
      )
    } else {
      setDuplicateWarning('')
    }
  }

  async function handleSave() {
    setSubmitError('')

    const formErrors = validateHouseholdForm(form)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      setSubmitError('Please fix the errors below before saving.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Validate transferred_to if status is Transferred
    if (form.status === 'Transferred' && !form.transferred_to.trim()) {
      setErrors(prev => ({
        ...prev,
        transferred_to: 'Please specify where the household transferred to.'
      }))
      setSubmitError('Please fix the errors below before saving.')
      return
    }

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateError } = await supabase
      .from('households')
      .update({
        purok_id: form.purok_id || null,
        house_number: form.house_number.trim() || null,
        street: form.street.trim() || null,
        dwelling_type: form.dwelling_type || null,
        water_source: form.water_source || null,
        toilet_facility: form.toilet_facility || null,
        is_4ps_beneficiary: form.is_4ps_beneficiary,
        status: form.status,
        transferred_to: form.status === 'Transferred'
          ? form.transferred_to.trim() : null,
        status_remarks: form.status_remarks.trim() || null,
        status_changed_at: new Date().toISOString(),
        status_changed_by: user?.id ?? null,
        remarks: form.remarks.trim() || null,
      })
      .eq('id', id)

    if (updateError) {
      setSubmitError('Error updating household: ' + updateError.message)
      setSaving(false)
      return
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'UPDATE',
      table_name: 'households',
      record_id: id as string,
      notes: `Household updated. Status: ${form.status}`,
    })

    router.push(`/dashboard/households/${id}`)
  }

  const s = getInputStyle
  const statusColor = STATUS_COLORS[form.status]

  if (loading) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      Loading household data...
    </div>
  )

  if (notFound) return (
    <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>
      Household not found.{' '}
      <Link href="/dashboard/households" style={{ color: '#e8820c' }}>Back</Link>
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href={`/dashboard/households/${id}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          border: '1px solid #e2e8f0', background: 'white',
          color: '#64748b', textDecoration: 'none'
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Edit Household
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Barangay IV, Tangub City —{' '}
            <span style={{ color: '#e8820c' }}>*</span> required fields
          </p>
        </div>
      </div>

      {/* Submit error */}
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

      {/* Purok change warning */}
      {showPurokWarning && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: '#fffbeb', border: '1px solid #fcd34d',
          display: 'flex', gap: 10
        }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: '#92400e' }}>
              Purok changed — action required
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
              This household has {memberCount} active resident{memberCount !== 1 ? 's' : ''}.
              Changing the purok here does NOT automatically update their individual
              purok assignment. Please update each resident's purok separately
              after saving this household.
            </p>
          </div>
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div style={{
          padding: '12px 16px', borderRadius: 8, marginBottom: 16,
          background: '#fffbeb', border: '1px solid #fcd34d',
          display: 'flex', gap: 10
        }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 500, color: '#92400e' }}>
              Possible duplicate household
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#b45309' }}>
              {duplicateWarning}. Please verify before saving.
            </p>
          </div>
        </div>
      )}

      {/* Location */}
      <Section title="Location">
        <Field label="Purok" required error={errors.purok_id}>
          <select
            style={s(!!errors.purok_id)}
            value={form.purok_id}
            onChange={e => handlePurokChange(e.target.value)}
            onFocus={e => onFocus(e, !!errors.purok_id)}
            onBlur={e => onBlurBorder(e, !!errors.purok_id)}
          >
            <option value="">— Select Purok —</option>
            {puroks.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <Field label="House Number" error={errors.house_number}>
              <input
                style={s(!!errors.house_number)}
                value={form.house_number}
                onChange={e => set('house_number', sanitizeHouseNumber(e.target.value))}
                onBlur={async e => {
                  setFieldError('house_number', validateHouseNumber(e.target.value))
                  await checkDuplicateHousehold()
                }}
                onFocus={e => onFocus(e, !!errors.house_number)}
                placeholder="e.g. 101 or B-12"
                maxLength={20}
              />
            </Field>
          </div>
          <div style={{ flex: 2 }}>
            <Field label="Street / Sitio Name" error={errors.street}>
              <input
                style={s(!!errors.street)}
                value={form.street}
                onChange={e => set('street', sanitizeStreet(e.target.value))}
                onBlur={async e => {
                  setFieldError('street', validateStreet(e.target.value))
                  await checkDuplicateHousehold()
                }}
                onFocus={e => onFocus(e, !!errors.street)}
                placeholder="e.g. Rizal Street"
                maxLength={100}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* Housing Details */}
      <Section title="Housing Details">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Dwelling Type">
              <select
                style={s(false)}
                value={form.dwelling_type}
                onChange={e => set('dwelling_type', e.target.value)}
                onFocus={e => onFocus(e, false)}
                onBlur={e => onBlurBorder(e, false)}
              >
                <option value="">— Select —</option>
                {DWELLING_TYPES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Water Source">
              <select
                style={s(false)}
                value={form.water_source}
                onChange={e => set('water_source', e.target.value)}
                onFocus={e => onFocus(e, false)}
                onBlur={e => onBlurBorder(e, false)}
              >
                <option value="">— Select —</option>
                {WATER_SOURCES.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Toilet Facility">
              <select
                style={s(false)}
                value={form.toilet_facility}
                onChange={e => set('toilet_facility', e.target.value)}
                onFocus={e => onFocus(e, false)}
                onBlur={e => onBlurBorder(e, false)}
              >
                <option value="">— Select —</option>
                {TOILET_FACILITIES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>
      </Section>

      {/* Household Status */}
      <Section title="Household Status">

        <Field label="Status" required error={errors.status}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
            {STATUS_OPTIONS.map(status => {
              const sc = STATUS_COLORS[status]
              const isSelected = form.status === status
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => set('status', status)}
                  style={{
                    padding: '7px 16px', borderRadius: 20,
                    fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: `2px solid ${isSelected ? sc.color : '#e2e8f0'}`,
                    background: isSelected ? sc.bg : 'white',
                    color: isSelected ? sc.color : '#94a3b8',
                  }}
                >
                  {status}
                </button>
              )
            })}
          </div>
        </Field>

        {/* Status-specific warnings */}
        {form.status === 'Vacant' && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: '#fefce8', border: '1px solid #fde68a',
            display: 'flex', gap: 8
          }}>
            <Info size={15} color="#ca8a04" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#854d0e' }}>
              Marking as Vacant means no one currently lives here.
              Residents linked to this household should be updated or transferred.
            </p>
          </div>
        )}

        {form.status === 'Demolished' && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: '#fef2f2', border: '1px solid #fecaca',
            display: 'flex', gap: 8
          }}>
            <AlertTriangle size={15} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>
              Marking as Demolished is permanent. Please ensure all residents
              linked to this household have been transferred or updated.
            </p>
          </div>
        )}

        {form.status === 'Condemned' && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: '#fff7ed', border: '1px solid #fed7aa',
            display: 'flex', gap: 8
          }}>
            <AlertTriangle size={15} color="#c2410c" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ margin: 0, fontSize: 13, color: '#9a3412' }}>
              Condemned households are considered unsafe for habitation.
              Residents should be relocated immediately.
            </p>
          </div>
        )}

        {/* Transferred to field */}
        {form.status === 'Transferred' && (
          <Field
            label="Transferred To"
            required
            error={errors.transferred_to}
          >
            <input
              style={s(!!errors.transferred_to)}
              value={form.transferred_to}
              onChange={e => set('transferred_to', sanitizeText(e.target.value))}
              onFocus={e => onFocus(e, !!errors.transferred_to)}
              onBlur={e => {
                if (!e.target.value.trim()) {
                  setErrors(prev => ({
                    ...prev,
                    transferred_to: 'Please specify where the household transferred to.'
                  }))
                } else {
                  setErrors(prev => {
                    const er = { ...prev }
                    delete er.transferred_to
                    return er
                  })
                }
                onBlurBorder(e, !!errors.transferred_to)
              }}
              placeholder="e.g. Purok 3, Barangay IV or Barangay Haba, Tangub City"
              maxLength={200}
            />
          </Field>
        )}

        {/* Status remarks */}
        <Field label="Status Remarks" error={errors.status_remarks}>
          <input
            style={s(!!errors.status_remarks)}
            value={form.status_remarks}
            onChange={e => set('status_remarks', sanitizeText(e.target.value))}
            onFocus={e => onFocus(e, !!errors.status_remarks)}
            onBlur={e => onBlurBorder(e, !!errors.status_remarks)}
            placeholder="Optional — reason for status change, date of change, etc."
            maxLength={200}
          />
        </Field>
      </Section>

      {/* Social Programs */}
      <Section title="Social Programs">
        <label style={{
          display: 'flex', alignItems: 'flex-start',
          gap: 10, cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={form.is_4ps_beneficiary}
            onChange={e => set('is_4ps_beneficiary', e.target.checked)}
            style={{ marginTop: 2, width: 16, height: 16, accentColor: '#e8820c' }}
          />
          <div>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              4Ps Beneficiary
            </span>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>
              Pantawid Pamilyang Pilipino Program — household receives conditional cash transfer
            </p>
          </div>
        </label>
      </Section>

      {/* General Remarks */}
      <Section title="General Remarks">
        <Field label="Additional Notes" error={errors.remarks}>
          <textarea
            style={{
              ...s(!!errors.remarks),
              minHeight: 80, resize: 'vertical' as const
            }}
            value={form.remarks}
            onChange={e => set('remarks', sanitizeText(e.target.value))}
            onBlur={e => setFieldError('remarks', validateRemarks(e.target.value))}
            onFocus={e => onFocus(e as any, !!errors.remarks)}
            placeholder="Optional notes about this household..."
            maxLength={500}
          />
          <div style={{ textAlign: 'right' as const, fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {form.remarks.length}/500
          </div>
        </Field>
      </Section>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 32 }}>
        <Link href={`/dashboard/households/${id}`} style={{
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