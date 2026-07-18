'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Loader2,
  AlertCircle, X, Image as ImageIcon
} from 'lucide-react'
import type {
  Announcement, AnnouncementCategory,
  AnnouncementPriority
} from '@/lib/types'
import styles from '../../styles/announcements.module.css'

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

export default function EditAnnouncementPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [existingImagePath, setExistingImagePath] = useState<string | null>(null)
  const [removeExistingImage, setRemoveExistingImage] = useState(false)

  const [form, setForm] = useState({
    title: '',
    category: 'General' as AnnouncementCategory,
    priority: 'Normal' as AnnouncementPriority,
    content: '',
    expiry_date: '',
    is_published: true,
  })

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('announcements')
        .select('*').eq('id', id).single()

      if (data) {
        setForm({
          title: data.title,
          category: data.category,
          priority: data.priority,
          content: data.content,
          expiry_date: data.expiry_date ?? '',
          is_published: data.is_published,
        })

        if (data.image_path) {
          setExistingImagePath(data.image_path)
          const { data: { publicUrl } } = supabase.storage
            .from('announcements').getPublicUrl(data.image_path)
          setImagePreview(publicUrl)
        }
      }
      setLoading(false)
    }
    load()
  }, [id])

  function set(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const e = { ...prev }; delete e[field]; return e
      })
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!allowed.includes(file.type)) {
      setErrors(prev => ({
        ...prev, image: 'Image must be PNG, JPG or WebP.'
      }))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({
        ...prev, image: 'Image must be 10MB or less.'
      }))
      return
    }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setRemoveExistingImage(true)
    setErrors(prev => { const e = { ...prev }; delete e.image; return e })
  }

  function handleRemoveImage() {
    setImageFile(null)
    setImagePreview('')
    setRemoveExistingImage(true)
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

    let imagePath = existingImagePath

    // Remove old image if needed
    if (removeExistingImage && existingImagePath) {
      await supabase.storage
        .from('announcements')
        .remove([existingImagePath])
      imagePath = null
    }

    // Upload new image if selected
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const fileName = `announcement_${Date.now()}.${ext}`
      const { data: uploaded, error: uploadError } =
        await supabase.storage
          .from('announcements')
          .upload(fileName, imageFile, {
            upsert: false,
            contentType: imageFile.type
          })
      if (uploadError) {
        setSubmitError(
          'Error uploading image: ' + uploadError.message
        )
        setSaving(false)
        return
      }
      imagePath = uploaded.path
    }

    const { error } = await supabase
      .from('announcements')
      .update({
        title: form.title.trim(),
        category: form.category,
        priority: form.priority,
        content: form.content.trim(),
        image_path: imagePath,
        is_published: form.is_published,
        expiry_date: form.expiry_date || null,
      })
      .eq('id', id)

    if (error) {
      setSubmitError('Error updating: ' + error.message)
      setSaving(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user?.id,
      user_name: user?.email,
      action: 'UPDATE',
      table_name: 'announcements',
      record_id: id as string,
      notes: `Announcement updated: ${form.title}`,
    })

    router.push(`/dashboard/announcements/${id}`)
  }

  if (loading) return (
    <div style={{
      padding: 48, textAlign: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Loading...
    </div>
  )

  return (
    <div className={styles.formContainer}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <Link
          href={`/dashboard/announcements/${id}`}
          className={styles.backButton}
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className={styles.pageTitle}>Edit Announcement</h1>
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
          <Field label="Expiry Date (optional)" half>
            <input
              className={styles.input}
              type="date"
              value={form.expiry_date}
              onChange={e => set('expiry_date', e.target.value)}
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
            rows={8}
          />
          <div className={styles.charCount}>
            {form.content.length} characters
          </div>
        </Field>
      </Section>

      {/* Image */}
      <Section title="Announcement Image (optional)">
        {!imagePreview || removeExistingImage && !imageFile ? (
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
              onClick={handleRemoveImage}
              className={styles.removeImageButton}
            >
              <X size={13} /> Remove image
            </button>
          </div>
        )}
      </Section>

      {/* Publish Settings */}
      <Section title="Publish Settings">
        <div className={styles.publishToggle}>
          <div>
            <p className={styles.publishLabel}>Published</p>
            <p className={styles.publishDesc}>
              {form.is_published
                ? 'Visible to the public and mobile app'
                : 'Draft — not visible to the public'
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
          href={`/dashboard/announcements/${id}`}
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
            ? <><Loader2 size={16} /> Saving...</>
            : <><Save size={16} /> Save Changes</>
          }
        </button>
      </div>
    </div>
  )
}