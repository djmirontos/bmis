'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, RotateCcw, ChevronDown } from 'lucide-react'
import type { IssuedDocument, BarangaySettings } from '@/lib/types'
import QRCode from 'qrcode'

type PaperSize = 'short' | 'a4' | 'long'

const PAPER_CONFIG: Record<PaperSize, {
  label: string
  width: string
  height: string
  cssSize: string
  padding: string
}> = {
  short: {
    label: 'Short Bond (8.5" × 11")',
    width: '8.5in',
    height: '11in',
    cssSize: 'letter portrait',
    padding: '0.5in 0.65in',
  },
  a4: {
    label: 'A4 (8.27" × 11.69")',
    width: '8.27in',
    height: '11.69in',
    cssSize: 'A4 portrait',
    padding: '0.55in 0.65in',
  },
  long: {
    label: 'Long Bond (8.5" × 13")',
    width: '8.5in',
    height: '13in',
    cssSize: 'legal portrait',
    padding: '0.6in 0.65in',
  },
}

function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export default function StandalonePrintPage() {
  const { id } = useParams()
  const supabase = createClient()

  const [doc, setDoc] = useState<IssuedDocument | null>(null)
  const [settings, setSettings] = useState<BarangaySettings | null>(null)
  const [brgyLogoUrl, setBrgyLogoUrl] = useState('')
  const [cityLogoUrl, setCityLogoUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [reprinting, setReprinting] = useState(false)
  const [paperSize, setPaperSize] = useState<PaperSize>('short')
  const [showSizeMenu, setShowSizeMenu] = useState(false)

  useEffect(() => {
    async function load() {
      const [
        { data: docData },
        { data: s },
        { data: { user } }
      ] = await Promise.all([
        supabase.from('issued_documents').select('*').eq('id', id).single(),
        supabase.from('barangay_settings').select('*').single(),
        supabase.auth.getUser(),
      ])

      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles').select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role)
      }

      setDoc(docData)
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

      const verifyUrl = `${getPublicBaseUrl()}/verify/${id}`
      const qr = await QRCode.toDataURL(verifyUrl, {
        width: 120, margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      })
      setQrDataUrl(qr)
      setLoading(false)
    }
    load()
  }, [id])

  const canReprint = ['super_admin', 'captain', 'secretary'].includes(userRole)
  const paper = PAPER_CONFIG[paperSize]

  async function handlePrint() {
    if (!doc) return
    const isFirstPrint = doc.reprint_count === 0

    if (!isFirstPrint && canReprint) {
      setReprinting(true)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('issued_documents').update({
        status: 'Reprinted',
        reprint_count: (doc.reprint_count ?? 0) + 1,
        last_reprint_at: new Date().toISOString(),
        last_reprint_by: user?.id,
      }).eq('id', id)

      await supabase.from('audit_logs').insert({
        user_id: user?.id,
        user_name: user?.email,
        action: 'UPDATE',
        table_name: 'issued_documents',
        record_id: id as string,
        notes: `Document reprinted: ${doc.control_number}`,
      })
      setReprinting(false)
    }

    window.print()
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#64748b', fontSize: 14,
      fontFamily: 'system-ui, sans-serif',
      background: '#f8fafc'
    }}>
      Loading document...
    </div>
  )

  if (!doc || !settings) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#64748b', fontSize: 14,
      fontFamily: 'system-ui, sans-serif'
    }}>
      Document not found.
    </div>
  )

  return (
    <>
      <style>{`
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          background: #e5e7eb;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .ctrl {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 999;
          background: white;
          border-bottom: 1px solid #e2e0d9;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          height: 60px;
        }

        .wrapper {
          padding-top: 76px;
          padding-bottom: 48px;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: 100vh;
        }

        .doc-page {
          background: white;
          width: ${paper.width};
          height: ${paper.height};
          padding: ${paper.padding};
          box-shadow: 0 6px 32px rgba(0,0,0,0.15);
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          color: #000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .ctrl { display: none !important; }

          .wrapper {
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
            min-height: unset !important;
            background: white !important;
          }

          .doc-page {
            width: 100% !important;
            height: 100vh !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: ${paper.padding} !important;
            page-break-after: avoid !important;
            overflow: hidden !important;
          }

          @page {
            size: ${paper.cssSize};
            margin: 0 !important;
          }
        }
      `}</style>

      {/* ── Control Bar ── */}
      <div className="ctrl">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            href={`/dashboard/clearance`}
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
              {doc.document_type}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              {doc.control_number} · {doc.resident_name}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Paper Size Selector */}
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
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                zIndex: 300, minWidth: 230
              }}>
                {(Object.keys(PAPER_CONFIG) as PaperSize[]).map(size => (
                  <button
                    key={size}
                    onClick={() => { setPaperSize(size); setShowSizeMenu(false) }}
                    style={{
                      display: 'block', width: '100%',
                      padding: '10px 16px',
                      textAlign: 'left' as const,
                      border: 'none',
                      background: paperSize === size ? '#fffbf5' : 'white',
                      color: paperSize === size ? '#c2410c' : '#374151',
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

          {/* Print Button */}
          {doc.status !== 'Voided' && (
            <button
              onClick={handlePrint}
              disabled={reprinting}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 18px', borderRadius: 9,
                background: reprinting
                  ? '#f0a050'
                  : 'linear-gradient(135deg, #f4a020, #c96008)',
                color: 'white', border: 'none',
                fontSize: 14, fontWeight: 500,
                cursor: reprinting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(232,130,12,0.35)'
              }}
            >
              {doc.reprint_count > 0
                ? <><RotateCcw size={15} />
                    {reprinting ? ' Processing...' : ' Reprint'}
                  </>
                : <><Printer size={15} /> Print Document</>
              }
            </button>
          )}

          {doc.status === 'Voided' && (
            <span style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13,
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca'
            }}>
              VOIDED — Cannot Print
            </span>
          )}
        </div>
      </div>

      {/* ── Page Preview ── */}
      <div className="wrapper">
        <div className="doc-page">

          {/* VOID Watermark */}
          {doc.status === 'Voided' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none', zIndex: 10
            }}>
              <p style={{
                fontSize: 100, fontWeight: 900,
                color: 'rgba(220,38,38,0.09)',
                transform: 'rotate(-35deg)',
                margin: 0, letterSpacing: 10,
                userSelect: 'none',
                fontFamily: 'Arial, sans-serif'
              }}>
                VOID
              </p>
            </div>
          )}

          {/* ══ HEADER ══ */}
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 20, marginBottom: 8
            }}>

              {/* Left — Barangay Logo */}
              <div style={{ width: 68, height: 68, flexShrink: 0 }}>
                {brgyLogoUrl ? (
                  <img
                    src={brgyLogoUrl}
                    alt="Barangay Logo"
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div style={{
                    width: 68, height: 68,
                    border: '1px dashed #bbb', borderRadius: '50%',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 7,
                    color: '#aaa', textAlign: 'center' as const,
                    lineHeight: 1.3
                  }}>
                    BRGY<br />LOGO
                  </div>
                )}
              </div>

              {/* Center Text */}
              <div style={{ flex: 1 }}>
                <p style={{
                  margin: '0 0 1px', fontSize: '8.5pt',
                  letterSpacing: 0.3, fontWeight: 'normal'
                }}>
                  Republic of the Philippines
                </p>
                <p style={{ margin: '0 0 1px', fontSize: '9.5pt' }}>
                  Province of {settings.province}
                </p>
                <p style={{ margin: '0 0 2px', fontSize: '9.5pt' }}>
                  {settings.city}
                </p>
                <p style={{
                  margin: 0, fontSize: '12pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {settings.barangay_name}
                </p>
                {(settings.contact_number || settings.email_address) && (
                  <p style={{
                    margin: '1px 0 0', fontSize: '7.5pt',
                    color: '#444'
                  }}>
                    {[settings.contact_number, settings.email_address]
                      .filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {/* Right — City Logo */}
              <div style={{ width: 68, height: 68, flexShrink: 0 }}>
                {cityLogoUrl ? (
                  <img
                    src={cityLogoUrl}
                    alt="City Logo"
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div style={{
                    width: 68, height: 68,
                    border: '1px dashed #bbb', borderRadius: '50%',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 7,
                    color: '#aaa', textAlign: 'center' as const,
                    lineHeight: 1.3
                  }}>
                    CITY<br />LOGO
                  </div>
                )}
              </div>
            </div>

            {/* Thick/Thin Divider */}
            <div style={{
              borderTop: '2.5px solid #000',
              borderBottom: '1px solid #000',
              padding: '2.5px 0', marginBottom: 8
            }}>
              <p style={{
                margin: 0, fontSize: '11.5pt',
                fontWeight: 'bold', letterSpacing: 1.5,
                textTransform: 'uppercase'
              }}>
                Office of the Punong Barangay
              </p>
            </div>

            {/* Document Title */}
          
              <p style={{
                margin: '40px 0 2px', fontSize: '14pt',
                fontWeight: 'bold', textTransform: 'uppercase',
                letterSpacing: 0.5, textDecoration: 'underline'
              }}>
                {doc.document_type}
              </p>

            {/* Control / OR Row */}
            <p style={{ margin: 0, fontSize: '8.5pt', color: '#333' }}>
              Control No.:{' '}
              <strong style={{ fontFamily: 'Courier New, monospace' }}>
                {doc.control_number}
              </strong>
              {settings.show_or_number && doc.or_number && (
                <span style={{ marginLeft: 20 }}>
                  OR No.: <strong>{doc.or_number}</strong>
                </span>
              )}
            </p>
          </div>

          {/* ══ BODY ══ */}
          <div style={{
            lineHeight: 1.85,
            textAlign: 'justify',
            fontSize: '11pt',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <p style={{ marginTop: 32, marginBottom: 10 }}>
              TO WHOM IT MAY CONCERN:
            </p>

            <p style={{ marginBottom: 10 }}>
              {getDocumentBody(
                doc.document_type,
                doc.resident_name,
                doc.resident_address,
                doc.resident_age,
                doc.resident_civil_status,
                doc.purpose
              )}
            </p>

            <p style={{ marginBottom: 10 }}>
              This certification is issued upon the request of the
              above-named person for whatever legal purpose it may serve.
            </p>

            <p style={{ marginBottom: 6 }}>
              Issued this{' '}
              <strong>
                {new Date(doc.issued_date).toLocaleDateString('en-PH', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </strong>
              {' '}at {settings.barangay_name}, {settings.city},{' '}
              {settings.province}.
            </p>

            <p style={{ marginBottom: 0, fontSize: '9.5pt', color: '#333' }}>
              Valid until:{' '}
              <strong>
                {new Date(doc.expiry_date).toLocaleDateString('en-PH', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </strong>
            </p>

            {/* Spacer for signature */}
            <div style={{ flex: 0.5 }} />

            {/* ══ SIGNATURE + QR (same row, bottom of body) ══ */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              marginTop: 8,
            }}>

              {/* Signature Block — 1 inch space above line */}
              <div style={{ textAlign: 'center', minWidth: 260 }}>
                {/* 1 inch blank signing space */}
                <div style={{ height: '1in' }} />
                {/* Signature Line */}
                <div style={{
                  borderBottom: '1px solid #000',
                  marginBottom: 4,
                  width: '100%'
                }} />
                <p style={{
                  margin: '0 0 1px', fontSize: '11.5pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {doc.punong_barangay ?? 'PUNONG BARANGAY'}
                </p>
                <p style={{ margin: '0 0 1px', fontSize: '9.5pt' }}>
                  Punong Barangay
                </p>
                <p style={{ margin: 0, fontSize: '8.5pt', color: '#444' }}>
                  {settings.barangay_name}, {settings.city}
                </p>
              </div>

              {/* QR Code Block — bigger, scan to verify below */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    style={{
                      width: 90, height: 90,
                      display: 'block'
                    }}
                  />
                )}
                <p style={{
                  margin: 0, fontSize: '7.5pt',
                  color: '#555', textAlign: 'center' as const
                }}>
                  Scan to verify
                </p>
                {doc.reprint_count > 0 && (
                  <p style={{
                    margin: '2px 0 0', fontSize: '7pt',
                    color: '#dc2626', fontWeight: 'bold',
                    textAlign: 'center' as const
                  }}>
                    REPRINT #{doc.reprint_count}
                  </p>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  )
}

function getDocumentBody(
  type: string,
  name: string,
  address: string,
  age: number | null,
  civilStatus: string | null,
  purpose: string | null
): React.ReactNode {
  const nameEl = (
    <strong style={{ textTransform: 'uppercase' }}>{name}</strong>
  )
  const ageEl = age ? `, ${age} years of age` : ''
  const civilEl = civilStatus ? `, ${civilStatus}` : ''
  const purposeEl = purpose
    ? <> for the purpose of <strong>{purpose}</strong></>
    : null

  switch (type) {
    case 'Barangay Clearance':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a bonafide resident of {address}, is known to be a person of good moral character, law-abiding, and has no derogatory record filed in this barangay office{purposeEl}.</>
    case 'Certificate of Residency':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, is a bonafide resident of {address}, and has been residing in this barangay for a considerable period of time{purposeEl}.</>
    case 'Certificate of Indigency':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a resident of {address}, belongs to an indigent family and is a recipient of the government's social amelioration program{purposeEl}.</>
    case 'Certificate of Good Moral Character':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a resident of {address}, is personally known to us to be a person of good moral character, law-abiding, and with no known criminal record filed in this barangay{purposeEl}.</>
    case 'Certificate of No Income':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a resident of {address}, has no known source of income and is not gainfully employed{purposeEl}.</>
    case 'First-Time Jobseeker Certificate':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a resident of {address}, is a first-time jobseeker pursuant to Republic Act No. 11261 (First-Time Jobseekers Assistance Act) and is entitled to the privileges and exemptions provided therein{purposeEl}.</>
    case 'Business Clearance':
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a resident of {address}, has been granted clearance to operate a business within the jurisdiction of this barangay and has complied with the requirements thereof{purposeEl}.</>
    default:
      return <>This is to certify that {nameEl}{ageEl}{civilEl}, a resident of {address}, has requested this certification{purposeEl}.</>
  }
}