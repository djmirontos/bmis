'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, AlertCircle } from 'lucide-react'
import { sanitizeText, sanitizeHouseNumber } from '@/lib/validation'
import type { Purok } from '@/lib/types'

const DWELLING_TYPES = [
  'Owned - Fully Paid',
  'Owned - With Mortgage',
  'Rented',
  'Shared / Living with Relatives',
  'Informal Settler',
  'Government Housing',
  'Other',
]

const WATER_SOURCES = [
  'Tap Water (MWSS / Local Waterworks)',
  'Deep Well (Private)',
  'Deep Well (Shared / Community)',
  'Spring / River',
  'Bottled / Delivered Water',
  'Other',
]

const TOILET_FACILITIES = [
  'Water-sealed (Private)',
  'Water-sealed (Shared)',
  'Open Pit',
  'None',
]

type FormErrors = Record<string, string>

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
      <AlertCircle size={12} color="#dc2626" />
      <span style={{ fontSize: 12, color: '#dc2626' }}>{message}</span>
    </div>
  )
}

function Field({
  label, required, error, children
}: {
  label: string, required?: boolean,
  error?: string, children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 16 }}>
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

const inputStyle = (hasError?: boolean) => ({
  width: '100%', padding: '8px 12px',
  border: `1px solid ${hasError ? '#fca5a5' : '#e2e8f0'}`,
  borderRadius: 8, fontSize: 14, color: '#0f172a',
  outline: 'none', boxSizing: 'border-box' as const,
  background: hasError ? '#fff5f5' : 'white',
})

export default function NewHouseholdPage() {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [puroks, setPuroks] = useState<Purok[]>([])
  const [userRole, setUserRole] = useState('')

  const [form, setForm] = useState({
    purok_id: '',
    house_number: '',
    street: '',
    dwelling_type: '',
    water_source: '',
    toilet_facility: '',
    is_4ps_beneficiary: false,
    remarks: '',
  })

  useEffect(() => {
    supabase.from('puroks').select('*')
  .eq('is_active', true)
  .order('name')
  .then(({ data }) => setPuroks(data ?? []))

    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_profiles').select('role').eq('id', user.id).single()
      if (data) setUserRole(data.role)
    }
    getRole()
  }, [])

  // QA and read-only roles cannot access this page
  useEffect(() => {
    if (userRole && !['super_admin', 'captain', 'secretary', 'encoder', ''].includes(userRole)) {
      router.push('/dashboard/households')
    }
  }, [userRole])

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    // Clear error on change
    if (errors[field]) {
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e })
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {}

    if (!form.purok_id) {
      newErrors.purok_id = 'Please select a purok.'
    }
    if (form.house_number && !/^[a-zA-Z0-9\-\s]+$/.test(form.house_number)) {
      newErrors.house_number = 'House number can only contain letters, numbers, and hyphens.'
    }
    if (form.house_number && form.house_number.length > 20) {
      newErrors.house_number = 'House number must be 20 characters or less.'
    }
    if (form.street && form.street.length > 100) {
      newErrors.street = 'Street name must be 100 characters or less.'
    }
    if (form.street && /[<>{}]/.test(form.street)) {
      newErrors.street = 'Street name contains invalid characters.'
    }
    if (form.remarks && form.remarks.length > 500) {
      newErrors.remarks = `Remarks must be 500 characters or less. (${form.remarks.length}/500)`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    setSubmitError('')
    if (!validate()) return

    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('households')
      .insert({
        purok_id: form.purok_id,
        house_number: form.house_number.trim() || null,
        street: form.street.trim() || null,
        dwelling_type: form.dwelling_type || null,
        water_source: form.water_source || null,
        toilet_facility: form.toilet_facility || null,
        is_4ps_beneficiary: form.is_4ps_beneficiary,
        remarks: form.remarks.trim() || null,
      })
      .select('id')
      .single()

    if (error) {
      setSubmitError('Error saving household: ' + error.message)
      setSaving(false)
      return
    }

    // Log the action
    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'INSERT',
      table_name: 'households',
      record_id: data.id,
      notes: 'New household registered',
    })

    router.push(`/dashboard/households/${data.id}`)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Link href="/dashboard/households" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: 8,
          border: '1px solid #e2e8f0', background: 'white',
          color: '#64748b', textDecoration: 'none'
        }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#0f172a', margin: 0 }}>
            Add New Household
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            Barangay IV, Tangub City
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

      {/* Location */}
      <Section title="Location">
        <Field label="Purok" required error={errors.purok_id}>
          <select
            style={inputStyle(!!errors.purok_id)}
            value={form.purok_id}
            onChange={e => set('purok_id', e.target.value)}
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
                style={inputStyle(!!errors.house_number)}
                value={form.house_number}
                onChange={e => set('house_number', sanitizeHouseNumber(e.target.value))}
                placeholder="e.g. 101 or B-12"
                maxLength={20}
                onFocus={e => !errors.house_number && (e.target.style.borderColor = '#e8820c')}
                onBlur={e => !errors.house_number && (e.target.style.borderColor = '#e2e8f0')}
              />
            </Field>
          </div>
          <div style={{ flex: 2 }}>
            <Field label="Street / Sitio Name" error={errors.street}>
              <input
                style={inputStyle(!!errors.street)}
                value={form.street}
                onChange={e => set('street', sanitizeText(e.target.value))}
                placeholder="e.g. Rizal Street"
                maxLength={100}
                onFocus={e => !errors.street && (e.target.style.borderColor = '#e8820c')}
                onBlur={e => !errors.street && (e.target.style.borderColor = '#e2e8f0')}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* Housing Details */}
      <Section title="Housing Details">
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Dwelling Type" error={errors.dwelling_type}>
              <select
                style={inputStyle(!!errors.dwelling_type)}
                value={form.dwelling_type}
                onChange={e => set('dwelling_type', e.target.value)}
              >
                <option value="">— Select —</option>
                {DWELLING_TYPES.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Water Source" error={errors.water_source}>
              <select
                style={inputStyle(!!errors.water_source)}
                value={form.water_source}
                onChange={e => set('water_source', e.target.value)}
              >
                <option value="">— Select —</option>
                {WATER_SOURCES.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <Field label="Toilet Facility" error={errors.toilet_facility}>
              <select
                style={inputStyle(!!errors.toilet_facility)}
                value={form.toilet_facility}
                onChange={e => set('toilet_facility', e.target.value)}
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

      {/* Remarks */}
      <Section title="Remarks">
        <Field label="Additional Notes" error={errors.remarks}>
          <textarea
            style={{
              ...inputStyle(!!errors.remarks),
              minHeight: 80,
              resize: 'vertical' as const
            }}
            value={form.remarks}
            onChange={e => set('remarks', sanitizeText(e.target.value))}
            placeholder="Optional notes about this household..."
            maxLength={500}
            onFocus={e => !errors.remarks && (e.target.style.borderColor = '#e8820c')}
            onBlur={e => !errors.remarks && (e.target.style.borderColor = '#e2e8f0')}
          />
          <div style={{ textAlign: 'right' as const, fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
            {form.remarks.length}/500
          </div>
        </Field>
      </Section>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 32 }}>
        <Link href="/dashboard/households" style={{
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
          {saving ? 'Saving...' : 'Save Household'}
        </button>
      </div>
    </div>
  )
}