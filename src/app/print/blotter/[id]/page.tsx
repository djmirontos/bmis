'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, ChevronDown } from 'lucide-react'
import type { BlotterRecord, BarangaySettings } from '@/lib/types'

type PaperSize = 'short' | 'a4' | 'long'
type DocType = 'summons' | 'cfa' | 'settlement'

const PAPER_CONFIG: Record<PaperSize, {
  label: string
  width: string
  height: string
  cssSize: string
  padding: string
}> = {
  short: {
    label: 'Short Bond (8.5" × 11")',
    width: '8.5in', height: '11in',
    cssSize: 'letter portrait',
    padding: '0.5in 0.65in',
  },
  a4: {
    label: 'A4 (8.27" × 11.69")',
    width: '8.27in', height: '11.69in',
    cssSize: 'A4 portrait',
    padding: '0.55in 0.65in',
  },
  long: {
    label: 'Long Bond (8.5" × 13")',
    width: '8.5in', height: '13in',
    cssSize: 'legal portrait',
    padding: '0.6in 0.65in',
  },
}

const DOC_LABELS: Record<DocType, string> = {
  summons: 'SUMMONS LETTER',
  cfa: 'CERTIFICATE TO FILE ACTION',
  settlement: 'AMICABLE SETTLEMENT',
}

function BlotterPrintPageInner() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const docType = (searchParams.get('doc') ?? 'summons') as DocType
  const supabase = createClient()

  const [record, setRecord] = useState<BlotterRecord | null>(null)
  const [settings, setSettings] = useState<BarangaySettings | null>(null)
  const [brgyLogoUrl, setBrgyLogoUrl] = useState('')
  const [cityLogoUrl, setCityLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [paperSize, setPaperSize] = useState<PaperSize>('short')
  const [showSizeMenu, setShowSizeMenu] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: rec }, { data: s }] = await Promise.all([
        supabase.from('blotter_records')
          .select('*').eq('id', id).single(),
        supabase.from('barangay_settings').select('*').single(),
      ])
      setRecord(rec)
      setSettings(s)

      if (s?.logo_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('barangay-assets').getPublicUrl(s.logo_path)
        setBrgyLogoUrl(publicUrl)
      }
      if (s?.city_logo_path) {
        const { data: { publicUrl } } = supabase.storage
          .from('barangay-assets').getPublicUrl(s.city_logo_path)
        setCityLogoUrl(publicUrl)
      }
      setLoading(false)
    }
    load()
  }, [id])

  const paper = PAPER_CONFIG[paperSize]

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#64748b', fontSize: 14,
      fontFamily: 'system-ui, sans-serif'
    }}>
      Loading document...
    </div>
  )

  if (!record || !settings) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#64748b', fontSize: 14
    }}>
      Document not found.
    </div>
  )

  const controlNumber = docType === 'summons'
    ? record.summons_control_number
    : docType === 'cfa'
      ? record.cfa_control_number
      : record.settlement_control_number

  return (
    <>
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box; margin: 0; padding: 0;
        }
        html, body {
          background: #e5e7eb;
          font-family: system-ui, sans-serif;
        }
        .ctrl {
          position: fixed; top: 0; left: 0; right: 0;
          z-index: 999; background: white;
          border-bottom: 1px solid #e2e0d9;
          padding: 10px 20px;
          display: flex; align-items: center;
          justify-content: space-between; gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          height: 60px;
        }
        .wrapper {
          padding-top: 76px; padding-bottom: 48px;
          display: flex; justify-content: center;
          align-items: flex-start; min-height: 100vh;
        }
        .doc-page {
          background: white;
          width: ${paper.width}; height: ${paper.height};
          padding: ${paper.padding};
          box-shadow: 0 6px 32px rgba(0,0,0,0.15);
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt; color: #000;
          display: flex; flex-direction: column;
          overflow: hidden; position: relative;
        }
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important; padding: 0 !important;
            background: white !important;
          }
          .ctrl { display: none !important; }
          .wrapper {
            padding: 0 !important; margin: 0 !important;
            display: block !important;
            min-height: unset !important;
            background: white !important;
          }
          .doc-page {
            width: 100% !important; height: 100vh !important;
            box-shadow: none !important; margin: 0 !important;
            padding: ${paper.padding} !important;
            overflow: hidden !important;
          }
          @page { size: ${paper.cssSize}; margin: 0 !important; }
        }
      `}</style>

      {/* Control Bar */}
      <div className="ctrl">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <Link
            href={`/dashboard/blotter/${id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 13px', borderRadius: 8,
              border: '1px solid #e2e0d9', background: 'white',
              color: '#64748b', textDecoration: 'none', fontSize: 13
            }}
          >
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <p style={{
              margin: 0, fontSize: 14,
              fontWeight: 600, color: '#0f172a'
            }}>
              {DOC_LABELS[docType]}
            </p>
            <p style={{
              margin: 0, fontSize: 12, color: '#94a3b8'
            }}>
              {controlNumber} · {record.blotter_number}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          {/* Paper Size */}
          <div style={{ position: 'relative' as const }}>
            <button
              onClick={() => setShowSizeMenu(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8,
                border: '1px solid #e2e0d9', background: 'white',
                color: '#374151', fontSize: 13, cursor: 'pointer'
              }}
            >
              {paper.label} <ChevronDown size={13} />
            </button>
            {showSizeMenu && (
              <div style={{
                position: 'absolute' as const,
                top: '110%', right: 0,
                background: 'white',
                border: '1px solid #e2e0d9',
                borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                zIndex: 300, minWidth: 230
              }}>
                {(Object.keys(PAPER_CONFIG) as PaperSize[]).map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setPaperSize(size)
                      setShowSizeMenu(false)
                    }}
                    style={{
                      display: 'block', width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left' as const,
                      border: 'none',
                      background: paperSize === size
                        ? '#fffbf5' : 'white',
                      color: paperSize === size
                        ? '#c2410c' : '#374151',
                      fontSize: 13, cursor: 'pointer',
                      fontWeight: paperSize === size ? 500 : 400,
                      borderBottom: size !== 'long'
                        ? '1px solid #f8f7f3' : 'none',
                    }}
                  >
                    {PAPER_CONFIG[size].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => window.print()}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 9,
              background: 'linear-gradient(135deg, #f4a020, #c96008)',
              color: 'white', border: 'none',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(232,130,12,0.35)'
            }}
          >
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Document Page */}
      <div className="wrapper">
        <div className="doc-page">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 20, marginBottom: 8
            }}>
              <div style={{ width: 66, height: 66, flexShrink: 0 }}>
                {brgyLogoUrl ? (
                  <img src={brgyLogoUrl} alt="Barangay Logo"
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'contain'
                    }} />
                ) : (
                  <div style={{
                    width: 66, height: 66,
                    border: '1px dashed #bbb', borderRadius: '50%',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 7,
                    color: '#aaa', textAlign: 'center' as const
                  }}>
                    BRGY<br />LOGO
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <p style={{
                  margin: '0 0 1px', fontSize: '8.5pt'
                }}>
                  Republic of the Philippines
                </p>
                <p style={{
                  margin: '0 0 1px', fontSize: '9.5pt'
                }}>
                  Province of {settings.province}
                </p>
                <p style={{
                  margin: '0 0 2px', fontSize: '9.5pt'
                }}>
                  {settings.city}
                </p>
                <p style={{
                  margin: 0, fontSize: '12pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {settings.barangay_name}
                </p>
              </div>

              <div style={{ width: 66, height: 66, flexShrink: 0 }}>
                {cityLogoUrl ? (
                  <img src={cityLogoUrl} alt="City Logo"
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'contain'
                    }} />
                ) : (
                  <div style={{
                    width: 66, height: 66,
                    border: '1px dashed #bbb', borderRadius: '50%',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 7,
                    color: '#aaa', textAlign: 'center' as const
                  }}>
                    CITY<br />LOGO
                  </div>
                )}
              </div>
            </div>

            <div style={{
              borderTop: '2.5px solid #000',
              borderBottom: '1px solid #000',
              padding: '2.5px 0', marginBottom: 12
            }}>
              <p style={{
                margin: 0, fontSize: '11pt', fontWeight: 'bold',
                letterSpacing: 1.5, textTransform: 'uppercase'
              }}>
                Office of the Punong Barangay
              </p>
            </div>

            <p style={{
              margin: '0 0 2px', fontSize: '14pt',
              fontWeight: 'bold', textTransform: 'uppercase',
              textDecoration: 'underline', letterSpacing: 0.5
            }}>
              {DOC_LABELS[docType]}
            </p>
            <p style={{
              margin: 0, fontSize: '8.5pt', color: '#333'
            }}>
              Control No.:{' '}
              <strong style={{
                fontFamily: 'Courier New, monospace'
              }}>
                {controlNumber}
              </strong>
              <span style={{ marginLeft: 20 }}>
                Blotter No.:{' '}
                <strong style={{
                  fontFamily: 'Courier New, monospace'
                }}>
                  {record.blotter_number}
                </strong>
              </span>
            </p>
          </div>

          {/* Body */}
          <div style={{
            flex: 1, display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.85, fontSize: '11pt'
          }}>

            {/* Date */}
            <p style={{
              textAlign: 'right', marginBottom: 16,
              fontSize: '10pt'
            }}>
              {new Date().toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric', year: 'numeric'
              })}
            </p>

            {/* Content by doc type */}
            {docType === 'summons' && (
              <SummonsBody
                record={record}
                settings={settings}
              />
            )}
            {docType === 'cfa' && (
              <CFABody record={record} settings={settings} />
            )}
            {docType === 'settlement' && (
              <SettlementBody
                record={record}
                settings={settings}
              />
            )}

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Signature Block */}
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'flex-end', marginTop: 24
            }}>
              {/* Left — Prepared by */}
              <div style={{ textAlign: 'center', minWidth: 200 }}>
                <div style={{ height: '0.6in' }} />
                <div style={{
                  borderBottom: '1px solid #000',
                  marginBottom: 3
                }} />
                <p style={{
                  margin: '0 0 1px', fontSize: '10pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {record.recorded_by_name ?? 'BARANGAY SECRETARY'}
                </p>
                <p style={{
                  margin: 0, fontSize: '9pt'
                }}>
                  Barangay Secretary
                </p>
              </div>

              {/* Right — Punong Barangay */}
              <div style={{ textAlign: 'center', minWidth: 200 }}>
                <div style={{ height: '0.6in' }} />
                <div style={{
                  borderBottom: '1px solid #000',
                  marginBottom: 3
                }} />
                <p style={{
                  margin: '0 0 1px', fontSize: '10pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {record.punong_barangay ?? 'PUNONG BARANGAY'}
                </p>
                <p style={{ margin: 0, fontSize: '9pt' }}>
                  Punong Barangay
                </p>
                <p style={{
                  margin: '1px 0 0',
                  fontSize: '8.5pt', color: '#444'
                }}>
                  {settings.barangay_name}, {settings.city}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}

function SummonsBody({ record, settings }: {
  record: BlotterRecord
  settings: BarangaySettings
}) {
  return (
    <div style={{ textAlign: 'justify' }}>
      <p style={{ marginBottom: 14 }}>
        To: <strong>{record.respondents}</strong>
      </p>
      <p style={{ marginBottom: 14 }}>
        Greetings:
      </p>
      <p style={{ marginBottom: 14 }}>
        You are hereby <strong>SUMMONED</strong> to appear before
        this office in connection with a complaint filed against you
        by <strong>{record.complainant_name}</strong> for{' '}
        <strong>{record.incident_type_name}</strong> that allegedly
        occurred on{' '}
        <strong>
          {new Date(record.incident_date).toLocaleDateString('en-PH', {
            month: 'long', day: 'numeric', year: 'numeric'
          })}
        </strong>
        {record.incident_time
          ? ` at ${record.incident_time.slice(0, 5)}`
          : ''
        }{' '}
        at <strong>{record.incident_place}</strong>.
      </p>
      <p style={{ marginBottom: 14 }}>
        Under the Katarungang Pambarangay Law (Presidential Decree
        No. 1508, as amended by Republic Act No. 7160), the barangay
        is mandated to bring the parties together for conciliation
        before any case may be filed in court.
      </p>
      <p style={{ marginBottom: 14 }}>
        Failure to appear without justifiable cause on the scheduled
        date shall be deemed a waiver of your right to present
        evidence and may result in adverse action.
      </p>
      <p style={{ marginBottom: 14 }}>
        For further queries, please contact this office at{' '}
        {settings.contact_number ?? 'our office number'}.
      </p>
    </div>
  )
}

function CFABody({ record, settings }: {
  record: BlotterRecord
  settings: BarangaySettings
}) {
  return (
    <div style={{ textAlign: 'justify' }}>
      <p style={{ marginBottom: 16 }}>
        TO WHOM IT MAY CONCERN:
      </p>
      <p style={{ marginBottom: 14 }}>
        This is to certify that the complaint filed by{' '}
        <strong>{record.complainant_name}</strong> against{' '}
        <strong>{record.respondents}</strong> for{' '}
        <strong>{record.incident_type_name}</strong> docketed under
        Blotter No. <strong>{record.blotter_number}</strong> has
        undergone the mandatory barangay conciliation proceedings
        pursuant to the Katarungang Pambarangay Law.
      </p>
      <p style={{ marginBottom: 14 }}>
        Despite earnest efforts at conciliation and mediation, the
        parties failed to arrive at an amicable settlement.
        Accordingly, the complainant is hereby authorized to file
        the appropriate action in court or any government agency.
      </p>
      {record.resolution_notes && (
        <p style={{ marginBottom: 14 }}>
          <strong>Reason for referral:</strong>{' '}
          {record.resolution_notes}
        </p>
      )}
      <p style={{ marginBottom: 14 }}>
        This Certificate is issued upon the request of the
        complainant for whatever legal purpose it may serve.
      </p>
    </div>
  )
}

function SettlementBody({ record, settings }: {
  record: BlotterRecord
  settings: BarangaySettings
}) {
  return (
    <div style={{ textAlign: 'justify' }}>
      <p style={{ marginBottom: 16 }}>
        KNOW ALL MEN BY THESE PRESENTS:
      </p>
      <p style={{ marginBottom: 14 }}>
        This AMICABLE SETTLEMENT is entered into by and between:
      </p>
      <p style={{ marginBottom: 10, paddingLeft: 24 }}>
        <strong>COMPLAINANT:</strong> {record.complainant_name}
        {record.complainant_address
          ? `, of ${record.complainant_address}`
          : ''
        };
      </p>
      <p style={{ marginBottom: 14, paddingLeft: 24 }}>
        <strong>RESPONDENT(S):</strong> {record.respondents};
      </p>
      <p style={{ marginBottom: 14 }}>
        <strong>WHEREAS</strong>, a complaint was filed before the
        Punong Barangay of {settings.barangay_name},{' '}
        {settings.city} for{' '}
        <strong>{record.incident_type_name}</strong> docketed
        under Blotter No.{' '}
        <strong>{record.blotter_number}</strong>;
      </p>
      <p style={{ marginBottom: 14 }}>
        <strong>WHEREAS</strong>, mediation and conciliation
        proceedings were conducted by the Punong Barangay and
        the parties have voluntarily agreed to the following
        terms of settlement:
      </p>
      {record.resolution_notes && (
        <div style={{
          padding: '10px 16px', marginBottom: 14,
          border: '1px solid #ccc', borderRadius: 4
        }}>
          <p style={{
            margin: 0, fontStyle: 'italic',
            whiteSpace: 'pre-wrap'
          }}>
            {record.resolution_notes}
          </p>
        </div>
      )}
      <p style={{ marginBottom: 14 }}>
        <strong>NOW THEREFORE</strong>, the parties hereby agree
        to abide by the foregoing terms of settlement and to
        maintain peace and harmony in the barangay.
      </p>
      <p style={{ marginBottom: 20 }}>
        This Amicable Settlement is signed freely and voluntarily
        by the parties this{' '}
        <strong>
          {record.resolution_date
            ? new Date(record.resolution_date)
              .toLocaleDateString('en-PH', {
                month: 'long', day: 'numeric',
                year: 'numeric'
              })
            : new Date().toLocaleDateString('en-PH', {
              month: 'long', day: 'numeric',
              year: 'numeric'
            })
          }
        </strong>{' '}
        at {settings.barangay_name}, {settings.city}.
      </p>

      {/* Party Signatures */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between', marginBottom: 16
      }}>
        <div style={{ textAlign: 'center', minWidth: 180 }}>
          <div style={{ height: '0.5in' }} />
          <div style={{
            borderBottom: '1px solid #000', marginBottom: 3
          }} />
          <p style={{
            margin: 0, fontSize: '10pt',
            textTransform: 'uppercase', fontWeight: 'bold'
          }}>
            {record.complainant_name}
          </p>
          <p style={{
            margin: 0, fontSize: '9pt', color: '#444'
          }}>
            Complainant
          </p>
        </div>
        <div style={{ textAlign: 'center', minWidth: 180 }}>
          <div style={{ height: '0.5in' }} />
          <div style={{
            borderBottom: '1px solid #000', marginBottom: 3
          }} />
          <p style={{
            margin: 0, fontSize: '10pt',
            textTransform: 'uppercase', fontWeight: 'bold'
          }}>
            Respondent(s)
          </p>
          <p style={{
            margin: 0, fontSize: '9pt', color: '#444'
          }}>
            Respondent
          </p>
        </div>
      </div>
    </div>
  )
}
import { Suspense } from 'react'
export default function BlotterPrintPage() {
  return (
    <Suspense fallback={<div style={{padding:'2rem',textAlign:'center'}}>Loading...</div>}>
      <BlotterPrintPageInner />
    </Suspense>
  )
}
