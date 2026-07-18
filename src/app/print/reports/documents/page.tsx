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

function PrintDocumentsReportInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const year = Number(searchParams.get('year') ?? new Date().getFullYear())
  const month = searchParams.get('month') ?? 'all'

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

      let query = supabase.from('issued_documents').select('document_type, status, fee_paid, issued_date')
        .gte('issued_date', `${year}-01-01`).lte('issued_date', `${year}-12-31`)
      if (month !== 'all') {
        const mm = String(month).padStart(2, '0')
        const lastDay = new Date(year, Number(month), 0).getDate()
        query = query.gte('issued_date', `${year}-${mm}-01`).lte('issued_date', `${year}-${mm}-${lastDay}`)
      }
      const { data: docs } = await query
      const all = docs ?? []
      const issued = all.filter((d: any) => d.status !== 'Voided')
      const voided = all.filter((d: any) => d.status === 'Voided')
      const totalFees = issued.reduce((sum: number, d: any) => sum + (d.fee_paid ?? 0), 0)

      const typeMap: Record<string, { issued: number; voided: number; fees: number }> = {}
      all.forEach((d: any) => {
        if (!typeMap[d.document_type]) typeMap[d.document_type] = { issued: 0, voided: 0, fees: 0 }
        if (d.status === 'Voided') typeMap[d.document_type].voided++
        else { typeMap[d.document_type].issued++; typeMap[d.document_type].fees += d.fee_paid ?? 0 }
      })
      const byType = Object.entries(typeMap).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.issued - a.issued)

      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      const monthMap: Record<number, { count: number; fees: number }> = {}
      issued.forEach((d: any) => {
        const m = new Date(d.issued_date).getMonth() + 1
        if (!monthMap[m]) monthMap[m] = { count: 0, fees: 0 }
        monthMap[m].count++; monthMap[m].fees += d.fee_paid ?? 0
      })
      const byMonth = Array.from({ length: 12 }, (_, i) => ({ month: monthNames[i], count: monthMap[i+1]?.count ?? 0, fees: monthMap[i+1]?.fees ?? 0 }))

      setData({ totalIssued: issued.length, totalVoided: voided.length, totalFees, byType, byMonth })
      setLoading(false)
    }
    load()
  }, [])

  const paper = PAPER_CONFIG[paperSize]
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const periodLabel = month === 'all' ? `Year ${year}` : `${monthNames[Number(month)-1]} ${year}`

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
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '0.3rem', textTransform: 'uppercase' }}>Document Issuance Summary</div>
                <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>Period: {periodLabel} &nbsp;|&nbsp; Generated: {today}</div>
              </div>
              {cityLogoUrl ? <img src={cityLogoUrl} alt="City Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
            </div>
            <hr style={{ borderTop: '2px solid #000', margin: '0.5rem 0' }} />
            <hr style={{ borderTop: '1px solid #000', margin: '0.15rem 0 0.75rem' }} />

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.4rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Total Issued', value: data.totalIssued },
                { label: 'Total Voided', value: data.totalVoided },
                { label: 'Fees Collected', value: `₱${data.totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
              ].map(c => (
                <div key={c.label} style={{ border: '1px solid #000', padding: '0.3rem 0.4rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '14pt', fontWeight: 'bold' }}>{c.value}</div>
                  <div style={{ fontSize: '8pt' }}>{c.label}</div>
                </div>
              ))}
            </div>

            {/* By Document Type */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>BY DOCUMENT TYPE</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Document Type', 'Issued', 'Voided', 'Total', 'Fees Collected'].map(h => (
                      <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byType.map((r: any) => (
                    <tr key={r.type}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.type}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.issued}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.voided}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.issued + r.voided}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>₱{r.fees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>TOTAL</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.totalIssued}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.totalVoided}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{data.totalIssued + data.totalVoided}</td>
                    <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>₱{data.totalFees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Monthly Trend */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', borderBottom: '1px solid #000', marginBottom: '0.3rem' }}>MONTHLY TREND — {year}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
                <thead>
                  <tr style={{ background: '#f0f0f0' }}>
                    {['Month', 'Documents Issued', 'Fees Collected'].map(h => (
                      <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.byMonth.map((r: any) => (
                    <tr key={r.month}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.month}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{r.count}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>₱{r.fees.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
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
export default function PrintDocumentsReport() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <PrintDocumentsReportInner />
    </Suspense>
  )
}
