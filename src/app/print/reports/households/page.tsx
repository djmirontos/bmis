'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Printer, ChevronDown } from 'lucide-react'
import type { BarangaySettings } from '@/lib/types'

type PaperSize = 'short' | 'a4' | 'long'
const PAPER_CONFIG: Record<PaperSize, { label: string; width: string; height: string; cssSize: string; padding: string }> = {
  short: { label: 'Short Bond (8.5" × 11")', width: '8.5in', height: '11in', cssSize: 'letter portrait', padding: '0.5in 0.65in' },
  a4:    { label: 'A4 (8.27" × 11.69")',     width: '8.27in', height: '11.69in', cssSize: 'A4 portrait',     padding: '0.55in 0.65in' },
  long:  { label: 'Long Bond (8.5" × 13")',   width: '8.5in', height: '13in',   cssSize: 'legal portrait',   padding: '0.6in 0.65in' },
}

export default function PrintHouseholdsReport() {
  const supabase = createClient()
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

      const { data: households } = await supabase.from('households').select('id, status, dwelling_type, water_source, is_4ps_beneficiary, purok_id, purok:puroks(name)')
      const { data: residents } = await supabase.from('residents').select('household_id').eq('is_deceased', false).eq('is_transferred', false).not('household_id', 'is', null)

      const all = households ?? []
      const total = all.length
      const active = all.filter((h: any) => h.status === 'Active').length
      const vacant = all.filter((h: any) => h.status === 'Vacant').length
      const demolished = all.filter((h: any) => h.status === 'Demolished').length
      const transferred = all.filter((h: any) => h.status === 'Transferred').length
      const condemned = all.filter((h: any) => h.status === 'Condemned').length
      const fourPsHouseholds = all.filter((h: any) => h.is_4ps_beneficiary).length

      const residentCountMap: Record<string, number> = {}
      ;(residents ?? []).forEach((r: any) => { if (r.household_id) residentCountMap[r.household_id] = (residentCountMap[r.household_id] ?? 0) + 1 })
      const activeHouseholds = all.filter((h: any) => h.status === 'Active')
      const totalResidentsInHH = activeHouseholds.reduce((sum: number, h: any) => sum + (residentCountMap[h.id] ?? 0), 0)
      const avgSize = active > 0 ? (totalResidentsInHH / active).toFixed(1) : '0'

      const statusMap: Record<string, number> = {}
      all.forEach((h: any) => { statusMap[h.status] = (statusMap[h.status] ?? 0) + 1 })
      const byStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count)

      const purokMap: Record<string, { purok: string; total: number; active: number }> = {}
      all.forEach((h: any) => {
        const name = h.purok?.name ?? 'No Purok'
        if (!purokMap[name]) purokMap[name] = { purok: name, total: 0, active: 0 }
        purokMap[name].total++
        if (h.status === 'Active') purokMap[name].active++
      })
      const byPurok = Object.values(purokMap).sort((a, b) => b.total - a.total)

      const dwellingMap: Record<string, number> = {}
      all.forEach((h: any) => { const t = h.dwelling_type ?? 'Not Specified'; dwellingMap[t] = (dwellingMap[t] ?? 0) + 1 })
      const byDwellingType = Object.entries(dwellingMap).map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count)

      const waterMap: Record<string, number> = {}
      all.forEach((h: any) => { const s = h.water_source ?? 'Not Specified'; waterMap[s] = (waterMap[s] ?? 0) + 1 })
      const byWaterSource = Object.entries(waterMap).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count)

      setData({ total, active, vacant, demolished, transferred, condemned, fourPsHouseholds, avgSize, byStatus, byPurok, byDwellingType, byWaterSource })
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
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '0.3rem', textTransform: 'uppercase' }}>Household Statistics Report</div>
                <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>Generated: {today}</div>
              </div>
              {cityLogoUrl ? <img src={cityLogoUrl} alt="City Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
            </div>
            <hr style={{ borderTop: '2px solid #000', margin: '0.5rem 0' }} />
            <hr style={{ borderTop: '1px solid #000', margin: '0.15rem 0 0.75rem' }} />

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Total Households', value: data.total },
                { label: 'Active', value: data.active },
                { label: 'Vacant', value: data.vacant },
                { label: 'Avg. Household Size', value: data.avgSize },
              ].map(c => (
                <div key={c.label} style={{ border: '1px solid #000', padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{c.value}</div>
                  <div style={{ fontSize: '8pt' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* By Status */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>BY STATUS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead><tr style={{ background: '#f0f0f0' }}>{['Status','Count','% of Total'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.byStatus.map((r: any) => (
                    <tr key={r.status}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.status}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total ? ((r.count / data.total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* By Purok */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>BY PUROK</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead><tr style={{ background: '#f0f0f0' }}>{['Purok','Total','Active','Inactive','% of Total'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.byPurok.map((r: any) => (
                    <tr key={r.purok}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.purok}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.total}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.active}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.total - r.active}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total ? ((r.total / data.total) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>TOTAL</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.active}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.total - data.active}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dwelling + Water side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>BY DWELLING TYPE</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                  <thead><tr style={{ background: '#f0f0f0' }}>{['Type','Count'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>{data.byDwellingType.map((r: any) => (<tr key={r.type}><td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.type}</td><td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td></tr>))}</tbody>
                </table>
              </div>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>BY WATER SOURCE</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                  <thead><tr style={{ background: '#f0f0f0' }}>{['Source','Count'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>{data.byWaterSource.map((r: any) => (<tr key={r.source}><td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.source}</td><td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td></tr>))}</tbody>
                </table>
              </div>
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