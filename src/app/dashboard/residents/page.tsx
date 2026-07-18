'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Users, Plus, Search } from 'lucide-react'
import type { Resident, Purok } from '@/lib/types'
import styles from './styles/residents.module.css'

function getInitials(first: string, last: string) {
  return (first[0] + last[0]).toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = [
    '#e8820c', '#2563eb', '#16a34a', '#9333ea',
    '#dc2626', '#0891b2', '#d97706', '#7c3aed'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function getAge(dob: string) {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Resident[]>([])
  const [puroks, setPuroks] = useState<Purok[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPurok, setFilterPurok] = useState('')
  const [filterSex, setFilterSex] = useState('')
  const [filterClassification, setFilterClassification] = useState('')
  const [total, setTotal] = useState(0)
  const supabase = createClient()

  const fetchResidents = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('residents')
      .select('*, purok:puroks(id, name)', { count: 'exact' })
      .eq('is_deceased', false)
      .eq('is_transferred', false)
      .order('last_name', { ascending: true })

    if (search.trim()) {
      query = query.or(
        `last_name.ilike.%${search}%,first_name.ilike.%${search}%`
      )
    }
    if (filterPurok) query = query.eq('purok_id', filterPurok)
    if (filterSex) query = query.eq('sex', filterSex)
    if (filterClassification === 'pwd') query = query.eq('is_pwd', true)
    if (filterClassification === 'senior') query = query.eq('is_senior_citizen', true)
    if (filterClassification === 'voter') query = query.eq('is_voter', true)
    if (filterClassification === 'indigent') query = query.eq('is_indigent', true)
    if (filterClassification === '4ps') query = query.eq('is_4ps_beneficiary', true)
    if (filterClassification === 'solo_parent') query = query.eq('is_solo_parent', true)

    const { data, count } = await query.limit(100)
    setResidents(data ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [search, filterPurok, filterSex, filterClassification])

  useEffect(() => {
    supabase.from('puroks').select('*').order('name')
      .then(({ data }) => setPuroks(data ?? []))
  }, [])

  useEffect(() => {
    const timer = setTimeout(fetchResidents, 300)
    return () => clearTimeout(timer)
  }, [fetchResidents])

  function clearFilters() {
    setSearch('')
    setFilterPurok('')
    setFilterSex('')
    setFilterClassification('')
  }

  const hasFilters = search || filterPurok || filterSex || filterClassification

  return (
    <div className={styles.container}>

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <Users size={22} color="white" />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Resident Registry</h1>
            <p className={styles.headerSubtitle}>
              {total.toLocaleString()} registered resident{total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link href="/dashboard/residents/new" className={styles.addButton}>
          <Plus size={16} />
          Register Resident
        </Link>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterRow}>
          <div className={styles.searchWrapper}>
            <Search size={15} color="#94a3b8" className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <select
            value={filterPurok}
            onChange={e => setFilterPurok(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Puroks</option>
            {puroks.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <select
            value={filterSex}
            onChange={e => setFilterSex(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Sex</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          <select
            value={filterClassification}
            onChange={e => setFilterClassification(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Classifications</option>
            <option value="pwd">PWD</option>
            <option value="senior">Senior Citizen</option>
            <option value="voter">Voter</option>
            <option value="indigent">Indigent</option>
            <option value="4ps">4Ps Beneficiary</option>
            <option value="solo_parent">Solo Parent</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters} className={styles.clearButton}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loadingState}>Loading residents...</div>
        ) : residents.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={44} className={styles.emptyIcon} />
            <p className={styles.emptyText}>
              {hasFilters ? 'No residents match your search.' : 'No residents registered yet.'}
            </p>
            {!hasFilters && (
              <Link href="/dashboard/residents/new" className={styles.emptyAction}>
                Register first resident
              </Link>
            )}
          </div>
        ) : (
          <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  <th>Resident</th>
                  <th>Age / Sex</th>
                  <th>Purok</th>
                  <th>Civil Status</th>
                  <th>Classifications</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {residents.map(r => {
                  const fullName = `${r.first_name} ${r.last_name}`
                  const avatarColor = getAvatarColor(fullName)
                  const initials = getInitials(r.first_name, r.last_name)
                  const age = getAge(r.date_of_birth)
                  const tags = [
                    r.is_pwd && 'PWD',
                    r.is_senior_citizen && 'Senior',
                    r.is_voter && 'Voter',
                    r.is_4ps_beneficiary && '4Ps',
                    r.is_indigent && 'Indigent',
                    r.is_solo_parent && 'Solo Parent',
                    r.is_ofw && 'OFW',
                  ].filter(Boolean) as string[]

                  return (
                    <tr key={r.id} className={styles.tableRow}>
                      <td className={styles.tableCell}>
                        <div className={styles.residentCell}>
                          <div
                            className={styles.avatar}
                            style={{ background: avatarColor }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p className={styles.residentName}>
                              {r.last_name}, {r.first_name}{' '}
                              {r.middle_name ? r.middle_name[0] + '.' : ''}{' '}
                              {r.suffix ?? ''}
                            </p>
                            <p className={styles.residentContact}>
                              {r.contact_number ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className={styles.tableCell}>{age} / {r.sex}</td>
                      <td className={styles.tableCell}>
                        {(r.purok as any)?.name ?? '—'}
                      </td>
                      <td className={styles.tableCell}>{r.civil_status}</td>
                      <td className={styles.tableCell}>
                        <div className={styles.badgeGroup}>
                          {tags.map(tag => (
                            <span key={tag} className={styles.badge}>{tag}</span>
                          ))}
                          {tags.length === 0 && (
                            <span className={styles.badgeEmpty}>—</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.tableCell}>
                        <Link
                          href={`/dashboard/residents/${r.id}`}
                          className={styles.viewButton}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className={styles.cardList}>
            {residents.map(r => {
              const fullName = `${r.first_name} ${r.last_name}`
              const avatarColor = getAvatarColor(fullName)
              const initials = getInitials(r.first_name, r.last_name)
              const age = getAge(r.date_of_birth)
              const tags = [
                r.is_pwd && 'PWD',
                r.is_senior_citizen && 'Senior',
                r.is_voter && 'Voter',
                r.is_4ps_beneficiary && '4Ps',
                r.is_indigent && 'Indigent',
                r.is_solo_parent && 'Solo Parent',
                r.is_ofw && 'OFW',
              ].filter(Boolean) as string[]
              return (
                <div key={r.id} className={styles.residentCard}>
                  <div
                    className={styles.cardAvatar}
                    style={{ background: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div className={styles.cardBody}>
                    <p className={styles.cardName}>
                      {r.last_name}, {r.first_name}{' '}
                      {r.middle_name ? r.middle_name[0] + '.' : ''}{' '}
                      {r.suffix ?? ''}
                    </p>
                    <div className={styles.cardMeta}>
                      <span>{age} yrs</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span>{r.sex}</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span>{(r.purok as any)?.name ?? 'No Purok'}</span>
                      <span className={styles.cardMetaDot}>•</span>
                      <span>{r.civil_status}</span>
                    </div>
                    <div className={styles.cardBadges}>
                      {tags.map(tag => (
                        <span key={tag} className={styles.badge}>{tag}</span>
                      ))}
                    </div>
                    <Link
                      href={`/dashboard/residents/${r.id}`}
                      className={styles.cardViewButton}
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        )}
      </div>
    </div>
  )
}
