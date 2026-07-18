'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Megaphone, Plus, Search, Image as ImageIcon } from 'lucide-react'
import type { Announcement, AnnouncementCategory, AnnouncementPriority } from '@/lib/types'
import styles from './styles/announcements.module.css'

const CATEGORIES: AnnouncementCategory[] = [
  'General', 'Health', 'Safety', 'Events',
  'Emergency', 'Infrastructure', 'Social Services', 'Livelihood'
]

const PRIORITY_CLASSES: Record<AnnouncementPriority, string> = {
  Normal: styles.priorityNormal,
  Urgent: styles.priorityUrgent,
  Emergency: styles.priorityEmergency,
}

function isExpired(expiry: string | null): boolean {
  if (!expiry) return false
  return new Date(expiry) < new Date()
}

export default function AnnouncementsPage() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [total, setTotal] = useState(0)
  const [userRole, setUserRole] = useState('')
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles').select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role)
      }
    }
    init()
  }, [])

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('announcements')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search.trim()) {
      query = query.or(
        `title.ilike.%${search}%,content.ilike.%${search}%`
      )
    }
    if (filterCategory) query = query.eq('category', filterCategory)
    if (filterPriority) query = query.eq('priority', filterPriority)

    const { data, count } = await query.limit(50)
    setAnnouncements(data ?? [])
    setTotal(count ?? 0)

    // Build image URLs
    if (data) {
      const urls: Record<string, string> = {}
      for (const ann of data) {
        if (ann.image_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('announcements').getPublicUrl(ann.image_path)
          urls[ann.id] = publicUrl
        }
      }
      setLogoUrls(urls)
    }

    setLoading(false)
  }, [search, filterCategory, filterPriority])

  useEffect(() => {
    const timer = setTimeout(fetchAnnouncements, 300)
    return () => clearTimeout(timer)
  }, [fetchAnnouncements])

  const canPost = ['super_admin', 'captain', 'secretary', 'kagawad']
    .includes(userRole)
  const hasFilters = search || filterCategory || filterPriority

  function clearFilters() {
    setSearch('')
    setFilterCategory('')
    setFilterPriority('')
  }

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Megaphone size={22} color="white" />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Announcements</h1>
            <p className={styles.headerSubtitle}>
              {total.toLocaleString()} announcement{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {canPost && (
          <Link
            href="/dashboard/announcements/new"
            className={styles.addButton}
          >
            <Plus size={16} /> New Announcement
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Search
              size={15} color="#94a3b8"
              className={styles.searchIcon}
            />
            <input
              type="text"
              placeholder="Search announcements..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Priority</option>
            <option value="Normal">Normal</option>
            <option value="Urgent">Urgent</option>
            <option value="Emergency">Emergency</option>
          </select>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className={styles.clearButton}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Cards Grid */}
      <div className={styles.grid}>
        {loading ? (
          <div className={styles.loadingState}>
            Loading announcements...
          </div>
        ) : announcements.length === 0 ? (
          <div className={styles.emptyState}>
            <Megaphone
              size={48}
              className={styles.emptyIcon}
            />
            <p className={styles.emptyText}>
              {hasFilters
                ? 'No announcements match your search.'
                : 'No announcements posted yet.'}
            </p>
            {!hasFilters && canPost && (
              <Link
                href="/dashboard/announcements/new"
                className={styles.addButton}
              >
                Post first announcement
              </Link>
            )}
          </div>
        ) : (
          announcements.map(ann => (
            <div key={ann.id} className={styles.card}>
              {/* Image */}
              <div className={styles.cardImageWrapper}>
                {logoUrls[ann.id] ? (
                  <img
                    src={logoUrls[ann.id]}
                    alt={ann.title}
                    className={styles.cardImage}
                  />
                ) : (
                  <ImageIcon
                    size={40}
                    className={styles.cardImagePlaceholder}
                    color="#e8820c"
                  />
                )}
              </div>

              {/* Body */}
              <div className={styles.cardBody}>
                <div className={styles.cardMeta}>
                  <span className={
                    PRIORITY_CLASSES[ann.priority]
                  }>
                    {ann.priority}
                  </span>
                  <span className={styles.categoryBadge}>
                    {ann.category}
                  </span>
                  {!ann.is_published && (
                    <span className={styles.draftBadge}>
                      Draft
                    </span>
                  )}
                  {isExpired(ann.expiry_date) && (
                    <span className={styles.expiredBadge}>
                      Expired
                    </span>
                  )}
                </div>

                <h2 className={styles.cardTitle}>{ann.title}</h2>
                <p className={styles.cardContent}>{ann.content}</p>

                <div className={styles.cardFooter}>
                  <div>
                    <p className={styles.cardPostedBy}>
                      {ann.posted_by_name ?? 'Barangay IV'}
                    </p>
                    <p className={styles.cardPostedBy}>
                      {new Date(ann.created_at)
                        .toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                    </p>
                  </div>
                  <div className={styles.cardActions}>
                    <Link
                      href={`/dashboard/announcements/${ann.id}`}
                      className={styles.cardViewButton}
                    >
                      View
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}