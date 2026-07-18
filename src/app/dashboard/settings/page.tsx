'use client'

import { useSettings } from '@/lib/settings-context'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Settings, Save, Loader2, Upload,
  CheckCircle, AlertCircle, Plus
} from 'lucide-react'
import type {
  BarangaySettings, DocumentType,
  Purok, IncidentType
} from '@/lib/types'
import styles from './styles/settings.module.css'

const DOC_TYPES: DocumentType[] = [
  'Barangay Clearance',
  'Certificate of Residency',
  'Certificate of Indigency',
  'Certificate of Good Moral Character',
  'Certificate of No Income',
  'First-Time Jobseeker Certificate',
  'Business Clearance',
]

export default function SettingsPage() {
  const supabase = createClient()
  const brgyLogoRef = useRef<HTMLInputElement>(null)
  const cityLogoRef = useRef<HTMLInputElement>(null)

  const { refresh: refreshSettings } = useSettings()

  const [userRole, setUserRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [savingDocs, setSavingDocs] = useState(false)
  const [addingPurok, setAddingPurok] = useState(false)
  const [addingIncident, setAddingIncident] = useState(false)
  const [uploadingBrgyLogo, setUploadingBrgyLogo] = useState(false)
  const [uploadingCityLogo, setUploadingCityLogo] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [settingsId, setSettingsId] = useState('')

  const [settings, setSettings] = useState<Partial<BarangaySettings>>({
    barangay_name: '',
    city: '',
    province: '',
    region: '',
    zip_code: '',
    contact_number: '',
    email_address: '',
    logo_path: null,
    city_logo_path: null,
    show_or_number: true,
  })

  const [docSettings, setDocSettings] = useState<Record<DocumentType, {
    fee: number
    validity_months: number
    is_active: boolean
  }>>({} as any)

  const [brgyLogoPreview, setBrgyLogoPreview] = useState('')
  const [cityLogoPreview, setCityLogoPreview] = useState('')
  const [puroks, setPuroks] = useState<Purok[]>([])
  const [newPurokName, setNewPurokName] = useState('')
  const [newPurokDesc, setNewPurokDesc] = useState('')
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([])
  const [newIncidentName, setNewIncidentName] = useState('')
  // User Management
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
  const [userFormError, setUserFormError] = useState('')
  const [userFormSuccess, setUserFormSuccess] = useState('')
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'encoder',
  })
  
  useEffect(() => {
  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    
    let currentRole = ''
    
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles').select('role')
        .eq('id', user.id).single()
      if (profile) {
        setUserRole(profile.role)
        currentRole = profile.role
      }
    }

    const [{ data: s }, { data: d }, { data: p }, { data: inc }] =
      await Promise.all([
        supabase.from('barangay_settings').select('*').single(),
        supabase.from('document_type_settings').select('*'),
        supabase.from('puroks').select('*').order('name'),
        supabase.from('incident_types').select('*').order('name'),
      ])

    if (s) {
      setSettings(s)
      setSettingsId(s.id)
      if (s.logo_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('barangay-assets').getPublicUrl(s.logo_path)
        setBrgyLogoPreview(publicUrl)
      }
      if (s.city_logo_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('barangay-assets').getPublicUrl(s.city_logo_path)
        setCityLogoPreview(publicUrl)
      }
    }

    if (d) {
      const map: any = {}
      d.forEach((dt: any) => { map[dt.document_type] = dt })
      setDocSettings(map)
    }

    if (p) setPuroks(p)
    if (inc) setIncidentTypes(inc)

    // Load users if admin — use currentRole not profile?.role
    if (['super_admin', 'captain'].includes(currentRole)) {
      setLoadingUsers(true)
      const usersRes = await fetch('/api/users')
      const usersData = await usersRes.json()
      if (usersData.users) setUsers(usersData.users)
      setLoadingUsers(false)
    }
  }
  load()
}, [])


  const canEdit = ['super_admin', 'captain'].includes(userRole)

  function showSuccess(msg: string) {
    setSuccessMsg(msg)
    setErrorMsg('')
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  function showError(msg: string) {
    setErrorMsg(msg)
    setSuccessMsg('')
    setTimeout(() => setErrorMsg(''), 6000)
  }

  async function handleLogoUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'barangay' | 'city'
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      showError('Logo must be PNG, JPG, or WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showError('Logo must be 5MB or less.')
      return
    }

    if (type === 'barangay') setUploadingBrgyLogo(true)
    else setUploadingCityLogo(true)

    const fieldName = type === 'barangay' ? 'logo_path' : 'city_logo_path'
    const fileName = type === 'barangay'
      ? `barangay_logo.${file.name.split('.').pop()}`
      : `city_logo.${file.name.split('.').pop()}`

    const existingPath = settings[fieldName as keyof typeof settings] as string | null
    if (existingPath) {
      await supabase.storage.from('barangay-assets').remove([existingPath])
    }

    const { data, error } = await supabase.storage
      .from('barangay-assets')
      .upload(fileName, file, { upsert: true, contentType: file.type })

    if (error) {
      showError('Error uploading logo: ' + error.message)
      if (type === 'barangay') setUploadingBrgyLogo(false)
      else setUploadingCityLogo(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('barangay-assets').getPublicUrl(data.path)

    const previewUrl = publicUrl + '?t=' + Date.now()

    if (type === 'barangay') {
      setBrgyLogoPreview(previewUrl)
      setSettings(prev => ({ ...prev, logo_path: data.path }))
      setUploadingBrgyLogo(false)
    } else {
      setCityLogoPreview(previewUrl)
      setSettings(prev => ({ ...prev, city_logo_path: data.path }))
      setUploadingCityLogo(false)
    }

    await supabase.from('barangay_settings')
      .update({ [fieldName]: data.path })
      .eq('id', settingsId)

    showSuccess(
      `${type === 'barangay' ? 'Barangay' : 'City'} logo uploaded successfully!`
    )
    refreshSettings()
  }

  async function saveBarangayInfo() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('barangay_settings')
      .update({
        barangay_name: settings.barangay_name,
        city: settings.city,
        province: settings.province,
        region: settings.region,
        zip_code: settings.zip_code || null,
        contact_number: settings.contact_number || null,
        email_address: settings.email_address || null,
        show_or_number: settings.show_or_number,
        updated_by: user?.id,
      })
      .eq('id', settingsId)

    if (error) {
      showError('Error saving: ' + error.message)
    } else {
      showSuccess('Barangay information saved!')
      refreshSettings()
      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_name: user?.email,
        action: 'UPDATE',
        table_name: 'barangay_settings',
        notes: 'Barangay settings updated',
      })
    }
    setSaving(false)
  }

  async function saveDocumentSettings() {
    setSavingDocs(true)
    const { data: { user } } = await supabase.auth.getUser()

    const updates = DOC_TYPES.map(dt => ({
      document_type: dt,
      fee: docSettings[dt]?.fee ?? 0,
      validity_months: docSettings[dt]?.validity_months ?? 6,
      is_active: docSettings[dt]?.is_active ?? true,
      updated_by: user?.id,
    }))

    const { error } = await supabase
      .from('document_type_settings')
      .upsert(updates, { onConflict: 'document_type' })

    if (error) showError('Error saving document settings: ' + error.message)
    else showSuccess('Document settings saved!')

    setSavingDocs(false)
  }

  async function handleAddPurok() {
    if (!newPurokName.trim()) {
      showError('Purok name is required.')
      return
    }
    const duplicate = puroks.find(
      p => p.name.toLowerCase() === newPurokName.trim().toLowerCase()
    )
    if (duplicate) {
      showError(`Purok "${newPurokName.trim()}" already exists.`)
      return
    }

    setAddingPurok(true)
    const { data, error } = await supabase
      .from('puroks')
      .insert({
        name: newPurokName.trim(),
        description: newPurokDesc.trim() || null,
        is_active: true
      })
      .select().single()

    if (error) {
      showError('Error adding purok: ' + error.message)
    } else {
      setPuroks(prev =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      )
      setNewPurokName('')
      setNewPurokDesc('')
      showSuccess(`${data.name} added successfully!`)
    }
    setAddingPurok(false)
  }

  async function togglePurokActive(purok: Purok) {
    const newStatus = !purok.is_active

    if (!newStatus) {
      const { count } = await supabase
        .from('residents')
        .select('id', { count: 'exact' })
        .eq('purok_id', purok.id)
        .eq('is_deceased', false)
        .eq('is_transferred', false)

      if ((count ?? 0) > 0) {
        showError(
          `Cannot deactivate ${purok.name} — it has ${count} active ` +
          `resident${count !== 1 ? 's' : ''} linked to it.`
        )
        return
      }
    }

    const { error } = await supabase
      .from('puroks')
      .update({ is_active: newStatus })
      .eq('id', purok.id)

    if (error) {
      showError('Error updating purok: ' + error.message)
    } else {
      setPuroks(prev => prev.map(p =>
        p.id === purok.id ? { ...p, is_active: newStatus } : p
      ))
      showSuccess(`${purok.name} ${newStatus ? 'activated' : 'deactivated'}.`)
    }
  }

  async function handleAddIncidentType() {
    if (!newIncidentName.trim()) {
      showError('Incident type name is required.')
      return
    }
    const duplicate = incidentTypes.find(
      t => t.name.toLowerCase() === newIncidentName.trim().toLowerCase()
    )
    if (duplicate) {
      showError(`"${newIncidentName.trim()}" already exists.`)
      return
    }
    setAddingIncident(true)
    const { data, error } = await supabase
      .from('incident_types')
      .insert({ name: newIncidentName.trim(), is_active: true })
      .select().single()

    if (error) {
      showError('Error adding: ' + error.message)
    } else {
      setIncidentTypes(prev =>
        [...prev, data].sort((a, b) => a.name.localeCompare(b.name))
      )
      setNewIncidentName('')
      showSuccess(`"${data.name}" added!`)
    }
    setAddingIncident(false)
  }

  async function toggleIncidentType(type: IncidentType) {
    const { error } = await supabase
      .from('incident_types')
      .update({ is_active: !type.is_active })
      .eq('id', type.id)

    if (error) {
      showError('Error updating: ' + error.message)
    } else {
      setIncidentTypes(prev => prev.map(t =>
        t.id === type.id
          ? { ...t, is_active: !type.is_active }
          : t
      ))
      showSuccess(
        `"${type.name}" ${!type.is_active ? 'activated' : 'deactivated'}.`
      )
    }
  }

  async function loadUsers() {
  setLoadingUsers(true)
  const res = await fetch('/api/users')
  const data = await res.json()
  if (data.users) setUsers(data.users)
  setLoadingUsers(false)
}

async function handleCreateUser() {
  setUserFormError('')
  if (!newUser.full_name.trim()) {
    setUserFormError('Full name is required.')
    return
  }
  if (!newUser.email.trim()) {
    setUserFormError('Email is required.')
    return
  }
  if (!newUser.password || newUser.password.length < 8) {
    setUserFormError('Password must be at least 8 characters.')
    return
  }

  setSavingUser(true)
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newUser),
  })
  const data = await res.json()

  if (data.error) {
    setUserFormError(data.error)
    setSavingUser(false)
    return
  }

  setUserFormSuccess(
    `User ${newUser.full_name} created successfully!`
  )
  setNewUser({
    full_name: '', email: '',
    password: '', role: 'encoder'
  })
  setShowUserForm(false)
  loadUsers()
  setSavingUser(false)
  setTimeout(() => setUserFormSuccess(''), 4000)
}

async function handleToggleUserActive(
  userId: string,
  currentStatus: boolean,
  userName: string
) {
  const newStatus = !currentStatus
  const confirmed = window.confirm(
    `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${userName}?` +
    (newStatus ? '' : ' They will be immediately blocked from logging in.')
  )
  if (!confirmed) return

  const res = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: newStatus }),
  })
  const data = await res.json()

  if (data.error) {
    showError(data.error)
    return
  }

  showSuccess(
    `${userName} has been ${newStatus ? 'activated' : 'deactivated'}.`
  )
  await loadUsers()
}

async function handleUpdateRole(userId: string, newRole: string) {
  const res = await fetch(`/api/users/${userId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: newRole }),
  })
  const data = await res.json()

  if (data.error) {
    showError(data.error)
    return
  }

  showSuccess('Role updated successfully!')
  await loadUsers()
}

async function handleResetPassword(
  userId: string,
  userName: string
) {
  const confirmed = window.confirm(
    `Send password reset email to ${userName}?`
  )
  if (!confirmed) return

  const res = await fetch(
    `/api/users/${userId}/reset-password`,
    { method: 'POST' }
  )
  const data = await res.json()

  if (data.error) {
    showError(data.error)
    return
  }

  showSuccess(
    `Password reset email sent to ${data.email}`
  )
}

 async function handleDeleteUser(
  userId: string,
  userName: string
) {
  const confirmed = window.confirm(
    `Are you sure you want to permanently delete ${userName}? This cannot be undone.`
  )
  if (!confirmed) return

  const res = await fetch(`/api/users/${userId}`, {
    method: 'DELETE'
  })
  const data = await res.json()

  if (data.error) {
    showError(data.error)
    return
  }

  showSuccess(`${userName} has been deleted.`)
  await loadUsers()
}

  function setDoc(type: DocumentType, field: string, value: any) {
    setDocSettings(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }))
  }

  function setSetting(field: string, value: any) {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  function LogoUploadBox({
    label, preview, uploading,
    inputRef, fieldType, note
  }: {
    label: string
    preview: string
    uploading: boolean
    inputRef: React.RefObject<HTMLInputElement | null>
    fieldType: 'barangay' | 'city'
    note: string
  }) {
    return (
      <div className={styles.fieldHalf}>
        <label className={styles.fieldLabel}>{label}</label>
        <div className={styles.logoSection}>
          <div className={styles.logoPreview}>
            {preview ? (
              <img
                src={preview}
                alt={label}
                className={styles.logoPreviewImg}
              />
            ) : (
              <p className={styles.logoPlaceholder}>No logo</p>
            )}
          </div>
          <div className={styles.logoActions}>
            {canEdit && (
              <label className={styles.logoUploadLabel}>
                {uploading
                  ? <><Loader2 size={14} /> Uploading...</>
                  : <><Upload size={14} />
                    {preview ? 'Replace' : 'Upload'}
                  </>
                }
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={e => handleLogoUpload(e, fieldType)}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            )}
            <p className={styles.logoNote}>{note}</p>
          </div>
        </div>
      </div>
    )
  }

  function PurokTable() {
    return (
      <div style={{
        border: '1px solid #e8e6df',
        borderRadius: 10, overflow: 'hidden'
      }}>
        {puroks.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center',
            color: '#94a3b8', fontSize: 14
          }}>
            No puroks registered yet.
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse' as const
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(to bottom, #fffbf5, #faf8f3)',
                borderBottom: '1px solid #f1f0eb'
              }}>
                {['Purok Name', 'Description', 'Status',
                  ...(canEdit ? ['Action'] : [])
                ].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px',
                    textAlign: h === 'Status' || h === 'Action'
                      ? 'center' as const : 'left' as const,
                    fontSize: 11, fontWeight: 600,
                    color: '#a09880',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {puroks.map((p, i) => (
                <tr key={p.id} style={{
                  borderBottom: i < puroks.length - 1
                    ? '1px solid #f8f7f3' : 'none',
                  opacity: p.is_active ? 1 : 0.6
                }}>
                  <td style={{
                    padding: '12px 16px', fontSize: 14,
                    fontWeight: 500, color: '#0f172a'
                  }}>
                    {p.name}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    fontSize: 13, color: '#64748b'
                  }}>
                    {p.description ?? '—'}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    textAlign: 'center' as const
                  }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: 12, fontWeight: 500,
                      background: p.is_active ? '#f0fdf4' : '#f8fafc',
                      color: p.is_active ? '#16a34a' : '#64748b',
                      border: `1px solid ${p.is_active ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit && (
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center' as const
                    }}>
                      <button
                        onClick={() => togglePurokActive(p)}
                        style={{
                          padding: '5px 14px', borderRadius: 7,
                          fontSize: 12, cursor: 'pointer',
                          border: `1px solid ${p.is_active ? '#fecaca' : '#bbf7d0'}`,
                          background: 'white',
                          color: p.is_active ? '#dc2626' : '#16a34a',
                          transition: 'all 0.15s'
                        }}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  function IncidentTypeTable() {
    return (
      <div style={{
        border: '1px solid #e8e6df',
        borderRadius: 10, overflow: 'hidden'
      }}>
        {incidentTypes.length === 0 ? (
          <div style={{
            padding: 32, textAlign: 'center',
            color: '#94a3b8', fontSize: 14
          }}>
            No incident types found.
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse' as const
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(to bottom, #fffbf5, #faf8f3)',
                borderBottom: '1px solid #f1f0eb'
              }}>
                {['Incident Type', 'Status',
                  ...(canEdit ? ['Action'] : [])
                ].map(h => (
                  <th key={h} style={{
                    padding: '11px 16px',
                    textAlign: h === 'Status' || h === 'Action'
                      ? 'center' as const : 'left' as const,
                    fontSize: 11, fontWeight: 600,
                    color: '#a09880',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.05em'
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidentTypes.map((t, i) => (
                <tr key={t.id} style={{
                  borderBottom: i < incidentTypes.length - 1
                    ? '1px solid #f8f7f3' : 'none',
                  opacity: t.is_active ? 1 : 0.6
                }}>
                  <td style={{
                    padding: '12px 16px', fontSize: 14,
                    fontWeight: 500, color: '#0f172a'
                  }}>
                    {t.name}
                  </td>
                  <td style={{
                    padding: '12px 16px',
                    textAlign: 'center' as const
                  }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: 12, fontWeight: 500,
                      background: t.is_active ? '#f0fdf4' : '#f8fafc',
                      color: t.is_active ? '#16a34a' : '#64748b',
                      border: `1px solid ${t.is_active ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canEdit && (
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'center' as const
                    }}>
                      <button
                        onClick={() => toggleIncidentType(t)}
                        style={{
                          padding: '5px 14px', borderRadius: 7,
                          fontSize: 12, cursor: 'pointer',
                          border: `1px solid ${t.is_active ? '#fecaca' : '#bbf7d0'}`,
                          background: 'white',
                          color: t.is_active ? '#dc2626' : '#16a34a',
                          transition: 'all 0.15s'
                        }}
                      >
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerIcon}>
          <Settings size={22} color="white" />
        </div>
        <div>
          <h1 className={styles.headerTitle}>Settings</h1>
          <p className={styles.headerSubtitle}>
            System configuration
          </p>
        </div>
      </div>

      {successMsg && (
        <div className={styles.successBanner}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {!canEdit && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} />
          Only the Barangay Captain and Super Admin can edit settings.
        </div>
      )}

      {/* ── Barangay Information ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Barangay Information</h2>
        </div>
        <div className={styles.sectionBody}>

          <div className={styles.fieldRow} style={{ marginBottom: 20 }}>
            <LogoUploadBox
              label="Barangay Logo (left side of documents)"
              preview={brgyLogoPreview}
              uploading={uploadingBrgyLogo}
              inputRef={brgyLogoRef}
              fieldType="barangay"
              note="Left side of printed certificates. PNG, JPG or WebP. Max 5MB."
            />
            <LogoUploadBox
              label="City / Municipal Logo (right side of documents)"
              preview={cityLogoPreview}
              uploading={uploadingCityLogo}
              inputRef={cityLogoRef}
              fieldType="city"
              note="Right side of printed certificates. PNG, JPG or WebP. Max 5MB."
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>
                Barangay Name
              </label>
              <input
                className={styles.input}
                value={settings.barangay_name ?? ''}
                onChange={e =>
                  setSetting('barangay_name', e.target.value)
                }
                disabled={!canEdit}
                placeholder="Barangay IV"
              />
            </div>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>
                City / Municipality
              </label>
              <input
                className={styles.input}
                value={settings.city ?? ''}
                onChange={e => setSetting('city', e.target.value)}
                disabled={!canEdit}
                placeholder="Tangub City"
              />
            </div>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>Province</label>
              <input
                className={styles.input}
                value={settings.province ?? ''}
                onChange={e =>
                  setSetting('province', e.target.value)
                }
                disabled={!canEdit}
                placeholder="Misamis Occidental"
              />
            </div>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>Region</label>
              <input
                className={styles.input}
                value={settings.region ?? ''}
                onChange={e =>
                  setSetting('region', e.target.value)
                }
                disabled={!canEdit}
                placeholder="Region X"
              />
            </div>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>ZIP Code</label>
              <input
                className={styles.input}
                value={settings.zip_code ?? ''}
                onChange={e =>
                  setSetting('zip_code', e.target.value)
                }
                disabled={!canEdit}
                placeholder="7214"
                maxLength={10}
              />
            </div>
            <div className={styles.fieldHalf}>
              <label className={styles.fieldLabel}>
                Contact Number
              </label>
              <input
                className={styles.input}
                value={settings.contact_number ?? ''}
                onChange={e =>
                  setSetting('contact_number', e.target.value)
                }
                disabled={!canEdit}
                placeholder="09XXXXXXXXX"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                Email Address
              </label>
              <input
                className={styles.input}
                type="email"
                value={settings.email_address ?? ''}
                onChange={e =>
                  setSetting('email_address', e.target.value)
                }
                disabled={!canEdit}
                placeholder="barangay@email.com"
              />
            </div>
          </div>

          {/* OR Number Toggle */}
          <div style={{
            borderTop: '1px solid #f1f0eb',
            paddingTop: 16, marginTop: 4
          }}>
            <div className={styles.toggleRow}>
              <div>
                <p className={styles.toggleLabel}>
                  Show OR Number on printed documents
                </p>
                <p className={styles.toggleDesc}>
                  When enabled, the OR number appears on the
                  printed certificate
                </p>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.show_or_number ?? true}
                  onChange={e =>
                    setSetting('show_or_number', e.target.checked)
                  }
                  disabled={!canEdit}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          </div>

          {canEdit && (
            <div className={styles.saveRow}>
              <button
                onClick={saveBarangayInfo}
                disabled={saving}
                className={`${styles.saveButton} ${saving ? styles.saveButtonDisabled : ''}`}
              >
                {saving ? <Loader2 size={16} /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save Barangay Info'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Purok Management ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Purok Management</h2>
        </div>
        <div className={styles.sectionBody}>
          {canEdit && (
            <div style={{
              background: '#fffbf5',
              border: '1px solid #fed7aa',
              borderRadius: 10, padding: 16, marginBottom: 20
            }}>
              <p style={{
                fontSize: 13, fontWeight: 500,
                color: '#c2410c', margin: '0 0 12px'
              }}>
                Add New Purok
              </p>
              <div style={{
                display: 'flex', gap: 10,
                flexWrap: 'wrap' as const
              }}>
                <input
                  className={styles.input}
                  value={newPurokName}
                  onChange={e => setNewPurokName(e.target.value)}
                  onKeyDown={e =>
                    e.key === 'Enter' && handleAddPurok()
                  }
                  placeholder="Purok name (e.g. Purok 7)"
                  maxLength={80}
                  style={{ flex: 1, minWidth: 200 }}
                />
                <input
                  className={styles.input}
                  value={newPurokDesc}
                  onChange={e => setNewPurokDesc(e.target.value)}
                  placeholder="Description (optional)"
                  maxLength={150}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <button
                  onClick={handleAddPurok}
                  disabled={addingPurok || !newPurokName.trim()}
                  className={`${styles.saveButton} ${(addingPurok || !newPurokName.trim()) ? styles.saveButtonDisabled : ''}`}
                  style={{ whiteSpace: 'nowrap' as const }}
                >
                  {addingPurok
                    ? <Loader2 size={15} />
                    : <Plus size={15} />
                  }
                  {addingPurok ? 'Adding...' : 'Add Purok'}
                </button>
              </div>
            </div>
          )}

          <PurokTable />

          <p style={{
            fontSize: 12, color: '#94a3b8',
            margin: '10px 0 0', lineHeight: 1.5
          }}>
            Puroks cannot be renamed or deleted to preserve data
            integrity. Deactivated puroks will not appear in
            resident registration forms.
          </p>
        </div>
      </div>

      {/* ── Incident Types ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Incident Types</h2>
        </div>
        <div className={styles.sectionBody}>
          {canEdit && (
            <div style={{
              background: '#fffbf5',
              border: '1px solid #fed7aa',
              borderRadius: 10, padding: 16, marginBottom: 20
            }}>
              <p style={{
                fontSize: 13, fontWeight: 500,
                color: '#c2410c', margin: '0 0 12px'
              }}>
                Add New Incident Type
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className={styles.input}
                  value={newIncidentName}
                  onChange={e => setNewIncidentName(e.target.value)}
                  onKeyDown={e =>
                    e.key === 'Enter' && handleAddIncidentType()
                  }
                  placeholder="e.g. Illegal Parking, Boundary Dispute"
                  maxLength={100}
                  style={{ flex: 1 }}
                />
                <button
                  onClick={handleAddIncidentType}
                  disabled={
                    addingIncident || !newIncidentName.trim()
                  }
                  className={`${styles.saveButton} ${(addingIncident || !newIncidentName.trim()) ? styles.saveButtonDisabled : ''}`}
                >
                  {addingIncident
                    ? <Loader2 size={15} />
                    : <Plus size={15} />
                  }
                  {addingIncident ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}

          <IncidentTypeTable />

          <p style={{
            fontSize: 12, color: '#94a3b8',
            margin: '10px 0 0', lineHeight: 1.5
          }}>
            Deactivated incident types will not appear in the
            blotter filing form.
          </p>
        </div>
      </div>

      {/* ── User Management ── */}
        {canEdit && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>User Management</h2>
            </div>
            <div className={styles.sectionBody}>

              {/* Success/Error for user form */}
              {userFormSuccess && (
                <div className={styles.successBanner}
                  style={{ marginBottom: 16 }}>
                  <CheckCircle size={16} /> {userFormSuccess}
                </div>
              )}
              {userFormError && (
                <div className={styles.errorBanner}
                  style={{ marginBottom: 16 }}>
                  <AlertCircle size={16} /> {userFormError}
                </div>
              )}

              {/* Add User Button */}
              {!showUserForm && (
                <button
                  onClick={() => setShowUserForm(true)}
                  className={styles.saveButton}
                  style={{ marginBottom: 20 }}
                >
                  <Plus size={15} /> Add New User
                </button>
              )}

              {/* New User Form */}
              {showUserForm && (
                <div style={{
                  background: '#fffbf5',
                  border: '1px solid #fed7aa',
                  borderRadius: 10, padding: 16,
                  marginBottom: 20
                }}>
                  <p style={{
                    fontSize: 13, fontWeight: 500,
                    color: '#c2410c', margin: '0 0 14px'
                  }}>
                    Create New User Account
                  </p>

                  <div className={styles.fieldRow}>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Full Name <span className={styles.fieldRequired}>*</span>
                      </label>
                      <input
                        className={styles.input}
                        value={newUser.full_name}
                        onChange={e => setNewUser(prev => ({
                          ...prev, full_name: e.target.value
                        }))}
                        placeholder="Juan dela Cruz"
                      />
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Email Address <span className={styles.fieldRequired}>*</span>
                      </label>
                      <input
                        className={styles.input}
                        type="email"
                        value={newUser.email}
                        onChange={e => setNewUser(prev => ({
                          ...prev, email: e.target.value
                        }))}
                        placeholder="juan@email.com"
                      />
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Password <span className={styles.fieldRequired}>*</span>
                      </label>
                      <input
                        className={styles.input}
                        type="password"
                        value={newUser.password}
                        onChange={e => setNewUser(prev => ({
                          ...prev, password: e.target.value
                        }))}
                        placeholder="Min. 8 characters"
                      />
                    </div>
                    <div className={styles.fieldHalf}>
                      <label className={styles.fieldLabel}>
                        Role <span className={styles.fieldRequired}>*</span>
                      </label>
                      <select
                        className={styles.select}
                        value={newUser.role}
                        onChange={e => setNewUser(prev => ({
                          ...prev, role: e.target.value
                        }))}
                      >
                        <option value="captain">Captain</option>
                        <option value="secretary">Secretary</option>
                        <option value="treasurer">Treasurer</option>
                        <option value="kagawad">Kagawad</option>
                        <option value="sk_official">SK Official</option>
                        <option value="tanod">Tanod</option>
                        <option value="encoder">Encoder</option>
                        <option value="qa">QA (Read Only)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', gap: 10,
                    justifyContent: 'flex-end', marginTop: 8
                  }}>
                    <button
                      onClick={() => {
                        setShowUserForm(false)
                        setUserFormError('')
                        setNewUser({
                          full_name: '', email: '',
                          password: '', role: 'encoder'
                        })
                      }}
                      className={styles.cancelButton}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateUser}
                      disabled={savingUser}
                      className={`${styles.saveButton} ${savingUser ? styles.saveButtonDisabled : ''}`}
                    >
                      {savingUser
                        ? <><Loader2 size={15} /> Creating...</>
                        : <><Plus size={15} /> Create User</>
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* Users Table */}
              {loadingUsers ? (
                <div style={{
                  padding: 32, textAlign: 'center',
                  color: '#94a3b8', fontSize: 14
                }}>
                  Loading users...
                </div>
              ) : (
                <div style={{
                  border: '1px solid #e8e6df',
                  borderRadius: 10, overflow: 'hidden'
                }}>
                  {users.length === 0 ? (
                    <div style={{
                      padding: 32, textAlign: 'center',
                      color: '#94a3b8', fontSize: 14
                    }}>
                      No users found.
                    </div>
                  ) : (
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse' as const
                    }}>
                      <thead>
                        <tr style={{
                          background: 'linear-gradient(to bottom, #fffbf5, #faf8f3)',
                          borderBottom: '1px solid #f1f0eb'
                        }}>
                          {['Name', 'Email', 'Role', 'Status', 'Actions'].map(h => (
                            <th key={h} style={{
                              padding: '11px 14px',
                              textAlign: 'left' as const,
                              fontSize: 11, fontWeight: 600,
                              color: '#a09880',
                              textTransform: 'uppercase' as const,
                              letterSpacing: '0.05em',
                              whiteSpace: 'nowrap' as const
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u, i) => (
                          <tr key={u.id} style={{
                            borderBottom: i < users.length - 1
                              ? '1px solid #f8f7f3' : 'none',
                            opacity: u.is_active ? 1 : 0.6,
                            background: u.is_active ? 'white' : '#fafafa'
                          }}>
                            <td style={{
                              padding: '12px 14px',
                              fontSize: 14, fontWeight: 500,
                              color: '#0f172a'
                            }}>
                              {u.full_name ?? '—'}
                            </td>
                            <td style={{
                              padding: '12px 14px',
                              fontSize: 13, color: '#64748b'
                            }}>
                              {u.email ?? '—'}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <select
                                value={u.role}
                                onChange={e =>
                                  handleUpdateRole(u.id, e.target.value)
                                }
                                style={{
                                  padding: '5px 8px',
                                  border: '1px solid #e2e0d9',
                                  borderRadius: 6, fontSize: 12,
                                  color: '#374151', background: 'white',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="super_admin">Super Admin</option>
                                <option value="captain">Captain</option>
                                <option value="secretary">Secretary</option>
                                <option value="treasurer">Treasurer</option>
                                <option value="kagawad">Kagawad</option>
                                <option value="sk_official">SK Official</option>
                                <option value="tanod">Tanod</option>
                                <option value="encoder">Encoder</option>
                                <option value="qa">QA</option>
                              </select>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{
                                padding: '3px 10px', borderRadius: 20,
                                fontSize: 12, fontWeight: 500,
                                background: u.is_active
                                  ? '#f0fdf4' : '#fef2f2',
                                color: u.is_active
                                  ? '#16a34a' : '#dc2626',
                                border: `1px solid ${u.is_active ? '#bbf7d0' : '#fecaca'}`
                              }}>
                                {u.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{
                                display: 'flex', gap: 6,
                                flexWrap: 'wrap' as const
                              }}>
                                {/* Toggle Active */}
                                <button
                                  onClick={() => handleToggleUserActive(
                                    u.id, u.is_active, u.full_name
                                  )}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: 6, fontSize: 11,
                                    cursor: 'pointer',
                                    border: `1px solid ${u.is_active ? '#fecaca' : '#bbf7d0'}`,
                                    background: 'white',
                                    color: u.is_active
                                      ? '#dc2626' : '#16a34a',
                                  }}
                                >
                                  {u.is_active ? 'Deactivate' : 'Activate'}
                                </button>

                                {/* Reset Password */}
                                <button
                                  onClick={() => handleResetPassword(
                                    u.id, u.full_name
                                  )}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: 6, fontSize: 11,
                                    cursor: 'pointer',
                                    border: '1px solid #bfdbfe',
                                    background: 'white',
                                    color: '#1d4ed8',
                                  }}
                                >
                                  Reset Password
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => handleDeleteUser(
                                    u.id, u.full_name
                                  )}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: 6, fontSize: 11,
                                    cursor: 'pointer',
                                    border: '1px solid #fecaca',
                                    background: 'white',
                                    color: '#dc2626',
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <p style={{
                fontSize: 12, color: '#94a3b8',
                margin: '10px 0 0', lineHeight: 1.5
              }}>
                Deactivated users are immediately blocked from logging in.
                Password reset sends an email with a reset link.
              </p>
            </div>
          </div>
        )}
        


      {/* ── Document Fees & Validity ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Document Fees & Validity
          </h2>
        </div>
        <div style={{ overflowX: 'auto' as const }}>
          <table className={styles.docTable}>
            <thead className={styles.docTableHead}>
              <tr>
                <th style={{ width: '42%' }}>Document Type</th>
                <th style={{
                  width: '18%',
                  textAlign: 'right' as const
                }}>
                  Fee (₱)
                </th>
                <th style={{
                  width: '22%',
                  textAlign: 'right' as const
                }}>
                  Validity (months)
                </th>
                <th style={{
                  width: '18%',
                  textAlign: 'center' as const
                }}>
                  Active
                </th>
              </tr>
            </thead>
            <tbody>
              {DOC_TYPES.map(dt => {
                const ds = docSettings[dt]
                const isFreePolicy = [
                  'First-Time Jobseeker Certificate',
                  'Certificate of Indigency',
                  'Certificate of No Income'
                ].includes(dt)
                return (
                  <tr key={dt} className={styles.docTableRow}>
                    <td className={styles.docTableCell}>
                      <span className={styles.docTypeName}>
                        {dt}
                      </span>
                      {isFreePolicy && (
                        <span className={styles.docTypeFree}>
                          Free by policy
                        </span>
                      )}
                    </td>
                    <td
                      className={styles.docTableCell}
                      style={{ textAlign: 'right' as const }}
                    >
                      <input
                        type="number"
                        min="0"
                        step="0.50"
                        className={styles.feeInput}
                        value={ds?.fee ?? 0}
                        onChange={e => setDoc(dt, 'fee',
                          parseFloat(e.target.value) || 0)}
                        disabled={!canEdit}
                      />
                    </td>
                    <td
                      className={styles.docTableCell}
                      style={{ textAlign: 'right' as const }}
                    >
                      <input
                        type="number"
                        min="1"
                        max="60"
                        className={styles.validityInput}
                        value={ds?.validity_months ?? 6}
                        onChange={e => setDoc(dt, 'validity_months',
                          parseInt(e.target.value) || 6)}
                        disabled={!canEdit}
                      />
                    </td>
                    <td
                      className={styles.docTableCell}
                      style={{ textAlign: 'center' as const }}
                    >
                      <label className={styles.toggle}>
                        <input
                          type="checkbox"
                          checked={ds?.is_active ?? true}
                          onChange={e => setDoc(dt, 'is_active',
                            e.target.checked)}
                          disabled={!canEdit}
                        />
                        <span className={styles.toggleSlider} />
                      </label>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div
            className={styles.sectionBody}
            style={{ paddingTop: 12 }}
          >
            <div className={styles.saveRow}>
              <button
                onClick={saveDocumentSettings}
                disabled={savingDocs}
                className={`${styles.saveButton} ${savingDocs ? styles.saveButtonDisabled : ''}`}
              >
                {savingDocs
                  ? <Loader2 size={16} />
                  : <Save size={16} />
                }
                {savingDocs ? 'Saving...' : 'Save Document Settings'}
              </button>
            </div>
          </div>
        )}
      </div>



    </div>
  )
}