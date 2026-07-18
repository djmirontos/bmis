'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, Download, Users, Home, FileText, AlertTriangle, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useSettings } from '@/lib/settings-context'
import styles from './styles/reports.module.css'

// ── Types ──────────────────────────────────────────────────
type Tab = 'population' | 'documents' | 'blotter' | 'households' | 'officials'

const ALLOWED_ROLES = ['super_admin', 'captain', 'secretary', 'treasurer', 'kagawad']

interface OfficialsReportData {
  totalOfficials: number
  totalSK: number
  totalTanod: number
  expiringWithin90: number
  officials: {
    id: string
    full_name: string
    position: string
    committee: string | null
    term_start: string
    term_end: string
    is_active: boolean
    contact_number: string | null
  }[]
  skOfficials: {
    id: string
    full_name: string
    position: string
    committee: string | null
    term_start: string
    term_end: string
    is_active: boolean
    contact_number: string | null
  }[]
  tanod: {
    id: string
    full_name: string
    tanod_id_number: string
    status: string
    date_appointed: string | null
    contact_number: string | null
  }[]
  tanodByStatus: { status: string; count: number }[]
}

interface HouseholdReportData {
  total: number
  active: number
  vacant: number
  demolished: number
  transferred: number
  condemned: number
  avgSize: string
  byPurok: { purok: string; total: number; active: number }[]
  byDwellingType: { type: string; count: number }[]
  byWaterSource: { source: string; count: number }[]
  byStatus: { status: string; count: number }[]
  fourPsHouseholds: number
}

interface BlotterReportData {
  total: number
  byStatus: { status: string; count: number }[]
  byIncidentType: { type: string; count: number }[]
  byMonth: { month: string; monthNum: number; count: number }[]
  active: number
  resolved: number
  referredToCourt: number
  dismissed: number
  settled: number
  resolutionRate: string
}

interface DocIssuanceData {
  totalIssued: number
  totalVoided: number
  totalFees: number
  byType: {
    type: string
    issued: number
    voided: number
    fees: number
  }[]
  byMonth: {
    month: string
    monthNum: number
    count: number
    fees: number
  }[]
  byStatus: { status: string; count: number }[]
  topType: string
}

interface PopulationData {
  total: number
  male: number
  female: number
  // Age groups (Philippine Stats)
  age0to14: number
  age15to64: number
  age65plus: number
  // Classifications
  voters: number
  pwd: number
  senior: number
  fourPs: number
  indigent: number
  soloParent: number
  ofw: number
  deceased: number
  transferred: number
  // By purok
  byPurok: { purok: string; male: number; female: number; total: number }[]
  // Civil status
  byCivilStatus: { status: string; count: number }[]
  // Employment
  byEmployment: { status: string; count: number }[]
}

// ── Helpers ────────────────────────────────────────────────
function calcAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function pct(part: number, total: number): string {
  if (!total) return '0%'
  return ((part / total) * 100).toFixed(1) + '%'
}

function exportCSV(data: PopulationData, year: number) {
  const rows: string[][] = [
    ['POPULATION & DEMOGRAPHICS REPORT'],
    [`As of: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
    [`Reference Year: ${year}`],
    [],
    ['OVERALL SUMMARY'],
    ['Indicator', 'Count', 'Percentage'],
    ['Total Residents', String(data.total), '100%'],
    ['Male', String(data.male), pct(data.male, data.total)],
    ['Female', String(data.female), pct(data.female, data.total)],
    [],
    ['AGE GROUPS (Philippine Standard)'],
    ['Age Group', 'Count', 'Percentage'],
    ['0–14 (Children/Youth)', String(data.age0to14), pct(data.age0to14, data.total)],
    ['15–64 (Working Age)', String(data.age15to64), pct(data.age15to64, data.total)],
    ['65+ (Senior/Elderly)', String(data.age65plus), pct(data.age65plus, data.total)],
    [],
    ['CLASSIFICATIONS'],
    ['Classification', 'Count', 'Percentage'],
    ['Registered Voters', String(data.voters), pct(data.voters, data.total)],
    ['PWD', String(data.pwd), pct(data.pwd, data.total)],
    ['Senior Citizens', String(data.senior), pct(data.senior, data.total)],
    ['4Ps Beneficiaries', String(data.fourPs), pct(data.fourPs, data.total)],
    ['Indigent', String(data.indigent), pct(data.indigent, data.total)],
    ['Solo Parent', String(data.soloParent), pct(data.soloParent, data.total)],
    ['OFW', String(data.ofw), pct(data.ofw, data.total)],
    [],
    ['CIVIL STATUS'],
    ['Status', 'Count', 'Percentage'],
    ...data.byCivilStatus.map(r => [r.status, String(r.count), pct(r.count, data.total)]),
    [],
    ['EMPLOYMENT STATUS'],
    ['Status', 'Count', 'Percentage'],
    ...data.byEmployment.map(r => [r.status, String(r.count), pct(r.count, data.total)]),
    [],
    ['BY PUROK'],
    ['Purok', 'Male', 'Female', 'Total', '% of Total'],
    ...data.byPurok.map(r => [r.purok, String(r.male), String(r.female), String(r.total), pct(r.total, data.total)]),
    ['TOTAL', String(data.male), String(data.female), String(data.total), '100%'],
  ]

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `population-report-${year}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportDocCSV(data: DocIssuanceData, year: number, month: number | 'all') {
  const period = month === 'all' ? `Year ${year}` : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(month)-1]} ${year}`
  const rows: string[][] = [
    ['DOCUMENT ISSUANCE SUMMARY REPORT'],
    [`Period: ${period}`],
    [`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Total Issued', String(data.totalIssued)],
    ['Total Voided', String(data.totalVoided)],
    ['Total Fees Collected', `PHP ${data.totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
    ['Most Issued Document', data.topType],
    [],
    ['BY DOCUMENT TYPE'],
    ['Document Type', 'Issued', 'Voided', 'Fees Collected'],
    ...data.byType.map(r => [r.type, String(r.issued), String(r.voided), `PHP ${r.fees.toFixed(2)}`]),
    [],
    ['MONTHLY TREND'],
    ['Month', 'Documents Issued', 'Fees Collected'],
    ...data.byMonth.map(r => [r.month, String(r.count), `PHP ${r.fees.toFixed(2)}`]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `document-issuance-${year}${month !== 'all' ? `-${String(month).padStart(2,'0')}` : ''}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportBlotterCSV(data: BlotterReportData, year: number, status: string) {
  const rows: string[][] = [
    ['BLOTTER & INCIDENT REPORT'],
    [`Year: ${year}${status !== 'all' ? ` | Status: ${status}` : ''}`],
    [`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Total Cases', String(data.total)],
    ['Active Cases', String(data.active)],
    ['Settled', String(data.settled)],
    ['Referred to Court', String(data.referredToCourt)],
    ['Dismissed', String(data.dismissed)],
    ['Resolution Rate', data.resolutionRate],
    [],
    ['BY STATUS'],
    ['Status', 'Count'],
    ...data.byStatus.map(r => [r.status, String(r.count)]),
    [],
    ['BY INCIDENT TYPE'],
    ['Incident Type', 'Count'],
    ...data.byIncidentType.map(r => [r.type, String(r.count)]),
    [],
    ['MONTHLY TREND'],
    ['Month', 'Cases'],
    ...data.byMonth.map(r => [r.month, String(r.count)]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `blotter-report-${year}${status !== 'all' ? `-${status.replace(/\s+/g,'-')}` : ''}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportHouseholdCSV(data: HouseholdReportData) {
  const rows: string[][] = [
    ['HOUSEHOLD STATISTICS REPORT'],
    [`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
    [],
    ['SUMMARY'],
    ['Metric', 'Value'],
    ['Total Households', String(data.total)],
    ['Active', String(data.active)],
    ['Vacant', String(data.vacant)],
    ['Demolished', String(data.demolished)],
    ['Transferred', String(data.transferred)],
    ['Condemned', String(data.condemned)],
    ['Average Household Size', data.avgSize],
    ['4Ps Beneficiary Households', String(data.fourPsHouseholds)],
    [],
    ['BY PUROK'],
    ['Purok', 'Total', 'Active'],
    ...data.byPurok.map(r => [r.purok, String(r.total), String(r.active)]),
    [],
    ['BY DWELLING TYPE'],
    ['Dwelling Type', 'Count'],
    ...data.byDwellingType.map(r => [r.type, String(r.count)]),
    [],
    ['BY WATER SOURCE'],
    ['Water Source', 'Count'],
    ...data.byWaterSource.map(r => [r.source, String(r.count)]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `household-statistics-${new Date().getFullYear()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function exportOfficialsCSV(data: OfficialsReportData, filter: string) {
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-PH') : 'N/A'
  const rows: string[][] = [
    ['OFFICIALS & TANOD ROSTER REPORT'],
    [`Filter: ${filter === 'active' ? 'Active Only' : 'All Records'}`],
    [`Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`],
    [],
    ['BARANGAY OFFICIALS'],
    ['Name', 'Position', 'Committee', 'Term Start', 'Term End', 'Status'],
    ...data.officials.map(o => [
      o.full_name, o.position, o.committee ?? 'N/A',
      formatDate(o.term_start), formatDate(o.term_end),
      o.is_active ? 'Active' : 'Inactive',
    ]),
    [],
    ['SK OFFICIALS'],
    ['Name', 'Position', 'Committee', 'Term Start', 'Term End', 'Status'],
    ...data.skOfficials.map(o => [
      o.full_name, o.position, o.committee ?? 'N/A',
      formatDate(o.term_start), formatDate(o.term_end),
      o.is_active ? 'Active' : 'Inactive',
    ]),
    [],
    ['BARANGAY TANOD'],
    ['Tanod ID', 'Name', 'Status', 'Date Appointed', 'Contact'],
    ...data.tanod.map(t => [
      t.tanod_id_number, t.full_name, t.status,
      formatDate(t.date_appointed), t.contact_number ?? 'N/A',
    ]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `officials-roster-${new Date().getFullYear()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ──────────────────────────────────────────────
export default function ReportsPage() {
  const router = useRouter()
  const { settings } = useSettings()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<Tab>('population')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [roleLoading, setRoleLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [popData, setPopData] = useState<PopulationData | null>(null)
  const [docData, setDocData] = useState<DocIssuanceData | null>(null)
  const [docYear, setDocYear] = useState(new Date().getFullYear())
  const [docMonth, setDocMonth] = useState<number | 'all'>('all')
  const [blotterData, setBlotterData] = useState<BlotterReportData | null>(null)
  const [blotterYear, setBlotterYear] = useState(new Date().getFullYear())
  const [blotterStatus, setBlotterStatus] = useState<string>('all')
  const [householdData, setHouseholdData] = useState<HouseholdReportData | null>(null)
  const [officialsData, setOfficialsData] = useState<OfficialsReportData | null>(null)
  const [officialsFilter, setOfficialsFilter] = useState<'active' | 'all'>('active')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // ── Role check ──
  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setUserRole(data?.role ?? null)
      setRoleLoading(false)
    }
    checkRole()
  }, [])

  // ── Load Population Data ──
  const loadPopulation = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch all active residents (not deceased, not transferred)
      const { data: residents, error } = await supabase
        .from('residents')
        .select(`
          id, sex, date_of_birth, civil_status, employment_status,
          is_voter, is_pwd, is_senior_citizen, is_4ps_beneficiary,
          is_indigent, is_solo_parent, is_ofw,
          is_deceased, is_transferred,
          purok_id, purok:puroks(name)
        `)

      if (error) throw error

      const all = residents ?? []
      const active = all.filter(r => !r.is_deceased && !r.is_transferred)
      const total = active.length
      const male = active.filter(r => r.sex === 'Male').length
      const female = active.filter(r => r.sex === 'Female').length

      // Age groups
      let age0to14 = 0, age15to64 = 0, age65plus = 0
      active.forEach(r => {
        if (!r.date_of_birth) return
        const age = calcAge(r.date_of_birth)
        if (age <= 14) age0to14++
        else if (age <= 64) age15to64++
        else age65plus++
      })

      // Classifications
      const voters = active.filter(r => r.is_voter).length
      const pwd = active.filter(r => r.is_pwd).length
      const senior = active.filter(r => r.is_senior_citizen).length
      const fourPs = active.filter(r => r.is_4ps_beneficiary).length
      const indigent = active.filter(r => r.is_indigent).length
      const soloParent = active.filter(r => r.is_solo_parent).length
      const ofw = active.filter(r => r.is_ofw).length
      const deceased = all.filter(r => r.is_deceased).length
      const transferred = all.filter(r => r.is_transferred).length

      // Civil status
      const civilMap: Record<string, number> = {}
      active.forEach(r => {
        const s = r.civil_status ?? 'Unknown'
        civilMap[s] = (civilMap[s] ?? 0) + 1
      })
      const byCivilStatus = Object.entries(civilMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)

      // Employment
      const empMap: Record<string, number> = {}
      active.forEach(r => {
        const s = r.employment_status ?? 'Not Specified'
        empMap[s] = (empMap[s] ?? 0) + 1
      })
      const byEmployment = Object.entries(empMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)

      // By purok
      const purokMap: Record<string, { purok: string; male: number; female: number; total: number }> = {}
      active.forEach(r => {
        const name = (r.purok as any)?.name ?? 'No Purok'
        if (!purokMap[name]) purokMap[name] = { purok: name, male: 0, female: 0, total: 0 }
        purokMap[name].total++
        if (r.sex === 'Male') purokMap[name].male++
        else purokMap[name].female++
      })
      const byPurok = Object.values(purokMap).sort((a, b) => b.total - a.total)

      setPopData({
        total, male, female,
        age0to14, age15to64, age65plus,
        voters, pwd, senior, fourPs, indigent, soloParent, ofw,
        deceased, transferred,
        byPurok, byCivilStatus, byEmployment,
      })
    } catch (err) {
      console.error('Error loading population data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Load Document Issuance Data ──
  const loadDocuments = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('issued_documents')
        .select('document_type, status, fee_paid, issued_date, void_reason')
        .gte('issued_date', `${docYear}-01-01`)
        .lte('issued_date', `${docYear}-12-31`)

      if (docMonth !== 'all') {
        const mm = String(docMonth).padStart(2, '0')
        const lastDay = new Date(docYear, docMonth, 0).getDate()
        query = query
          .gte('issued_date', `${docYear}-${mm}-01`)
          .lte('issued_date', `${docYear}-${mm}-${lastDay}`)
      }

      const { data: docs, error } = await query
      if (error) throw error

      const all = docs ?? []
      const issued = all.filter(d => d.status !== 'Voided')
      const voided = all.filter(d => d.status === 'Voided')
      const totalFees = issued.reduce((sum, d) => sum + (d.fee_paid ?? 0), 0)

      // By document type
      const typeMap: Record<string, { issued: number; voided: number; fees: number }> = {}
      all.forEach(d => {
        if (!typeMap[d.document_type]) typeMap[d.document_type] = { issued: 0, voided: 0, fees: 0 }
        if (d.status === 'Voided') typeMap[d.document_type].voided++
        else {
          typeMap[d.document_type].issued++
          typeMap[d.document_type].fees += d.fee_paid ?? 0
        }
      })
      const byType = Object.entries(typeMap)
        .map(([type, v]) => ({ type, ...v }))
        .sort((a, b) => b.issued - a.issued)

      // By month
      const monthMap: Record<number, { count: number; fees: number }> = {}
      issued.forEach(d => {
        const m = new Date(d.issued_date).getMonth() + 1
        if (!monthMap[m]) monthMap[m] = { count: 0, fees: 0 }
        monthMap[m].count++
        monthMap[m].fees += d.fee_paid ?? 0
      })
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const byMonth = Array.from({ length: 12 }, (_, i) => ({
        month: monthNames[i],
        monthNum: i + 1,
        count: monthMap[i + 1]?.count ?? 0,
        fees: monthMap[i + 1]?.fees ?? 0,
      }))

      // By status
      const statusMap: Record<string, number> = {}
      all.forEach(d => { statusMap[d.status] = (statusMap[d.status] ?? 0) + 1 })
      const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }))

      const topType = byType[0]?.type ?? 'N/A'

      setDocData({
        totalIssued: issued.length,
        totalVoided: voided.length,
        totalFees,
        byType,
        byMonth,
        byStatus,
        topType,
      })
    } catch (err) {
      console.error('Error loading document data:', err)
    } finally {
      setLoading(false)
    }
  }, [docYear, docMonth])

    // ── Load Blotter Data ──
  const loadBlotter = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('blotter_records')
        .select('id, status, incident_type_name, incident_date, created_at, resolution_date')
        .gte('incident_date', `${blotterYear}-01-01`)
        .lte('incident_date', `${blotterYear}-12-31`)

      if (blotterStatus !== 'all') {
        query = query.eq('status', blotterStatus)
      }

      const { data: records, error } = await query
      if (error) throw error

      const all = records ?? []
      const total = all.length

      // By status
      const statusMap: Record<string, number> = {}
      all.forEach(r => { statusMap[r.status] = (statusMap[r.status] ?? 0) + 1 })
      const byStatus = Object.entries(statusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)

      // By incident type
      const typeMap: Record<string, number> = {}
      all.forEach(r => {
        const t = r.incident_type_name ?? 'Unknown'
        typeMap[t] = (typeMap[t] ?? 0) + 1
      })
      const byIncidentType = Object.entries(typeMap)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)

      // By month (based on incident_date)
      const monthMap: Record<number, number> = {}
      all.forEach(r => {
        if (!r.incident_date) return
        const m = new Date(r.incident_date).getMonth() + 1
        monthMap[m] = (monthMap[m] ?? 0) + 1
      })
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const byMonth = Array.from({ length: 12 }, (_, i) => ({
        month: monthNames[i],
        monthNum: i + 1,
        count: monthMap[i + 1] ?? 0,
      }))

      // Resolution counts
      const active = all.filter(r => ['Filed', 'Summoned', 'Mediation Scheduled'].includes(r.status)).length
      const settled = all.filter(r => r.status === 'Settled').length
      const referredToCourt = all.filter(r => r.status === 'Referred to Court').length
      const dismissed = all.filter(r => r.status === 'Dismissed').length
      const resolved = settled + referredToCourt + dismissed
      const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0%'

      setBlotterData({
        total, byStatus, byIncidentType, byMonth,
        active, resolved, referredToCourt, dismissed,
        settled, resolutionRate,
      })
    } catch (err) {
      console.error('Error loading blotter data:', err)
    } finally {
      setLoading(false)
    }
  }, [blotterYear, blotterStatus])

    // ── Load Household Data ──
  const loadHouseholds = useCallback(async () => {
    setLoading(true)
    try {
      const { data: households, error: hhError } = await supabase
        .from('households')
        .select(`
          id, status, dwelling_type, water_source,
          is_4ps_beneficiary, purok_id,
          purok:puroks(name)
        `)

      if (hhError) throw hhError

      const { data: residents, error: resError } = await supabase
        .from('residents')
        .select('household_id')
        .eq('is_deceased', false)
        .eq('is_transferred', false)
        .not('household_id', 'is', null)

      if (resError) throw resError

      const all = households ?? []
      const total = all.length
      const active = all.filter(h => h.status === 'Active').length
      const vacant = all.filter(h => h.status === 'Vacant').length
      const demolished = all.filter(h => h.status === 'Demolished').length
      const transferred = all.filter(h => h.status === 'Transferred').length
      const condemned = all.filter(h => h.status === 'Condemned').length
      const fourPsHouseholds = all.filter(h => h.is_4ps_beneficiary).length

      // Average household size (active households only)
      const residentCountMap: Record<string, number> = {}
      ;(residents ?? []).forEach(r => {
        if (r.household_id) residentCountMap[r.household_id] = (residentCountMap[r.household_id] ?? 0) + 1
      })
      const activeHouseholds = all.filter(h => h.status === 'Active')
      const totalResidentsInHH = activeHouseholds.reduce((sum, h) => sum + (residentCountMap[h.id] ?? 0), 0)
      const avgSize = active > 0 ? (totalResidentsInHH / active).toFixed(1) : '0'

      // By status
      const statusMap: Record<string, number> = {}
      all.forEach(h => { statusMap[h.status] = (statusMap[h.status] ?? 0) + 1 })
      const byStatus = Object.entries(statusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)

      // By purok
      const purokMap: Record<string, { purok: string; total: number; active: number }> = {}
      all.forEach(h => {
        const name = (h.purok as any)?.name ?? 'No Purok'
        if (!purokMap[name]) purokMap[name] = { purok: name, total: 0, active: 0 }
        purokMap[name].total++
        if (h.status === 'Active') purokMap[name].active++
      })
      const byPurok = Object.values(purokMap).sort((a, b) => b.total - a.total)

      // By dwelling type
      const dwellingMap: Record<string, number> = {}
      all.forEach(h => {
        const t = h.dwelling_type ?? 'Not Specified'
        dwellingMap[t] = (dwellingMap[t] ?? 0) + 1
      })
      const byDwellingType = Object.entries(dwellingMap)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count)

      // By water source
      const waterMap: Record<string, number> = {}
      all.forEach(h => {
        const s = h.water_source ?? 'Not Specified'
        waterMap[s] = (waterMap[s] ?? 0) + 1
      })
      const byWaterSource = Object.entries(waterMap)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count)

      setHouseholdData({
        total, active, vacant, demolished, transferred, condemned,
        avgSize, byPurok, byDwellingType, byWaterSource, byStatus,
        fourPsHouseholds,
      })
    } catch (err) {
      console.error('Error loading household data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

    // ── Load Officials Data ──
  const loadOfficials = useCallback(async () => {
    setLoading(true)
    try {
      let officialsQuery = supabase
        .from('barangay_officials')
        .select('id, full_name, position, committee, term_start, term_end, is_active, contact_number')
        .order('position')

      let skQuery = supabase
        .from('sk_officials')
        .select('id, full_name, position, committee, term_start, term_end, is_active, contact_number')
        .order('position')

      let tanodQuery = supabase
        .from('barangay_tanod')
        .select('id, full_name, tanod_id_number, status, date_appointed, contact_number')
        .order('full_name')

      if (officialsFilter === 'active') {
        officialsQuery = officialsQuery.eq('is_active', true)
        skQuery = skQuery.eq('is_active', true)
        tanodQuery = tanodQuery.eq('status', 'Active')
      }

      const [
        { data: officials, error: e1 },
        { data: skOfficials, error: e2 },
        { data: tanod, error: e3 },
      ] = await Promise.all([officialsQuery, skQuery, tanodQuery])

      if (e1) throw e1
      if (e2) throw e2
      if (e3) throw e3

      // Expiring within 90 days (active officials + SK)
      const today = new Date()
      const in90 = new Date()
      in90.setDate(today.getDate() + 90)

      const allActive = [
        ...(officials ?? []).filter(o => o.is_active),
        ...(skOfficials ?? []).filter(o => o.is_active),
      ]
      const expiringWithin90 = allActive.filter(o => {
        const end = new Date(o.term_end)
        return end >= today && end <= in90
      }).length

      // Tanod by status
      const tanodStatusMap: Record<string, number> = {}
      ;(tanod ?? []).forEach(t => {
        tanodStatusMap[t.status] = (tanodStatusMap[t.status] ?? 0) + 1
      })
      const tanodByStatus = Object.entries(tanodStatusMap)
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)

      setOfficialsData({
        totalOfficials: (officials ?? []).length,
        totalSK: (skOfficials ?? []).length,
        totalTanod: (tanod ?? []).length,
        expiringWithin90,
        officials: officials ?? [],
        skOfficials: skOfficials ?? [],
        tanod: tanod ?? [],
        tanodByStatus,
      })
    } catch (err) {
      console.error('Error loading officials data:', err)
    } finally {
      setLoading(false)
    }
  }, [officialsFilter])

     useEffect(() => {
    if (!userRole || !ALLOWED_ROLES.includes(userRole)) return
    if (activeTab === 'population') loadPopulation()
    if (activeTab === 'documents') loadDocuments()
    if (activeTab === 'blotter') loadBlotter()
    if (activeTab === 'households') loadHouseholds()
    if (activeTab === 'officials') loadOfficials()
  }, [activeTab, userRole, selectedYear, docYear, docMonth, blotterYear, blotterStatus, officialsFilter])

  // ── Render guards ──
  if (roleLoading) return <div className={styles.loading}>Checking access...</div>
  if (!userRole || !ALLOWED_ROLES.includes(userRole)) {
    return (
      <div className={styles.accessDenied}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view reports.</p>
      </div>
    )
  }

  const barangayName = settings?.barangay_name ?? 'Barangay IV'
  const city = settings?.city ?? 'Tangub City'

  // ── Print handler ──
  function handlePrint() {
    const params = new URLSearchParams({ year: String(selectedYear) })
    window.open(`/print/reports/population?${params.toString()}`, '_blank')
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Reports & Analytics</h1>
        <p>{barangayName}, {city} — Data as of {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {([
          { key: 'population', label: '👥 Population & Demographics' },
          { key: 'documents',  label: '📄 Document Issuance' },
          { key: 'blotter',    label: '⚖️ Blotter & Incidents' },
          { key: 'households', label: '🏠 Household Statistics' },
          { key: 'officials',  label: '🛡️ Officials & Tanod' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            className={`${styles.tab} ${activeTab === t.key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ POPULATION TAB ══ */}
      {activeTab === 'population' && (
        <>
          {/* Toolbar */}
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.filterLabel}>Year:</span>
              <select
                className={styles.select}
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className={styles.asOfBadge}>
                Active residents only (excludes deceased & transferred)
              </span>
            </div>
            <div className={styles.toolbarRight}>
              <button className={styles.btnPrint} onClick={handlePrint}>
                <Printer size={15} /> Print / PDF
              </button>
              {popData && (
                <button className={styles.btnCsv} onClick={() => exportCSV(popData, selectedYear)}>
                  <Download size={15} /> Export CSV
                </button>
              )}
            </div>
          </div>

          {loading && <div className={styles.loading}>Loading population data...</div>}

          {!loading && popData && (
            <>
              {/* Summary Cards */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{popData.total.toLocaleString()}</div>
                  <div className={styles.statLabel}>Total Residents</div>
                  <div className={styles.statSub}>Active population</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{popData.male.toLocaleString()}</div>
                  <div className={styles.statLabel}>Male</div>
                  <div className={styles.statSub}>{pct(popData.male, popData.total)}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{popData.female.toLocaleString()}</div>
                  <div className={styles.statLabel}>Female</div>
                  <div className={styles.statSub}>{pct(popData.female, popData.total)}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{popData.age65plus.toLocaleString()}</div>
                  <div className={styles.statLabel}>Senior Citizens (65+)</div>
                  <div className={styles.statSub}>{pct(popData.age65plus, popData.total)}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{popData.voters.toLocaleString()}</div>
                  <div className={styles.statLabel}>Registered Voters</div>
                  <div className={styles.statSub}>{pct(popData.voters, popData.total)}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{popData.deceased.toLocaleString()}</div>
                  <div className={styles.statLabel}>Deceased (on record)</div>
                  <div className={styles.statSub}>{popData.transferred} transferred</div>
                </div>
              </div>

              {/* Age + Sex */}
              <div className={styles.twoCol}>
                {/* Age Groups */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Age Group Distribution (Phil. Standard)</h3>
                  <div className={styles.barChart}>
                    {[
                      { label: '0–14 (Youth)', value: popData.age0to14 },
                      { label: '15–64 (Working Age)', value: popData.age15to64 },
                      { label: '65+ (Elderly)', value: popData.age65plus },
                    ].map(row => (
                      <div key={row.label} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.label}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: popData.total ? `${(row.value / popData.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>{row.value} <small style={{color:'#999',fontWeight:400}}>({pct(row.value, popData.total)})</small></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sex Breakdown */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Sex Distribution</h3>
                  <div className={styles.barChart}>
                    {[
                      { label: 'Male', value: popData.male },
                      { label: 'Female', value: popData.female },
                    ].map((row, i) => (
                      <div key={row.label} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.label}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: popData.total ? `${(row.value / popData.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>{row.value} <small style={{color:'#999',fontWeight:400}}>({pct(row.value, popData.total)})</small></span>
                      </div>
                    ))}
                  </div>

                  <h3 className={styles.sectionTitle} style={{ marginTop: '1.5rem' }}>Civil Status</h3>
                  <div className={styles.barChart}>
                    {popData.byCivilStatus.map((row, i) => (
                      <div key={row.status} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.status}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: popData.total ? `${(row.count / popData.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>{row.count} <small style={{color:'#999',fontWeight:400}}>({pct(row.count, popData.total)})</small></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Classifications */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Resident Classifications</h3>
                <div className={styles.classGrid}>
                  {[
                    { label: 'Registered Voters', value: popData.voters },
                    { label: 'PWD', value: popData.pwd },
                    { label: 'Senior Citizens', value: popData.senior },
                    { label: '4Ps Beneficiaries', value: popData.fourPs },
                    { label: 'Indigent', value: popData.indigent },
                    { label: 'Solo Parent', value: popData.soloParent },
                    { label: 'OFW', value: popData.ofw },
                  ].map(item => (
                    <div key={item.label} className={styles.classCard}>
                      <div className={styles.classNum}>{item.value.toLocaleString()}</div>
                      <div className={styles.classLabel}>{item.label}</div>
                      <div className={styles.statSub}>{pct(item.value, popData.total)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employment */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Employment Status</h3>
                <div className={styles.barChart}>
                  {popData.byEmployment.map((row, i) => (
                    <div key={row.status} className={styles.barRow}>
                      <span className={styles.barLabel}>{row.status}</span>
                      <div className={styles.barTrack}>
                        <div
                          className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                          style={{ width: popData.total ? `${(row.count / popData.total) * 100}%` : '0%' }}
                        />
                      </div>
                      <span className={styles.barValue}>{row.count} <small style={{color:'#999',fontWeight:400}}>({pct(row.count, popData.total)})</small></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Purok Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Population by Purok</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Purok</th>
                      <th>Male</th>
                      <th>Female</th>
                      <th>Total</th>
                      <th>% of Population</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popData.byPurok.map(row => (
                      <tr key={row.purok}>
                        <td>{row.purok}</td>
                        <td>{row.male}</td>
                        <td>{row.female}</td>
                        <td><strong>{row.total}</strong></td>
                        <td>{pct(row.total, popData.total)}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className={styles.tableTotal}>TOTAL</td>
                      <td className={styles.tableTotal}>{popData.male}</td>
                      <td className={styles.tableTotal}>{popData.female}</td>
                      <td className={styles.tableTotal}>{popData.total}</td>
                      <td className={styles.tableTotal}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

     {/* ══ DOCUMENT ISSUANCE TAB ══ */}
      {activeTab === 'documents' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.filterLabel}>Year:</span>
              <select className={styles.select} value={docYear} onChange={e => setDocYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className={styles.filterLabel}>Month:</span>
              <select className={styles.select} value={docMonth} onChange={e => setDocMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                <option value="all">All Months</option>
                {['January','February','March','April','May','June','July','August','September','October','November','December']
                  .map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className={styles.toolbarRight}>
              <button className={styles.btnPrint} onClick={() => window.open(`/print/reports/documents?year=${docYear}&month=${docMonth}`, '_blank')}>
                <Printer size={15} /> Print / PDF
              </button>
              {docData && (
                <button className={styles.btnCsv} onClick={() => exportDocCSV(docData, docYear, docMonth)}>
                  <Download size={15} /> Export CSV
                </button>
              )}
            </div>
          </div>

          {loading && <div className={styles.loading}>Loading document data...</div>}

          {!loading && docData && (
            <>
              {/* Summary Cards */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{docData.totalIssued.toLocaleString()}</div>
                  <div className={styles.statLabel}>Total Issued</div>
                  <div className={styles.statSub}>Excluding voided</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{docData.totalVoided.toLocaleString()}</div>
                  <div className={styles.statLabel}>Total Voided</div>
                  <div className={styles.statSub}>{docData.totalIssued + docData.totalVoided} total transactions</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>
                    ₱{docData.totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                  <div className={styles.statLabel}>Fees Collected</div>
                  <div className={styles.statSub}>From issued docs only</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber} style={{ fontSize: '1rem', paddingTop: '0.5rem' }}>
                    {docData.topType.replace('Certificate of ', 'Cert. of ').replace('Barangay ', 'Brgy. ')}
                  </div>
                  <div className={styles.statLabel}>Most Issued</div>
                  <div className={styles.statSub}>{docData.byType[0]?.issued ?? 0} documents</div>
                </div>
              </div>

              {/* By Type + Monthly Trend */}
              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>By Document Type</h3>
                  <div className={styles.barChart}>
                    {docData.byType.map((row, i) => (
                      <div key={row.type} className={styles.barRow}>
                        <span className={styles.barLabel} title={row.type}>
                          {row.type.replace('Certificate of ', '').replace('Barangay ', 'Brgy. ')}
                        </span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: docData.totalIssued ? `${(row.issued / docData.totalIssued) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>
                          {row.issued} <small style={{ color: '#999', fontWeight: 400 }}>({row.voided} void)</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Monthly Trend ({docYear})</h3>
                  <div className={styles.barChart}>
                    {docData.byMonth.map((row, i) => (
                      <div key={row.month} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.month}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: Math.max(...docData.byMonth.map(m => m.count)) > 0 ? `${(row.count / Math.max(...docData.byMonth.map(m => m.count))) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detailed Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Document Type Breakdown</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Document Type</th>
                      <th>Issued</th>
                      <th>Voided</th>
                      <th>Total Transactions</th>
                      <th>Fees Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docData.byType.map(row => (
                      <tr key={row.type}>
                        <td>{row.type}</td>
                        <td>{row.issued}</td>
                        <td>{row.voided}</td>
                        <td>{row.issued + row.voided}</td>
                        <td>₱{row.fees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className={styles.tableTotal}>TOTAL</td>
                      <td className={styles.tableTotal}>{docData.totalIssued}</td>
                      <td className={styles.tableTotal}>{docData.totalVoided}</td>
                      <td className={styles.tableTotal}>{docData.totalIssued + docData.totalVoided}</td>
                      <td className={styles.tableTotal}>₱{docData.totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ BLOTTER TAB ══ */}
      {activeTab === 'blotter' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.filterLabel}>Year:</span>
              <select className={styles.select} value={blotterYear} onChange={e => setBlotterYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span className={styles.filterLabel}>Status:</span>
              <select className={styles.select} value={blotterStatus} onChange={e => setBlotterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                {['Filed','Summoned','Mediation Scheduled','Settled','Referred to Court','Dismissed'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className={styles.toolbarRight}>
              <button className={styles.btnPrint} onClick={() => window.open(`/print/reports/blotter?year=${blotterYear}&status=${blotterStatus}`, '_blank')}>
                <Printer size={15} /> Print / PDF
              </button>
              {blotterData && (
                <button className={styles.btnCsv} onClick={() => exportBlotterCSV(blotterData, blotterYear, blotterStatus)}>
                  <Download size={15} /> Export CSV
                </button>
              )}
            </div>
          </div>

          {loading && <div className={styles.loading}>Loading blotter data...</div>}

          {!loading && blotterData && (
            <>
              {/* Summary Cards */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{blotterData.total}</div>
                  <div className={styles.statLabel}>Total Cases</div>
                  <div className={styles.statSub}>For {blotterYear}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{blotterData.active}</div>
                  <div className={styles.statLabel}>Active Cases</div>
                  <div className={styles.statSub}>Filed / Summoned / Mediation</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{blotterData.settled}</div>
                  <div className={styles.statLabel}>Settled</div>
                  <div className={styles.statSub}>Amicable settlement</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{blotterData.referredToCourt}</div>
                  <div className={styles.statLabel}>Referred to Court</div>
                  <div className={styles.statSub}>Escalated cases</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{blotterData.dismissed}</div>
                  <div className={styles.statLabel}>Dismissed</div>
                  <div className={styles.statSub}>Cases closed</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{blotterData.resolutionRate}</div>
                  <div className={styles.statLabel}>Resolution Rate</div>
                  <div className={styles.statSub}>{blotterData.resolved} of {blotterData.total} resolved</div>
                </div>
              </div>

              {/* By Status + Monthly Trend */}
              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Cases by Status</h3>
                  <div className={styles.barChart}>
                    {blotterData.byStatus.map((row, i) => (
                      <div key={row.status} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.status}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: blotterData.total ? `${(row.count / blotterData.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Monthly Trend ({blotterYear})</h3>
                  <div className={styles.barChart}>
                    {blotterData.byMonth.map((row, i) => {
                      const max = Math.max(...blotterData.byMonth.map(m => m.count))
                      return (
                        <div key={row.month} className={styles.barRow}>
                          <span className={styles.barLabel}>{row.month}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                              style={{ width: max > 0 ? `${(row.count / max) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className={styles.barValue}>{row.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* By Incident Type */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Cases by Incident Type</h3>
                <div className={styles.barChart}>
                  {blotterData.byIncidentType.map((row, i) => {
                    const max = blotterData.byIncidentType[0]?.count ?? 1
                    return (
                      <div key={row.type} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.type}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                        <span className={styles.barValue}>{row.count} <small style={{color:'#999',fontWeight:400}}>({blotterData.total ? ((row.count/blotterData.total)*100).toFixed(1) : 0}%)</small></span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Status Summary Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Status Summary</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blotterData.byStatus.map(row => (
                      <tr key={row.status}>
                        <td>{row.status}</td>
                        <td>{row.count}</td>
                        <td>{blotterData.total ? ((row.count / blotterData.total) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    <tr>
                      <td className={styles.tableTotal}>TOTAL</td>
                      <td className={styles.tableTotal}>{blotterData.total}</td>
                      <td className={styles.tableTotal}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

       {/* ══ HOUSEHOLD TAB ══ */}
      {activeTab === 'households' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.asOfBadge}>
                All households regardless of status
              </span>
            </div>
            <div className={styles.toolbarRight}>
              <button className={styles.btnPrint} onClick={() => window.open('/print/reports/households', '_blank')}>
                <Printer size={15} /> Print / PDF
              </button>
              {householdData && (
                <button className={styles.btnCsv} onClick={() => exportHouseholdCSV(householdData)}>
                  <Download size={15} /> Export CSV
                </button>
              )}
            </div>
          </div>

          {loading && <div className={styles.loading}>Loading household data...</div>}

          {!loading && householdData && (
            <>
              {/* Summary Cards */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{householdData.total.toLocaleString()}</div>
                  <div className={styles.statLabel}>Total Households</div>
                  <div className={styles.statSub}>All statuses</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{householdData.active.toLocaleString()}</div>
                  <div className={styles.statLabel}>Active</div>
                  <div className={styles.statSub}>{householdData.total ? ((householdData.active / householdData.total) * 100).toFixed(1) : 0}% of total</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{householdData.vacant.toLocaleString()}</div>
                  <div className={styles.statLabel}>Vacant</div>
                  <div className={styles.statSub}>Unoccupied units</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{householdData.avgSize}</div>
                  <div className={styles.statLabel}>Avg. Household Size</div>
                  <div className={styles.statSub}>Members per active HH</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{householdData.fourPsHouseholds.toLocaleString()}</div>
                  <div className={styles.statLabel}>4Ps Beneficiaries</div>
                  <div className={styles.statSub}>Registered households</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{(householdData.demolished + householdData.condemned + householdData.transferred).toLocaleString()}</div>
                  <div className={styles.statLabel}>Inactive</div>
                  <div className={styles.statSub}>Demolished / Condemned / Transferred</div>
                </div>
              </div>

              {/* By Status + By Purok */}
              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>By Status</h3>
                  <div className={styles.barChart}>
                    {householdData.byStatus.map((row, i) => (
                      <div key={row.status} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.status}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: householdData.total ? `${(row.count / householdData.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>
                          {row.count} <small style={{ color: '#999', fontWeight: 400 }}>({householdData.total ? ((row.count / householdData.total) * 100).toFixed(1) : 0}%)</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>By Purok</h3>
                  <div className={styles.barChart}>
                    {householdData.byPurok.map((row, i) => (
                      <div key={row.purok} className={styles.barRow}>
                        <span className={styles.barLabel}>{row.purok}</span>
                        <div className={styles.barTrack}>
                          <div
                            className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                            style={{ width: householdData.total ? `${(row.total / householdData.total) * 100}%` : '0%' }}
                          />
                        </div>
                        <span className={styles.barValue}>
                          {row.total} <small style={{ color: '#999', fontWeight: 400 }}>({row.active} active)</small>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dwelling Type + Water Source */}
              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>By Dwelling Type</h3>
                  <div className={styles.barChart}>
                    {householdData.byDwellingType.map((row, i) => {
                      const max = householdData.byDwellingType[0]?.count ?? 1
                      return (
                        <div key={row.type} className={styles.barRow}>
                          <span className={styles.barLabel}>{row.type}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                              style={{ width: `${(row.count / max) * 100}%` }}
                            />
                          </div>
                          <span className={styles.barValue}>{row.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>By Water Source</h3>
                  <div className={styles.barChart}>
                    {householdData.byWaterSource.map((row, i) => {
                      const max = householdData.byWaterSource[0]?.count ?? 1
                      return (
                        <div key={row.source} className={styles.barRow}>
                          <span className={styles.barLabel}>{row.source}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                              style={{ width: `${(row.count / max) * 100}%` }}
                            />
                          </div>
                          <span className={styles.barValue}>{row.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Purok Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Household Count by Purok</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Purok</th>
                      <th>Total HH</th>
                      <th>Active</th>
                      <th>Inactive</th>
                      <th>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {householdData.byPurok.map(row => (
                      <tr key={row.purok}>
                        <td>{row.purok}</td>
                        <td>{row.total}</td>
                        <td>{row.active}</td>
                        <td>{row.total - row.active}</td>
                        <td>{householdData.total ? ((row.total / householdData.total) * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                    <tr>
                      <td className={styles.tableTotal}>TOTAL</td>
                      <td className={styles.tableTotal}>{householdData.total}</td>
                      <td className={styles.tableTotal}>{householdData.active}</td>
                      <td className={styles.tableTotal}>{householdData.total - householdData.active}</td>
                      <td className={styles.tableTotal}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* ══ OFFICIALS TAB ══ */}
      {activeTab === 'officials' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.toolbarLeft}>
              <span className={styles.filterLabel}>Show:</span>
              <select
                className={styles.select}
                value={officialsFilter}
                onChange={e => setOfficialsFilter(e.target.value as 'active' | 'all')}
              >
                <option value="active">Active Only</option>
                <option value="all">All Records</option>
              </select>
            </div>
            <div className={styles.toolbarRight}>
              <button className={styles.btnPrint} onClick={() => window.open(`/print/reports/officials?filter=${officialsFilter}`, '_blank')}>
                <Printer size={15} /> Print / PDF
              </button>
              {officialsData && (
                <button className={styles.btnCsv} onClick={() => exportOfficialsCSV(officialsData, officialsFilter)}>
                  <Download size={15} /> Export CSV
                </button>
              )}
            </div>
          </div>

          {loading && <div className={styles.loading}>Loading officials data...</div>}

          {!loading && officialsData && (
            <>
              {/* Summary Cards */}
              <div className={styles.statGrid}>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{officialsData.totalOfficials}</div>
                  <div className={styles.statLabel}>Barangay Officials</div>
                  <div className={styles.statSub}>{officialsFilter === 'active' ? 'Active only' : 'All records'}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{officialsData.totalSK}</div>
                  <div className={styles.statLabel}>SK Officials</div>
                  <div className={styles.statSub}>{officialsFilter === 'active' ? 'Active only' : 'All records'}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber}>{officialsData.totalTanod}</div>
                  <div className={styles.statLabel}>Barangay Tanod</div>
                  <div className={styles.statSub}>{officialsFilter === 'active' ? 'Active only' : 'All records'}</div>
                </div>
                <div className={styles.statCard}>
                  <div className={styles.statNumber} style={{ color: officialsData.expiringWithin90 > 0 ? '#dc2626' : '#16a34a' }}>
                    {officialsData.expiringWithin90}
                  </div>
                  <div className={styles.statLabel}>Expiring in 90 Days</div>
                  <div className={styles.statSub}>Officials & SK combined</div>
                </div>
              </div>

              {/* Barangay Officials Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Barangay Officials</h3>
                {officialsData.officials.length === 0 ? (
                  <div className={styles.emptyState}>No records found.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Committee</th>
                        <th>Term Start</th>
                        <th>Term End</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialsData.officials.map(o => {
                        const daysLeft = Math.ceil((new Date(o.term_end).getTime() - Date.now()) / 86400000)
                        const isExpiring = o.is_active && daysLeft >= 0 && daysLeft <= 90
                        const isExpired = daysLeft < 0
                        return (
                          <tr key={o.id}>
                            <td><strong>{o.full_name}</strong></td>
                            <td>{o.position}</td>
                            <td>{o.committee ?? '—'}</td>
                            <td>{new Date(o.term_start).toLocaleDateString('en-PH')}</td>
                            <td style={{ color: isExpiring ? '#d97706' : isExpired ? '#dc2626' : undefined }}>
                              {new Date(o.term_end).toLocaleDateString('en-PH')}
                              {isExpiring && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#d97706' }}>⚠ {daysLeft}d</span>}
                              {isExpired && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#dc2626' }}>Expired</span>}
                            </td>
                            <td>
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: o.is_active ? '#dcfce7' : '#f3f4f6',
                                color: o.is_active ? '#16a34a' : '#6b7280',
                              }}>
                                {o.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* SK Officials Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>SK Officials</h3>
                {officialsData.skOfficials.length === 0 ? (
                  <div className={styles.emptyState}>No records found.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Position</th>
                        <th>Committee</th>
                        <th>Term Start</th>
                        <th>Term End</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialsData.skOfficials.map(o => {
                        const daysLeft = Math.ceil((new Date(o.term_end).getTime() - Date.now()) / 86400000)
                        const isExpiring = o.is_active && daysLeft >= 0 && daysLeft <= 90
                        const isExpired = daysLeft < 0
                        return (
                          <tr key={o.id}>
                            <td><strong>{o.full_name}</strong></td>
                            <td>{o.position}</td>
                            <td>{o.committee ?? '—'}</td>
                            <td>{new Date(o.term_start).toLocaleDateString('en-PH')}</td>
                            <td style={{ color: isExpiring ? '#d97706' : isExpired ? '#dc2626' : undefined }}>
                              {new Date(o.term_end).toLocaleDateString('en-PH')}
                              {isExpiring && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#d97706' }}>⚠ {daysLeft}d</span>}
                              {isExpired && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', color: '#dc2626' }}>Expired</span>}
                            </td>
                            <td>
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                background: o.is_active ? '#dcfce7' : '#f3f4f6',
                                color: o.is_active ? '#16a34a' : '#6b7280',
                              }}>
                                {o.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Tanod Section */}
              <div className={styles.twoCol}>
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Tanod by Status</h3>
                  <div className={styles.barChart}>
                    {officialsData.tanodByStatus.map((row, i) => {
                      const max = officialsData.tanodByStatus[0]?.count ?? 1
                      return (
                        <div key={row.status} className={styles.barRow}>
                          <span className={styles.barLabel}>{row.status}</span>
                          <div className={styles.barTrack}>
                            <div
                              className={`${styles.barFill} ${i % 2 === 1 ? styles.barFillAlt : ''}`}
                              style={{ width: `${(row.count / max) * 100}%` }}
                            />
                          </div>
                          <span className={styles.barValue}>{row.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Tanod Summary</h3>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialsData.tanodByStatus.map(row => (
                        <tr key={row.status}>
                          <td>{row.status}</td>
                          <td>{row.count}</td>
                          <td>{officialsData.totalTanod ? ((row.count / officialsData.totalTanod) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      ))}
                      <tr>
                        <td className={styles.tableTotal}>TOTAL</td>
                        <td className={styles.tableTotal}>{officialsData.totalTanod}</td>
                        <td className={styles.tableTotal}>100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tanod Roster Table */}
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Barangay Tanod Roster</h3>
                {officialsData.tanod.length === 0 ? (
                  <div className={styles.emptyState}>No records found.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Tanod ID</th>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Date Appointed</th>
                        <th>Contact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officialsData.tanod.map(t => (
                        <tr key={t.id}>
                          <td><code style={{ fontSize: '0.82rem' }}>{t.tanod_id_number}</code></td>
                          <td><strong>{t.full_name}</strong></td>
                          <td>
                            <span style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: '20px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              background: t.status === 'Active' ? '#dcfce7' : t.status === 'Suspended' ? '#fef9c3' : '#f3f4f6',
                              color: t.status === 'Active' ? '#16a34a' : t.status === 'Suspended' ? '#ca8a04' : '#6b7280',
                            }}>
                              {t.status}
                            </span>
                          </td>
                          <td>{t.date_appointed ? new Date(t.date_appointed).toLocaleDateString('en-PH') : '—'}</td>
                          <td>{t.contact_number ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {(activeTab === 'blotter' || activeTab === 'households' || activeTab === 'officials') && (
        <div className={styles.comingSoon}>
          <h3>🚧 Coming Soon</h3>
          <p>This report is being built. Check back shortly.</p>
        </div>
      )}
    </div>
  )
}