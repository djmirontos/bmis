'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'
import { Printer, ChevronDown } from 'lucide-react'
import type { BarangaySettings } from '@/lib/types'

type PaperSize = 'short' | 'a4' | 'long'
const PAPER_CONFIG: Record<PaperSize, { label: string; width: string; height: string; cssSize: string; padding: string }> = {
  short: { label: 'Short Bond (8.5" × 11")', width: '8.5in', height: '11in', cssSize: 'letter portrait', padding: '0.5in 0.65in' },
  a4:    { label: 'A4 (8.27" × 11.69")',     width: '8.27in', height: '11.69in', cssSize: 'A4 portrait',     padding: '0.55in 0.65in' },
  long:  { label: 'Long Bond (8.5" × 13")',   width: '8.5in', height: '13in',   cssSize: 'legal portrait',   padding: '0.6in 0.65in' },
}

function calcAge(dob: string): number {
  const today = new Date(); const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}
function pct(part: number, total: number) { return total ? ((part / total) * 100).toFixed(1) + '%' : '0%' }

function PrintPopulationReportInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())

  const [settings, setSettings] = useState<BarangaySettings | null>(null)
  const [brgyLogoUrl, setBrgyLogoUrl] = useState('')
  const [cityLogoUrl, setCityLogoUrl] = useState('')
  const [paperSize, setPaperSize] = useState<PaperSize>('short')
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('barangay_settings').select('*').single()
      setSettings(s)
      if (s?.logo_path) {
        const { data: u } = supabase.storage.from('barangay-assets').getPublicUrl(s.logo_path)
        setBrgyLogoUrl(u.publicUrl)
      }
      if (s?.city_logo_path) {
        const { data: u } = supabase.storage.from('barangay-assets').getPublicUrl(s.city_logo_path)
        setCityLogoUrl(u.publicUrl)
      }

      const { data: residents } = await supabase
        .from('residents')
        .select('id, sex, date_of_birth, civil_status, employment_status, is_voter, is_pwd, is_senior_citizen, is_4ps_beneficiary, is_indigent, is_solo_parent, is_ofw, is_deceased, is_transferred, purok_id, purok:puroks(name)')

      const all = residents ?? []
      const active = all.filter((r: any) => !r.is_deceased && !r.is_transferred)
      const total = active.length
      const male = active.filter((r: any) => r.sex === 'Male').length
      const female = active.filter((r: any) => r.sex === 'Female').length

      let age0to14 = 0, age15to64 = 0, age65plus = 0
      active.forEach((r: any) => {
        if (!r.date_of_birth) return
        const age = calcAge(r.date_of_birth)
        if (age <= 14) age0to14++
        else if (age <= 64) age15to64++
        else age65plus++
      })

      const voters    = active.filter((r: any) => r.is_voter).length
      const pwd       = active.filter((r: any) => r.is_pwd).length
      const senior    = active.filter((r: any) => r.is_senior_citizen).length
      const fourPs    = active.filter((r: any) => r.is_4ps_beneficiary).length
      const indigent  = active.filter((r: any) => r.is_indigent).length
      const soloParent = active.filter((r: any) => r.is_solo_parent).length
      const ofw       = active.filter((r: any) => r.is_ofw).length
      const deceased  = all.filter((r: any) => r.is_deceased).length
      const transferred = all.filter((r: any) => r.is_transferred).length

      const civilMap: Record<string, number> = {}
      active.forEach((r: any) => { const s = r.civil_status ?? 'Unknown'; civilMap[s] = (civilMap[s] ?? 0) + 1 })
      const byCivilStatus = Object.entries(civilMap).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

      const purokMap: Record<string, { purok: string; male: number; female: number; total: number }> = {}
      active.forEach((r: any) => {
        const name = r.purok?.name ?? 'No Purok'
        if (!purokMap[name]) purokMap[name] = { purok: name, male: 0, female: 0, total: 0 }
        purokMap[name].total++
        if (r.sex === 'Male') purokMap[name].male++
        else purokMap[name].female++
      })
      const byPurok = Object.values(purokMap).sort((a, b) => b.total - a.total)

      setData({ total, male, female, age0to14, age15to64, age65plus, voters, pwd, senior, fourPs, indigent, soloParent, ofw, deceased, transferred, byCivilStatus, byPurok })
      setLoading(false)
    }
    load()
  }, [])

  const paper = PAPER_CONFIG[paperSize]
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ background: '#e5e7eb', minHeight: '100vh', padding: '1rem', fontFamily: 'system-ui' }}>
      {/* Toolbar */}
      <div className="no-print" style={{ maxWidth: paper.width, margin: '0 auto 1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSizeMenu(!showSizeMenu)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
            {paper.label} <ChevronDown size={14} />
          </button>
          {showSizeMenu && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '220px' }}>
              {(Object.keys(PAPER_CONFIG) as PaperSize[]).map(k => (
                <button key={k} onClick={() => { setPaperSize(k); setShowSizeMenu(false) }}
                  style={{ display: 'block', width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: paperSize === k ? '#fff8f0' : 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: paperSize === k ? '#e8820c' : '#374151' }}>
                  {PAPER_CONFIG[k].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => window.print()}
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg,#f4a020,#e8820c,#c96008)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      {/* Page */}
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { size: ${paper.cssSize}; margin: 0; }
        }
      `}</style>

      <div style={{ width: paper.width, minHeight: paper.height, margin: '0 auto', background: 'white', padding: paper.padding, boxSizing: 'border-box', fontFamily: 'Times New Roman, serif', fontSize: '11pt', color: '#000' }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '2rem' }}>Loading...</p>
        ) : data && settings ? (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              {brgyLogoUrl ? <img src={brgyLogoUrl} alt="Barangay Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
              <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
                <div style={{ fontSize: '9pt' }}>Republic of the Philippines</div>
                <div style={{ fontSize: '9pt' }}>{settings.province} • {settings.region}</div>
                <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>CITY OF {settings.city.toUpperCase()}</div>
                <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>{settings.barangay_name.toUpperCase()}</div>
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Population & Demographics Report</div>
                <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>Reference Year: {year} &nbsp;|&nbsp; Generated: {today}</div>
              </div>
              {cityLogoUrl ? <img src={cityLogoUrl} alt="City Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
            </div>
            <hr style={{ borderTop: '2px solid #000', margin: '0.5rem 0' }} />
            <hr style={{ borderTop: '1px solid #000', margin: '0.15rem 0 0.75rem' }} />

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Total Residents', value: data.total },
                { label: 'Male', value: `${data.male} (${pct(data.male, data.total)})` },
                { label: 'Female', value: `${data.female} (${pct(data.female, data.total)})` },
                { label: 'Deceased on Record', value: data.deceased },
              ].map(c => (
                <div key={c.label} style={{ border: '1px solid #000', padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{c.value}</div>
                  <div style={{ fontSize: '8pt' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* Age Groups */}
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>AGE GROUP DISTRIBUTION (Philippine Standard)</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Age Group', 'Count', 'Percentage'].map(h => (
                      <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { group: '0–14 (Children/Youth)', count: data.age0to14 },
                    { group: '15–64 (Working Age)', count: data.age15to64 },
                    { group: '65+ (Senior/Elderly)', count: data.age65plus },
                  ].map(r => (
                    <tr key={r.group}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.group}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{pct(r.count, data.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Classifications */}
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>RESIDENT CLASSIFICATIONS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Classification', 'Count', 'Percentage'].map(h => (
                      <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Registered Voters', value: data.voters },
                    { label: 'PWD', value: data.pwd },
                    { label: 'Senior Citizens', value: data.senior },
                    { label: '4Ps Beneficiaries', value: data.fourPs },
                    { label: 'Indigent', value: data.indigent },
                    { label: 'Solo Parent', value: data.soloParent },
                    { label: 'OFW', value: data.ofw },
                  ].map(r => (
                    <tr key={r.label}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.label}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.value}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{pct(r.value, data.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Civil Status */}
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>CIVIL STATUS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Status', 'Count', 'Percentage'].map(h => (
                      <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byCivilStatus.map((r: any) => (
                    <tr key={r.status}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.status}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{pct(r.count, data.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By Purok */}
            <div style={{ marginBottom: '0.6rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>POPULATION BY PUROK</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Purok', 'Male', 'Female', 'Total', '% of Population'].map(h => (
                      <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byPurok.map((r: any) => (
                    <tr key={r.purok}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.purok}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.male}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.female}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', fontWeight: 'bold' }}>{r.total}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{pct(r.total, data.total)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>TOTAL</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.male}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.female}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '1rem', fontSize: '9pt', borderTop: '1px solid #000', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Generated by BMIS — {settings.barangay_name}, {settings.city}</span>
              <span>Date Printed: {today}</span>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
import { Suspense } from 'react'
export default function PrintPopulationReport() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <PrintPopulationReportInner />
    </Suspense>
  )
}
