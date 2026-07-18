'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import {
  LayoutDashboard, Building2, Users, FileText, Megaphone,
  Settings, LogOut, Menu, X, Shield, Activity, HardDrive
} from 'lucide-react'
import styles from './city-admin.module.css'

export default function CityAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [cityUser, setCityUser] = useState<{ full_name: string; role: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkCityAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        console.log('Authenticated user ID:', user.id)

        const { data: cityRole, error } = await supabase
          .from('city_roles')
          .select('role, full_name, email')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle()

        console.log('city_roles query result:', { cityRole, error })

        if (error) {
          console.error('city_roles error:', error)
          router.push('/dashboard')
          return
        }

        if (!cityRole) {
          console.log('No city role found for user:', user.id)
          router.push('/dashboard')
          return
        }

        console.log('City role found:', cityRole)
        setCityUser(cityRole)
      } catch (err) {
        console.error('City admin auth error:', err)
        router.push('/dashboard')
      } finally {
        setLoading(false)
      }
    }
    checkCityAccess()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string): boolean {
    if (href === '/city-admin') return pathname === '/city-admin'
    return pathname.startsWith(href)
  }

  const navGroups = [
    {
      label: 'MAIN',
      items: [
        { href: '/city-admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/city-admin/barangays', label: 'Barangays', icon: Building2 },
      ],
    },
    {
      label: 'MANAGEMENT',
      items: [
        { href: '/city-admin/users', label: 'Users', icon: Users },
        { href: '/city-admin/reports', label: 'Reports', icon: FileText },
        { href: '/city-admin/announcements', label: 'Announcements', icon: Megaphone },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { href: '/city-admin/audit', label: 'Audit Logs', icon: Activity },
        { href: '/city-admin/storage', label: 'Storage', icon: HardDrive },
        { href: '/city-admin/settings', label: 'Settings', icon: Settings },
      ],
    },
  ]

  if (loading) return <div className={styles.loading}>Loading...</div>
  if (!cityUser) return null

  return (
    <div className={styles.container}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className={styles.mobileOverlay}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* Brand */}
        <div className={styles.sidebarBrand}>
          <div className={styles.brandIcon}>
            <Shield size={24} color="#F59E0B" />
          </div>
          <div>
            <h1 className={styles.brandTitle}>Tangub City LGU</h1>
            <p className={styles.brandSubtitle}>Command Center</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.sidebarNav}>
          {navGroups.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <h3 className={styles.navGroupLabel}>{group.label}</h3>
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`${styles.navItem} ${isActive(item.href) ? styles.navItemActive : ''}`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* User Info */}
        <div className={styles.sidebarBottom}>
          <div className={styles.userInfo}>
            <p className={styles.userName}>{cityUser.full_name}</p>
            <p className={styles.userRole}>{cityUser.role.replace(/_/g, ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            className={styles.logoutBtn}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={styles.hamburger}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className={styles.headerLeft}>
            <p className={styles.headerTitle}>Tangub City Government</p>
          </div>

          <div className={styles.headerRight}>
            <span className={styles.roleBadge}>
              {cityUser.role.replace(/_/g, ' ')}
            </span>
            <div className={styles.userAvatar}>
              {cityUser.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  )
}
