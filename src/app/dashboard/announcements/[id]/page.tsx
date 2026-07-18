'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit, Trash2, Copy,
  CheckCircle, AlertCircle, Eye, EyeOff
} from 'lucide-react'
import type { Announcement, AnnouncementPriority } from '@/lib/types'
import styles from '../styles/announcements.module.css'

const PRIORITY_CLASSES: Record<AnnouncementPriority, string> = {
  Normal: styles.priorityNormal,
  Urgent: styles.priorityUrgent,
  Emergency: styles.priorityEmergency,
}

export default function AnnouncementDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [announcement, setAnnouncement] =
    useState<Announcement | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [userId, setUserId] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function load() {
      const [
        { data: ann },
        { data: { user } }
      ] = await Promise.all([
        supabase.from('announcements')
          .select('*').eq('id', id).single(),
        supabase.auth.getUser(),
      ])

      setAnnouncement(ann)

      if (ann?.image_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('announcements').getPublicUrl(ann.image_path)
        setImageUrl(publicUrl)
      }

      if (user) {
        setUserId(user.id)
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role)
      }

      setLoading(false)
    }
    load()
  }, [id])

  const canEdit = ['super_admin', 'captain', 'secretary'].includes(userRole) ||
    announcement?.posted_by_id === userId
  const canDelete = ['super_admin', 'captain'].includes(userRole)

  function buildFacebookCopy(ann: Announcement): string {
    const emoji = ann.priority === 'Emergency'
      ? '🚨'
      : ann.priority === 'Urgent'
        ? '⚠️'
        : '📢'

    const categoryEmoji: Record<string, string> = {
      Health: '🏥',
      Safety: '🛡️',
      Events: '🎉',
      Emergency: '🚨',
      Infrastructure: '🏗️',
      'Social Services': '🤝',
      Livelihood: '💼',
      General: '📋',
    }

    return [
      `${emoji} ${ann.priority.toUpperCase()} ANNOUNCEMENT`,
      `${categoryEmoji[ann.category] ?? '📋'} ${ann.category}`,
      '',
      ann.title.toUpperCase(),
      '',
      ann.content,
      '',
      `📅 ${new Date(ann.created_at).toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric'
      })}`,
      ann.expiry_date
        ? `⏰ Valid until: ${new Date(ann.expiry_date).toLocaleDateString('en-PH', {
          month: 'long', day: 'numeric', year: 'numeric'
        })}`
        : '',
      '',
      `— ${ann.posted_by_name ?? 'Barangay IV'}`,
      `Barangay IV, Tangub City`,
    ].filter(l => l !== null).join('\n')
  }

  async function handleCopyFacebook() {
    if (!announcement) return
    const text = buildFacebookCopy(announcement)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  async function handleTogglePublish() {
    if (!announcement) return
    const newStatus = !announcement.is_published
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ is_published: newStatus })
      .eq('id', id)

    if (updateError) {
      setError('Error updating: ' + updateError.message)
      return
    }
    setAnnouncement(prev =>
      prev ? { ...prev, is_published: newStatus } : prev
    )
    setSuccess(
      newStatus
        ? 'Announcement is now published and visible to the public.'
        : 'Announcement has been unpublished (draft).'
    )
    setTimeout(() => setSuccess(''), 4000)
  }

  async function handleDelete() {
    if (!announcement) return
    const confirmed = window.confirm(
      'Are you sure you want to delete this announcement? ' +
      'This cannot be undone.'
    )
    if (!confirmed) return

    setDeleting(true)

    // Delete image from storage if exists
    if (announcement.image_path) {
      await supabase.storage
        .from('announcements')
        .remove([announcement.image_path])
    }

    const { error: deleteError } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id)

    if (deleteError) {
      setError('Error deleting: ' + deleteError.message)
      setDeleting(false)
      return
    }

    router.push('/dashboard/announcements')
  }

  if (loading) return (
    <div style={{
      padding: 48, textAlign: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Loading announcement...
    </div>
  )

  if (!announcement) return (
    <div style={{
      padding: 48, textAlign: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Announcement not found.{' '}
      <Link
        href="/dashboard/announcements"
        style={{ color: '#e8820c' }}
      >
        Back
      </Link>
    </div>
  )

  const fbText = buildFacebookCopy(announcement)

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
        <div style={{ flex: 1 }}>
          <h1 className={styles.pageTitle}>Announcement</h1>
          <p className={styles.pageSubtitle}>
            Posted{' '}
            {new Date(announcement.created_at)
              .toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric', year: 'numeric'
              })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canEdit && (
            <button
              onClick={handleTogglePublish}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8,
                border: '1px solid #e2e0d9', background: 'white',
                color: '#374151', fontSize: 13, cursor: 'pointer'
              }}
            >
              {announcement.is_published
                ? <><EyeOff size={14} /> Unpublish</>
                : <><Eye size={14} /> Publish</>
              }
            </button>
          )}
          {canEdit && (
            <Link
              href={`/dashboard/announcements/${id}/edit`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8,
                border: '1px solid #e2e0d9', background: 'white',
                color: '#374151', textDecoration: 'none',
                fontSize: 13
              }}
            >
              <Edit size={14} /> Edit
            </Link>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8,
                border: '1px solid #fecaca', background: 'white',
                color: '#dc2626', fontSize: 13, cursor: 'pointer'
              }}
            >
              <Trash2 size={14} />
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={styles.errorBanner}>
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className={styles.successBanner}>
          <CheckCircle size={16} /> {success}
        </div>
      )}

      {/* Content Card */}
      <div className={styles.section}>
        <div className={styles.sectionBody}>

          {/* Image */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={announcement.title}
              className={styles.detailImage}
            />
          )}

          {/* Meta */}
          <div className={styles.detailMeta}>
            <span className={
              PRIORITY_CLASSES[announcement.priority]
            }>
              {announcement.priority}
            </span>
            <span className={styles.categoryBadge}>
              {announcement.category}
            </span>
            {!announcement.is_published && (
              <span className={styles.draftBadge}>Draft</span>
            )}
            {announcement.expiry_date && (
              <span className={styles.metaText}>
                Expires:{' '}
                {new Date(announcement.expiry_date)
                  .toLocaleDateString('en-PH', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
              </span>
            )}
          </div>

          {/* Title */}
          <h2 className={styles.detailTitle}>
            {announcement.title}
          </h2>

          {/* Content */}
          <p className={styles.detailContent}>
            {announcement.content}
          </p>

          {/* Posted by */}
          <div style={{
            marginTop: 20, paddingTop: 16,
            borderTop: '1px solid #f1f0eb',
            fontSize: 13, color: '#94a3b8'
          }}>
            Posted by{' '}
            <strong style={{ color: '#374151' }}>
              {announcement.posted_by_name ?? 'Barangay IV'}
            </strong>
            {announcement.posted_by_role && (
              <span> · {announcement.posted_by_role
                .replace(/_/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
              }</span>
            )}
          </div>
        </div>
      </div>

      {/* Facebook Copy */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Copy for Facebook
          </h2>
        </div>
        <div className={styles.sectionBody}>
          <p style={{
            fontSize: 13, color: '#64748b',
            margin: '0 0 12px'
          }}>
            Click the button below to copy a formatted version
            ready to paste in your Facebook group or page.
          </p>
          <div className={styles.fbCopyBox}>
            {fbText}
          </div>
          <button
            onClick={handleCopyFacebook}
            className={`${styles.fbCopyButton} ${copied ? styles.fbCopyButtonSuccess : ''}`}
          >
            {copied
              ? <><CheckCircle size={15} /> Copied to clipboard!</>
              : <><Copy size={15} /> Copy for Facebook</>
            }
          </button>
        </div>
      </div>

      {/* Public Link */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Public Link</h2>
        </div>
        <div className={styles.sectionBody}>
          <p style={{
            fontSize: 13, color: '#64748b',
            margin: '0 0 10px'
          }}>
            Share this link so residents can view this announcement
            without logging in. Also accessible via the mobile app.
          </p>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center'
          }}>
            <input
              readOnly
              value={`${typeof window !== 'undefined'
                ? window.location.origin
                : ''}/announcements/${id}`}
              style={{
                flex: 1, padding: '8px 12px',
                border: '1px solid #e2e0d9',
                borderRadius: 8, fontSize: 13,
                color: '#64748b', background: '#fafaf8'
              }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}/announcements/${id}`
                )
                setSuccess('Link copied!')
                setTimeout(() => setSuccess(''), 2000)
              }}
              style={{
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid #e2e0d9', background: 'white',
                color: '#374151', fontSize: 13, cursor: 'pointer'
              }}
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}