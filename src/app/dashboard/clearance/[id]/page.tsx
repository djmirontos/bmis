'use client'

import { useEffect, useState, useRef } from 'react'
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
}> = {
  short: {
    label: 'Short Bond (8.5" × 11")',
    width: '8.5in',
    height: '11in',
    cssSize: 'letter portrait'
  },
  a4: {
    label: 'A4 (8.27" × 11.69")',
    width: '8.27in',
    height: '11.69in',
    cssSize: 'A4 portrait'
  },
  long: {
    label: 'Long Bond (8.5" × 13")',
    width: '8.5in',
    height: '13in',
    cssSize: 'legal portrait'
  },
}

function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export default function PrintDocumentPage() {
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
        width: 90, margin: 1,
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
      color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui, sans-serif'
    }}>
      Loading document...
    </div>
  )

  if (!doc || !settings) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui, sans-serif'
    }}>
      Document not found.
    </div>
  )

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }

        /* ── Screen styles ── */
        body {
          margin: 0;
          background: #e5e7eb;
          font-family: system-ui, sans-serif;
        }

        .control-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          background: white;
          border-bottom: 1px solid #e2e0d9;
          padding: 10px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        }

        .page-wrapper {
          padding-top: 72px;
          padding-bottom: 40px;
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .print-page {
          background: white;
          box-shadow: 0 4px 24px rgba(0,0,0,0.13);
          width: ${paper.width};
          min-height: ${paper.height};
          padding: 0.55in 0.65in 0.5in;
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          color: #000;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        /* ── Print styles ── */
        @media print {
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .control-bar { display: none !important; }
          .page-wrapper {
            padding: 0 !important;
            background: white !important;
            display: block !important;
          }

          .print-page {
            width: 100% !important;
            min-height: 100vh !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0.55in 0.65in 0.5in !important;
          }

          @page {
            size: ${paper.cssSize};
            margin: 0;
          }
        }
      `}</style>

      {/* Control Bar */}
      <div className="control-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href={`/print/${id}`} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 13px', borderRadius: 8,
            border: '1px solid #e2e0d9', background: 'white',
            color: '#64748b', textDecoration: 'none', fontSize: 13
          }}>
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <p style={{
              margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a'
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
                padding: '8px 13px', borderRadius: 8,
                border: '1px solid #e2e0d9', background: 'white',
                color: '#374151', fontSize: 13, cursor: 'pointer'
              }}
            >
              {paper.label}
              <ChevronDown size={14} />
            </button>
            {showSizeMenu && (
              <div style={{
                position: 'absolute' as const, top: '110%', right: 0,
                background: 'white', border: '1px solid #e2e0d9',
                borderRadius: 10, overflow: 'hidden',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                zIndex: 200, minWidth: 220
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
                      padding: '10px 16px', textAlign: 'left' as const,
                      border: 'none', background: paperSize === size
                        ? '#fffbf5' : 'white',
                      color: paperSize === size ? '#c2410c' : '#374151',
                      fontSize: 13, cursor: 'pointer',
                      borderBottom: size !== 'long'
                        ? '1px solid #f8f7f3' : 'none',
                      fontWeight: paperSize === size ? 500 : 400
                    }}
                  >
                    {PAPER_CONFIG[size].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Print / Reprint Button */}
          {doc.status !== 'Voided' && (
            <button
              onClick={handlePrint}
              disabled={reprinting}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 9,
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
                ? <><RotateCcw size={15} /> {reprinting ? 'Processing...' : 'Reprint'}</>
                : <><Printer size={15} /> Print Document</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="print-page">

          {/* VOID Watermark */}
          {doc.status === 'Voided' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', pointerEvents: 'none', zIndex: 10
            }}>
              <p style={{
                fontSize: 96, fontWeight: 900,
                color: 'rgba(220,38,38,0.10)',
                transform: 'rotate(-35deg)',
                margin: 0, letterSpacing: 8,
                userSelect: 'none'
              }}>
                VOID
              </p>
            </div>
          )}

          {/* ── Document Content ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 24, marginBottom: 10
              }}>
                {/* Left Logo — Barangay */}
                <div style={{
                  width: 72, height: 72, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {brgyLogoUrl ? (
                    <img
                      src={brgyLogoUrl}
                      alt="Barangay Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{
                      width: 72, height: 72, border: '1px dashed #ccc',
                      borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: '#999', textAlign: 'center' as const
                    }}>
                      BRGY LOGO
                    </div>
                  )}
                </div>

                {/* Center Text */}
                <div style={{ flex: 1, textAlign: 'center' as const }}>
                  <p style={{
                    margin: '0 0 1px', fontSize: '9pt',
                    fontWeight: 'normal', letterSpacing: 0.5
                  }}>
                    Republic of the Philippines
                  </p>
                  <p style={{ margin: '0 0 1px', fontSize: '10pt' }}>
                    Province of {settings.province}
                  </p>
                  <p style={{ margin: '0 0 2px', fontSize: '10pt' }}>
                    {settings.city}
                  </p>
                  <p style={{
                    margin: 0, fontSize: '13pt',
                    fontWeight: 'bold', textTransform: 'uppercase'
                  }}>
                    {settings.barangay_name}
                  </p>
                  {(settings.contact_number || settings.email_address) && (
                    <p style={{ margin: '2px 0 0', fontSize: '8pt', color: '#444' }}>
                      {settings.contact_number}
                      {settings.contact_number && settings.email_address && ' · '}
                      {settings.email_address}
                    </p>
                  )}
                </div>

                {/* Right Logo — City */}
                <div style={{
                  width: 72, height: 72, flexShrink: 0,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {cityLogoUrl ? (
                    <img
                      src={cityLogoUrl}
                      alt="City Logo"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <div style={{
                      width: 72, height: 72, border: '1px dashed #ccc',
                      borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: '#999', textAlign: 'center' as const
                    }}>
                      CITY LOGO
                    </div>
                  )}
                </div>
              </div>

              {/* Divider */}
              <div style={{
                borderTop: '3px solid #000',
                borderBottom: '1px solid #000',
                padding: '3px 0', marginBottom: 12
              }}>
                <p style={{
                  margin: 0, fontSize: '13pt',
                  fontWeight: 'bold', letterSpacing: 1.5,
                  textTransform: 'uppercase'
                }}>
                  Office of the Punong Barangay
                </p>
              </div>

              {/* Document Title */}
              <p style={{
                margin: '0 0 3px', fontSize: '15pt',
                fontWeight: 'bold', textTransform: 'uppercase',
                letterSpacing: 0.5, textDecoration: 'underline'
              }}>
                {doc.document_type}
              </p>

              {/* Control & OR */}
              <p style={{ margin: 0, fontSize: '9pt', color: '#333' }}>
                Control No.:{' '}
                <strong style={{ fontFamily: 'Courier, monospace' }}>
                  {doc.control_number}
                </strong>
                {settings.show_or_number && doc.or_number && (
                  <span style={{ marginLeft: 20 }}>
                    OR No.: <strong>{doc.or_number}</strong>
                  </span>
                )}
              </p>
            </div>

            {/* Body */}
            <div style={{
              lineHeight: 1.9, textAlign: 'justify',
              flex: 1, fontSize: '11pt'
            }}>
              <p style={{ marginBottom: 14 }}>TO WHOM IT MAY CONCERN:</p>

              <p style={{ marginBottom: 14 }}>
                {getDocumentBody(
                  doc.document_type,
                  doc.resident_name,
                  doc.resident_address,
                  doc.resident_age,
                  doc.resident_civil_status,
                  doc.purpose
                )}
              </p>

              <p style={{ marginBottom: 14 }}>
                This certification is issued upon the request of the above-named
                person for whatever legal purpose it may serve.
              </p>

              <p style={{ marginBottom: 10 }}>
                Issued this{' '}
                <strong>
                  {new Date(doc.issued_date).toLocaleDateString('en-PH', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </strong>
                {' '}at {settings.barangay_name}, {settings.city},{' '}
                {settings.province}.
              </p>

              <p style={{ marginBottom: 20, fontSize: '10pt', color: '#333' }}>
                Valid until:{' '}
                <strong>
                  {new Date(doc.expiry_date).toLocaleDateString('en-PH', {
                    month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </strong>
              </p>

              {/* Signature Block */}
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <div style={{ display: 'inline-block', minWidth: 260 }}>
                  <div style={{
                    minHeight: 44,
                    borderBottom: '1px solid #000',
                    marginBottom: 4
                  }} />
                  <p style={{
                    margin: '0 0 2px', fontSize: '12pt',
                    fontWeight: 'bold', textTransform: 'uppercase'
                  }}>
                    {doc.punong_barangay ?? 'PUNONG BARANGAY'}
                  </p>
                  <p style={{ margin: '0 0 1px', fontSize: '10pt' }}>
                    Punong Barangay
                  </p>
                  <p style={{ margin: 0, fontSize: '9pt', color: '#444' }}>
                    {settings.barangay_name}, {settings.city}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer — QR + Issued Info */}
            <div style={{
              borderTop: '1px solid #ccc',
              marginTop: 16, paddingTop: 8,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '7.5pt', color: '#555' }}>
                <p style={{ margin: '0 0 2px' }}>
                  Issued by: {doc.issued_by_name}
                </p>
                <p style={{ margin: 0 }}>
                  Date/Time:{' '}
                  {new Date(doc.created_at).toLocaleString('en-PH', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit'
                  })}
                </p>
                {doc.reprint_count > 0 && (
                  <p style={{ margin: '2px 0 0', color: '#dc2626', fontWeight: 'bold' }}>
                    REPRINT #{doc.reprint_count}
                  </p>
                )}
              </div>
              <div style={{ textAlign: 'center' }}>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    style={{ width: 68, height: 68, display: 'block' }}
                  />
                )}
                <p style={{
                  margin: '3px 0 0', fontSize: '7pt', color: '#555'
                }}>
                  Scan to verify
                </p>
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
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a bonafide
          resident of {address}, is known to be a person of good moral
          character, law-abiding, and has no derogatory record filed in
          this barangay office{purposeEl}.
        </>
      )
    case 'Certificate of Residency':
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, is a bonafide
          resident of {address}, and has been residing in this barangay
          for a considerable period of time{purposeEl}.
        </>
      )
    case 'Certificate of Indigency':
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a resident
          of {address}, belongs to an indigent family and is a recipient
          of the government's social amelioration program{purposeEl}.
        </>
      )
    case 'Certificate of Good Moral Character':
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a resident
          of {address}, is personally known to us to be a person of good
          moral character, law-abiding, and with no known criminal record
          filed in this barangay{purposeEl}.
        </>
      )
    case 'Certificate of No Income':
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a resident
          of {address}, has no known source of income and is not gainfully
          employed{purposeEl}.
        </>
      )
    case 'First-Time Jobseeker Certificate':
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a resident
          of {address}, is a first-time jobseeker pursuant to Republic Act
          No. 11261 (First-Time Jobseekers Assistance Act) and is entitled
          to the privileges and exemptions provided therein{purposeEl}.
        </>
      )
    case 'Business Clearance':
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a resident
          of {address}, has been granted clearance to operate a business
          within the jurisdiction of this barangay and has complied with
          the requirements thereof{purposeEl}.
        </>
      )
    default:
      return (
        <>
          This is to certify that {nameEl}{ageEl}{civilEl}, a resident
          of {address}, has requested this certification{purposeEl}.
        </>
      )
  }
}