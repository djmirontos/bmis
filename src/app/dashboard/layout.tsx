'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  Users, Home, UserCheck,
  Megaphone, FileText, LogOut,
  Menu, X, Building2, Settings,
  ScrollText, BookOpen
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/lib/settings-context'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home, exact: true },
  { href: '/dashboard/residents', label: 'Residents', icon: Users },
  { href: '/dashboard/households', label: 'Households', icon: Building2 },
  { href: '/dashboard/officials', label: 'Officials Directory', icon: UserCheck },
  { href: '/dashboard/clearance', label: 'Clearance & Certs', icon: ScrollText },
  { href: '/dashboard/blotter', label: 'Blotter & Incidents', icon: BookOpen },
  { href: '/dashboard/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/dashboard/reports', label: 'Reports', icon: FileText },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [logoError, setLogoError] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const { settings } = useSettings()

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .single()
      if (profile) {
        setUserName(profile.full_name)
        setUserRole(profile.role.replace(/_/g, ' '))
      }
    }
    getUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact = false) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-30 flex flex-col transition-transform duration-200',
        'lg:translate-x-0 lg:static lg:z-auto',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>

        {/* Sidebar Header — Logo + Barangay Name */}
        <div style={{
          padding: '16px 12px',
          borderBottom: '1px solid #f1f0eb',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'linear-gradient(to bottom, #fffbf5, white)'
        }}>
          {/* Barangay Logo */}
          <div style={{
            width: 44, height: 44,
            borderRadius: '50%',
            flexShrink: 0,
            overflow: 'hidden',
            background: logoError || !settings.logo_url
              ? 'linear-gradient(135deg, #f4a020, #c96008)'
              : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(232,130,12,0.2)'
          }}>
            {settings.logo_url && !logoError ? (
              <img
                src={settings.logo_url}
                alt="Barangay Logo"
                onError={() => setLogoError(true)}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{
                fontSize: 16, fontWeight: 700,
                color: 'white'
              }}>
                {settings.barangay_name.slice(-1)}
              </span>
            )}
          </div>

          {/* Barangay Name + City */}
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 13, fontWeight: 600,
              color: '#0f172a', margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {settings.barangay_name}
            </p>
            <p style={{
              fontSize: 11, color: '#94a3b8',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {settings.city}
            </p>
          </div>
        </div>

        {/* Nav Items */}
        <nav style={{
          flex: 1, padding: '8px 8px',
          overflowY: 'auto', display: 'flex',
          flexDirection: 'column', gap: 2
        }}>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              style={{
                display: 'flex', alignItems: 'center',
                gap: 10, padding: '9px 12px',
                borderRadius: 8, fontSize: 14,
                textDecoration: 'none',
                transition: 'all 0.12s',
                background: isActive(item.href, item.exact)
                  ? '#fff7ed' : 'transparent',
                color: isActive(item.href, item.exact)
                  ? '#c2410c' : '#64748b',
                fontWeight: isActive(item.href, item.exact) ? 500 : 400,
                borderLeft: isActive(item.href, item.exact)
                  ? '3px solid #e8820c' : '3px solid transparent',
              }}
            >
              <item.icon size={16} style={{ flexShrink: 0 }} />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid #f1f0eb'
        }}>
          <div style={{ padding: '6px 8px', marginBottom: 4 }}>
            <p style={{
              fontSize: 13, fontWeight: 500,
              color: '#0f172a', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {userName}
            </p>
            <p style={{
              fontSize: 11, color: '#94a3b8',
              margin: 0, textTransform: 'capitalize'
            }}>
              {userRole}
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex', alignItems: 'center',
              gap: 8, padding: '8px 10px', width: '100%',
              borderRadius: 8, fontSize: 13,
              color: '#64748b', background: 'none',
              border: 'none', cursor: 'pointer',
              transition: 'all 0.12s', textAlign: 'left' as const
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#fef2f2'
              ;(e.currentTarget as HTMLElement).style.color = '#dc2626'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'none'
              ;(e.currentTarget as HTMLElement).style.color = '#64748b'
            }}
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile Header */}
        <header style={{
          background: 'white',
          borderBottom: '1px solid #e8e6df',
          padding: '10px 16px',
          alignItems: 'center',
          gap: 12,
        }}
          className="lg:hidden"
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              padding: 6, borderRadius: 8,
              border: '1px solid #e2e0d9',
              background: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {sidebarOpen
              ? <X size={20} color="#64748b" />
              : <Menu size={20} color="#64748b" />
            }
          </button>
        </header>

        {/* Page Content */}
        <main style={{
          flex: 1, padding: '24px',
          overflowY: 'auto'
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}