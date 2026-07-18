import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { Megaphone } from 'lucide-react'

export const revalidate = 60

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function PublicAnnouncementsPage() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const [{ data: announcements }, { data: settings }] =
    await Promise.all([
      supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .or(
          `expiry_date.is.null,expiry_date.gte.${new Date()
            .toISOString().split('T')[0]}`
        )
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('barangay_settings')
        .select('barangay_name, city, province, logo_path')
        .single(),
    ])

  const priorityConfig = {
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif'
    }}>

      {/* Header */}
      <header style={{
        background: 'linear-gradient(135deg, #f4a020, #c96008)',
        padding: '20px 24px',
        color: 'white',
        boxShadow: '0 2px 12px rgba(232,130,12,0.3)'
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <Megaphone size={24} color="white" />
            <div>
              <h1 style={{
                margin: 0, fontSize: 18, fontWeight: 700
              }}>
                {settings?.barangay_name ?? 'Barangay IV'} —
                Announcements
              </h1>
              <p style={{
                margin: 0, fontSize: 13, opacity: 0.85
              }}>
                {settings?.city}, {settings?.province} ·
                Public Notice Board
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main style={{
        maxWidth: 720, margin: '0 auto',
        padding: '24px 16px'
      }}>
        {!announcements || announcements.length === 0 ? (
          <div style={{
            padding: 64, textAlign: 'center',
            background: 'white', borderRadius: 14,
            border: '1px solid #e8e6df'
          }}>
            <Megaphone
              size={48} color="#e8820c"
              style={{
                opacity: 0.3, display: 'block',
                margin: '0 auto 16px'
              }}
            />
            <p style={{
              color: '#94a3b8', margin: 0, fontSize: 15
            }}>
              No announcements at this time.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 16
          }}>
            {announcements.map(ann => {
              const pc = priorityConfig[
                ann.priority as keyof typeof priorityConfig
              ] ?? priorityConfig.Normal

              let imageUrl = ''
              if (ann.image_path) {
                const { data: { publicUrl } } = supabase
                  .storage.from('announcements')
                  .getPublicUrl(ann.image_path)
                imageUrl = publicUrl
              }

              return (
                <Link
                  key={ann.id}
                  href={`/announcements/${ann.id}`}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    background: 'white', borderRadius: 14,
                    border: `1px solid ${pc.border}`,
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                  }}>
                    {/* Priority Banner */}
                    <div style={{
                      background: pc.bg,
                      padding: '6px 16px',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
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

                    <div style={{ display: 'flex' }}>
                      {/* Image */}
                      {imageUrl && (
                        <div style={{
                          width: 120, flexShrink: 0,
                          overflow: 'hidden', maxHeight: 100
                        }}>
                          <img
                            src={imageUrl}
                            alt={ann.title}
                            style={{
                              width: '100%', height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                        </div>
                      )}

                      {/* Body */}
                      <div style={{
                        padding: '14px 16px', flex: 1
                      }}>
                        <h2 style={{
                          margin: '0 0 6px', fontSize: 15,
                          fontWeight: 600, color: '#0f172a',
                          lineHeight: 1.4
                        }}>
                          {ann.title}
                        </h2>
                        <p style={{
                          margin: '0 0 8px', fontSize: 13,
                          color: '#64748b', lineHeight: 1.6,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        } as any}>
                          {ann.content}
                        </p>
                        <p style={{
                          margin: 0, fontSize: 11,
                          color: '#94a3b8'
                        }}>
                          {new Date(ann.created_at)
                            .toLocaleDateString('en-PH', {
                              month: 'long', day: 'numeric',
                              year: 'numeric'
                            })}
                          {ann.posted_by_name
                            ? ` · ${ann.posted_by_name}`
                            : ''
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        <p style={{
          textAlign: 'center', fontSize: 11,
          color: '#94a3b8', marginTop: 32
        }}>
          {settings?.barangay_name} · Official Public Announcement
          Board · Powered by BMIS
        </p>
      </main>
    </div>
  )
}