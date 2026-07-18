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

function PrintOfficialsReportInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const filter = searchParams.get('filter') ?? 'active'

  const [settings, setSettings] = useState<BarangaySettings | null>(null)
  const [brgyLogoUrl, setBrgyLogoUrl] = useState('')
  const [cityLogoUrl, setCityLogoUrl] = useState('')
  const [paperSize, setPaperSize] = useState<PaperSize>('long')
  const [showSizeMenu, setShowSizeMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('barangay_settings').select('*').single()
      setSettings(s)
      if (s?.logo_path) { const { data: u } = supabase.storage.from('barangay-assets').getPublicUrl(s.logo_path); setBrgyLogoUrl(u.publicUrl) }
      if (s?.city_logo_path) { const { data: u } = supabase.storage.from('barangay-assets').getPublicUrl(s.city_logo_path); setCityLogoUrl(u.publicUrl) }

      let oQ = supabase.from('barangay_officials').select('id, full_name, position, committee, term_start, term_end, is_active, contact_number').order('position')
      let sQ = supabase.from('sk_officials').select('id, full_name, position, committee, term_start, term_end, is_active, contact_number').order('position')
      let tQ = supabase.from('barangay_tanod').select('id, full_name, tanod_id_number, status, date_appointed, contact_number').order('full_name')
      if (filter === 'active') { oQ = oQ.eq('is_active', true); sQ = sQ.eq('is_active', true); tQ = tQ.eq('status', 'Active') }

      const [{ data: officials }, { data: skOfficials }, { data: tanod }] = await Promise.all([oQ, sQ, tQ])
      setData({ officials: officials ?? [], skOfficials: skOfficials ?? [], tanod: tanod ?? [] })
      setLoading(false)
    }
    load()
  }, [])

  const paper = PAPER_CONFIG[paperSize]
  const today = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-PH') : '—'

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
                <div style={{ fontSize: '14pt', fontWeight: 'bold', marginTop: '0.3rem', textTransform: 'uppercase' }}>Officials & Tanod Roster</div>
                <div style={{ fontSize: '9pt', marginTop: '0.2rem' }}>{filter === 'active' ? 'Active Records Only' : 'All Records'} &nbsp;|&nbsp; Generated: {today}</div>
              </div>
              {cityLogoUrl ? <img src={cityLogoUrl} alt="City Logo" style={{ width: '70px', height: '70px', objectFit: 'contain' }} /> : <div style={{ width: 70 }} />}
            </div>
            <hr style={{ borderTop: '2px solid #000', margin: '0.5rem 0' }} />
            <hr style={{ borderTop: '1px solid #000', margin: '0.15rem 0 0.75rem' }} />

            {/* Barangay Officials */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11pt', borderBottom: '2px solid #000', marginBottom: '0.3rem' }}>BARANGAY OFFICIALS ({data.officials.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                <thead><tr style={{ background: '#f0f0f0' }}>{['Name','Position','Committee','Term Start','Term End','Status'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.officials.map((o: any) => (
                    <tr key={o.id}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', fontWeight: 'bold' }}>{o.full_name}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{o.position}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{o.committee ?? '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{fmtDate(o.term_start)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{fmtDate(o.term_end)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{o.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SK Officials */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11pt', borderBottom: '2px solid #000', marginBottom: '0.3rem' }}>SK OFFICIALS ({data.skOfficials.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                <thead><tr style={{ background: '#f0f0f0' }}>{['Name','Position','Committee','Term Start','Term End','Status'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.skOfficials.map((o: any) => (
                    <tr key={o.id}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', fontWeight: 'bold' }}>{o.full_name}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{o.position}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{o.committee ?? '—'}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{fmtDate(o.term_start)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{fmtDate(o.term_end)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{o.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tanod */}
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11pt', borderBottom: '2px solid #000', marginBottom: '0.3rem' }}>BARANGAY TANOD ({data.tanod.length})</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
                <thead><tr style={{ background: '#f0f0f0' }}>{['Tanod ID','Name','Status','Date Appointed','Contact'].map(h => <th key={h} style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.tanod.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{t.tanod_id_number}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem', fontWeight: 'bold' }}>{t.full_name}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{t.status}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{fmtDate(t.date_appointed)}</td>
                      <td style={{ border: '1px solid #000', padding: '0.2rem 0.4rem' }}>{t.contact_number ?? '—'}</td>
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
export default function PrintOfficialsReport() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <PrintOfficialsReportInner />
    </Suspense>
  )
}
