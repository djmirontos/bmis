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

function PrintBlotterReportInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())
  const status = searchParams.get('status') ?? 'all'

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
      if (s?.logo_path) { const { data: u } = supabase.storage.from('barangay-assets').getPublicUrl(s.logo_path); setBrgyLogoUrl(u.publicUrl) }
      if (s?.city_logo_path) { const { data: u } = supabase.storage.from('barangay-assets').getPublicUrl(s.city_logo_path); setCityLogoUrl(u.publicUrl) }

      let query = supabase.from('blotter_records').select('id, status, incident_type_name, incident_date')
        .gte('incident_date', `${year}-01-01`).lte('incident_date', `${year}-12-31`)
      if (status !== 'all') query = query.eq('status', status)
      const { data: records } = await query
      const all = records ?? []
      const total = all.length

      const statusMap: Record<string, number> = {}
      all.forEach((r: any) => { statusMap[r.status] = (statusMap[r.status] ?? 0) + 1 })
      const byStatus = Object.entries(statusMap).map(([s, count]) => ({ status: s, count })).sort((a, b) => b.count - a.count)

      const typeMap: Record<string, number> = {}
      all.forEach((r: any) => { const t = r.incident_type_name ?? 'Unknown'; typeMap[t] = (typeMap[t] ?? 0) + 1 })
      const byIncidentType = Object.entries(typeMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const monthMap: Record<number, number> = {}
      all.forEach((r: any) => { if (!r.incident_date) return; const m = new Date(r.incident_date).getMonth() + 1; monthMap[m] = (monthMap[m] ?? 0) + 1 })
      const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: monthNames[i], count: monthMap[i+1] ?? 0 }))

      const active = all.filter((r: any) => ['Filed','Summoned','Mediation Scheduled'].includes(r.status)).length
      const settled = all.filter((r: any) => r.status === 'Settled').length
      const referredToCourt = all.filter((r: any) => r.status === 'Referred to Court').length
      const dismissed = all.filter((r: any) => r.status === 'Dismissed').length
      const resolved = settled + referredToCourt + dismissed
      const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) + '%' : '0%'

      setData({ total, byStatus, byIncidentType, byMonth, active, settled, referredToCourt, dismissed, resolved, resolutionRate })
      setLoading(false)
    }
    load()
  }, [])

  const paper = PAPER_CONFIG[paperSize]
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ background: '#e5e7eb', minHeight: '100vh', padding: '1rem', fontFamily: 'system-ui' }}>
      <div className="no-print" style={{ maxWidth: paper.width, margin: '0 auto 1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSizeMenu(!showSizeMenu)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}>
            {paper.label} <ChevronDown size={14} />
          </button>
          {showSizeMenu && (
            <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '220px' }}>
              {(Object.keys(PAPER_CONFIG) as PaperSize[]).map(k => (
                <button key={k} onClick={() => { setPaperSize(k); setShowSizeMenu(false) }} style={{ display: 'block', width: '100%', padding: '0.6rem 1rem', textAlign: 'left', background: paperSize === k ? '#fff8f0' : 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: paperSize === k ? '#e8820c' : '#374151' }}>
                  {PAPER_CONFIG[k].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg,#f4a020,#e8820c,#c96008)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
          <Printer size={15} /> Print / Save PDF
        </button>
      </div>

      <style>{`@media print { body { background: white !important; } .no-print { display: none !important; } @page { size: ${paper.cssSize}; margin: 0; } }`}</style>

      <div style={{ width: paper.width, minHeight: paper.height, margin: '0 auto', background: 'white', padding: paper.padding, boxSizing: 'border-box', fontFamily: 'Times New Roman, serif', fontSize: '11pt', color: '#000' }}>
        {loading ? <p style={{ textAlign: 'center', padding: '2rem' }}>Loading...</p> : data && settings ? (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              {brgyLogoUrl ? <img src={brgyLogoUrl} alt="Barangay Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
              <div style={{ textAlign: 'center', flex: 1, padding: '0 0.5rem' }}>
                <div style={{ fontSize: '9pt' }}>Republic of the Philippines</div>
                <div style={{ fontSize: '9pt' }}>{settings.province} • {settings.region}</div>
                <div style={{ fontSize: '10pt', fontWeight: 'bold' }}>CITY OF {settings.city.toUpperCase()}</div>
                <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>{settings.barangay_name.toUpperCase()}</div>
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '0.3rem', textTransform: 'uppercase' }}>Blotter & Incident Report</div>
                <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>Year: {year}{status !== 'all' ? ` | Status: ${status}` : ''} &nbsp;|&nbsp; Generated: {today}</div>
              </div>
              {cityLogoUrl ? <img src={cityLogoUrl} alt="City Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
            </div>
            <hr style={{ borderTop: '2px solid #000', margin: '0.5rem 0' }} />
            <hr style={{ borderTop: '1px solid #000', margin: '0.15rem 0 0.75rem' }} />

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Total Cases', value: data.total },
                { label: 'Active', value: data.active },
                { label: 'Settled', value: data.settled },
                { label: 'Resolution Rate', value: data.resolutionRate },
              ].map(c => (
                <div key={c.label} style={{ border: '1px solid #000', padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{c.value}</div>
                  <div style={{ fontSize: '8pt' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* By Status */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>CASES BY STATUS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Status', 'Count', '% of Total'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.byStatus.map((r: any) => (
                    <tr key={r.status}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.status}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total ? ((r.count / data.total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>TOTAL</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* By Incident Type */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>CASES BY INCIDENT TYPE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Incident Type', 'Count', '% of Total'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.byIncidentType.map((r: any) => (
                    <tr key={r.type}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.type}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total ? ((r.count / data.total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Monthly Trend */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>MONTHLY TREND — {year}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Month', 'Cases Filed'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.byMonth.map((r: any) => (
                    <tr key={r.month}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.month}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                    </tr>
                  ))}
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
export default function PrintBlotterReport() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <PrintBlotterReportInner />
    </Suspense>
  )
}
