'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function PublicAnnouncementDetailPage() {
  const { id } = useParams()
  const supabase = createClient()

  const [ann, setAnn] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: annData }, { data: s }] = await Promise.all([
        supabase
          .from('announcements')
          .select('*')
          .eq('id', id)
          .eq('is_published', true)
          .single(),
        supabase
          .from('barangay_settings')
          .select('barangay_name, city, province, logo_path')
          .single(),
      ])

      if (!annData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setAnn(annData)
      setSettings(s)

      if (annData.image_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('announcements').getPublicUrl(annData.image_path)
        setImageUrl(publicUrl)
      }

      if (s?.logo_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('barangay-assets').getPublicUrl(s.logo_path)
        setLogoUrl(publicUrl)
      }

      setLoading(false)
    }
    load()
  }, [id])

  const priorityConfig: Record<string, {
    bg: string, border: string, text: string, label: string
  }> = {
    Emergency: {
      bg: '#fef2f2', border: '#fecaca',
      text: '#dc2626', label: '🚨 EMERGENCY'
    },
    Urgent: {
      bg: '#fffbeb', border: '#fde68a',
      text: '#d97706', label: '⚠️ URGENT'
    },
    Normal: {
      bg: '#fff7ed', border: '#fed7aa',
      text: '#c2410c', label: '📢 ANNOUNCEMENT'
    },
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      color: '#94a3b8', fontSize: 14
    }}>
      Loading announcement...
    </div>
  )

  if (notFound || !ann) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      flexDirection: 'column', gap: 16
    }}>
      <p style={{ color: '#94a3b8', fontSize: 15, margin: 0 }}>
        Announcement not found or no longer available.
      </p>
      <Link href="/announcements" style={{
        color: '#e8820c', fontSize: 13,
        textDecoration: 'none'
      }}>
        ← Back to Announcements
      </Link>
    </div>
  )

  const pc = priorityConfig[ann.priority] ?? priorityConfig.Normal

  return (
    <div style={{
      minHeight: '100vh', background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif'
    }}>

      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #f4a020, #c96008)',
        padding: '16px 24px', color: 'white'
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link
            href="/announcements"
            style={{
              display: 'inline-flex', alignItems: 'center',
              gap: 6, color: 'rgba(255,255,255,0.9)',
              textDecoration: 'none', fontSize: 13
            }}
          >
            <ArrowLeft size={14} /> All Announcements
          </Link>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: 720, margin: '0 auto',
        padding: '24px 16px'
      }}>
        <div style={{
          background: 'white', borderRadius: 14,
          border: `1px solid ${pc.border}`,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>

          {/* Priority Banner */}
          <div style={{
            background: pc.bg, padding: '8px 20px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: pc.text, letterSpacing: 0.5
            }}>
              {pc.label}
            </span>
            <span style={{
              fontSize: 11, color: pc.text, opacity: 0.7
            }}>
              {ann.category}
            </span>
          </div>

          {/* Image */}
          {imageUrl && (
            <img
              src={imageUrl}
              alt={ann.title}
              style={{
                width: '100%', maxHeight: 320,
                objectFit: 'cover', display: 'block'
              }}
            />
          )}

          {/* Body */}
          <div style={{ padding: '24px 20px' }}>

            {/* Barangay Info */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 10, marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid #f1f0eb'
            }}>
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Logo"
                  style={{
                    width: 36, height: 36,
                    objectFit: 'contain', flexShrink: 0
                  }}
                />
              )}
              <div>
                <p style={{
                  margin: 0, fontSize: 13,
                  fontWeight: 600, color: '#0f172a'
                }}>
                  {settings?.barangay_name ?? 'Barangay IV'}
                </p>
                <p style={{
                  margin: 0, fontSize: 11, color: '#94a3b8'
                }}>
                  {[settings?.city, settings?.province]
                    .filter(Boolean).join(', ')}
                </p>
              </div>
            </div>

            {/* Title */}
            <h1 style={{
              margin: '0 0 8px', fontSize: 22,
              fontWeight: 700, color: '#0f172a',
              lineHeight: 1.4
            }}>
              {ann.title}
            </h1>

            {/* Date + Author */}
            <p style={{
              margin: '0 0 20px', fontSize: 12,
              color: '#94a3b8', lineHeight: 1.6
            }}>
              {new Date(ann.created_at).toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric', year: 'numeric'
              })}
              {ann.posted_by_name
                ? ` · ${ann.posted_by_name}`
                : ''
              }
              {ann.expiry_date && (
                <> · Valid until{' '}
                  {new Date(ann.expiry_date)
                    .toLocaleDateString('en-PH', {
                      month: 'long', day: 'numeric',
                      year: 'numeric'
                    })}
                </>
              )}
            </p>

            {/* Content */}
            <p style={{
              margin: 0, fontSize: 15,
              color: '#374151', lineHeight: 1.8,
              whiteSpace: 'pre-wrap'
            }}>
              {ann.content}
            </p>
          </div>
        </div>

        <p style={{
          textAlign: 'center', fontSize: 11,
          color: '#94a3b8', marginTop: 24
        }}>
          {settings?.barangay_name} Official Announcement ·
          Powered by BMIS
        </p>
      </main>
    </div>
  )
}