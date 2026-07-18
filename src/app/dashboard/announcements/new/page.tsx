'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2,
  AlertCircle, Upload, X, Image as ImageIcon
} from 'lucide-react'
import type { AnnouncementCategory, AnnouncementPriority } from '@/lib/types'
import styles from '../styles/announcements.module.css'

const CATEGORIES: AnnouncementCategory[] = [
  'General', 'Health', 'Safety', 'Events',
  'Emergency', 'Infrastructure', 'Social Services', 'Livelihood'
]

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

export default function NewAnnouncementPage() {
  const router = useRouter()
  const supabase = createClient()

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  const [form, setForm] = useState({
    title: '',
    category: 'General' as AnnouncementCategory,
    priority: 'Normal' as AnnouncementPriority,
    content: '',
    expiry_date: '',
    is_published: true,
  })

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const e = { ...prev }
        delete e[field]
        return e
      })
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setErrors(prev => ({
        ...prev,
        image: 'Image must be PNG, JPG or WebP.'
      }))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev,
        image: 'Image must be 10MB or less.'
      }))
      return
    }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setErrors(prev => { const e = { ...prev }; delete e.image; return e })
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview('')
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!form.title.trim())
      newErrors.title = 'Title is required.'
    if (!form.content.trim())
      newErrors.content = 'Content is required.'
    if (form.content.trim().length < 10)
      newErrors.content = 'Content must be at least 10 characters.'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    setSubmitError('')
    if (!validate()) {
      setSubmitError('Please fix the errors below.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('full_name, role')
      .eq('id', user!.id)
      .single()

    // Upload image if selected
    let imagePath: string | null = null
    if (imageFile) {
      setUploadingImage(true)
      const ext = imageFile.name.split('.').pop()
      const fileName = `announcement_${Date.now()}.${ext}`
      const { data: uploaded, error: uploadError } =
        await supabase.storage
          .from('announcements')
          .upload(fileName, imageFile, {
            upsert: false,
            contentType: imageFile.type
          })
      setUploadingImage(false)
      if (uploadError) {
        setSubmitError(
          'Error uploading image: ' + uploadError.message
        )
        setSaving(false)
        return
      }
      imagePath = uploaded.path
    }

    const { data: inserted, error } = await supabase
      .from('announcements')
      .insert({
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        content: form.content.trim(),
        image_path: imagePath,
        is_published: form.is_published,
        expiry_date: form.expiry_date || null,
        posted_by_id: user?.id,
        posted_by_name: profile?.full_name ?? user?.email,
        posted_by_role: profile?.role ?? null,
      })
      .select('id')
      .single()

    if (error) {
      setSubmitError('Error posting: ' + error.message)
      setSaving(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'INSERT',
      table_name: 'announcements',
      record_id: inserted.id,
      notes: `Announcement posted: ${form.title}`,
    })

    router.push(`/dashboard/announcements/${inserted.id}`)
  }

  return (
    <div className={styles.formContainer}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <Link
          href="/dashboard/announcements"
          className={styles.backButton}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className={styles.pageTitle}>New Announcement</h1>
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

      {/* Details */}
      <Section title="Announcement Details">
        <Field label="Title" required error={errors.title}>
          <input
            className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Barangay Cleanup Drive this Saturday"
            maxLength={200}
          />
          <div className={styles.charCount}>
            {form.title.length}/200
          </div>
        </Field>

        <div className={styles.fieldRow}>
          <Field label="Category" required half>
            <select
              className={styles.select}
              value={form.category}
              onChange={e =>
                set('category', e.target.value as AnnouncementCategory)
              }
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority" required half>
            <select
              className={styles.select}
              value={form.priority}
              onChange={e =>
                set('priority', e.target.value as AnnouncementPriority)
              }
            >
              <option value="Normal">Normal</option>
              <option value="Urgent">Urgent</option>
              <option value="Emergency">Emergency 🚨</option>
            </select>
          </Field>
          <Field
            label="Expiry Date (optional)"
            half
          >
            <input
              className={styles.input}
              type="date"
              value={form.expiry_date}
              onChange={e => set('expiry_date', e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </Field>
        </div>

        <Field
          label="Content / Message"
          required
          error={errors.content}
        >
          <textarea
            className={`${styles.textarea} ${errors.content ? styles.inputError : ''}`}
            value={form.content}
            onChange={e => set('content', e.target.value)}
            placeholder="Write your announcement here. Be clear and concise. Residents will read this on the public page and mobile app..."
            rows={8}
          />
          <div className={styles.charCount}>
            {form.content.length} characters
          </div>
        </Field>
      </Section>

      {/* Image */}
      <Section title="Announcement Image (optional)">
        {!imagePreview ? (
          <label className={styles.imageUploadArea}>
            <ImageIcon size={32} color="#e8820c" />
            <p className={styles.imageUploadText}>
              Click to upload an image<br />
              <span style={{ fontSize: 12, color: '#cbd5e1' }}>
                PNG, JPG or WebP · Max 10MB
              </span>
            </p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={handleImageChange}
              style={{ display: 'none' }}
            />
          </label>
        ) : (
          <div>
            <img
              src={imagePreview}
              alt="Preview"
              className={styles.imagePreview}
            />
            <button
              onClick={removeImage}
              className={styles.removeImageButton}
            >
              <X size={13} /> Remove image
            </button>
          </div>
        )}
        {errors.image && (
          <div className={styles.fieldError} style={{ marginTop: 8 }}>
            <AlertCircle size={12} color="#dc2626" />
            <span className={styles.fieldErrorText}>
              {errors.image}
            </span>
          </div>
        )}
      </Section>

      {/* Publish Settings */}
      <Section title="Publish Settings">
        <div className={styles.publishToggle}>
          <div>
            <p className={styles.publishLabel}>
              Publish immediately
            </p>
            <p className={styles.publishDesc}>
              {form.is_published
                ? 'Announcement will be visible to the public right away'
                : 'Save as draft — not visible to the public yet'
              }
            </p>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={e => set('is_published', e.target.checked)}
            />
            <span className={styles.toggleSlider} />
          </label>
        </div>
      </Section>

      {/* Actions */}
      <div className={styles.actions}>
        <Link
          href="/dashboard/announcements"
          className={styles.cancelButton}
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${styles.saveButton} ${saving ? styles.saveButtonDisabled : ''}`}
        >
          {saving
            ? <><Loader2 size={16} />
              {uploadingImage
                ? ' Uploading image...'
                : ' Posting...'
              }
            </>
            : <><Save size={16} /> Post Announcement</>
          }
        </button>
      </div>
    </div>
  )
}