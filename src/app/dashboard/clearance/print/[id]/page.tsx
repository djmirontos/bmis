'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Printer, RotateCcw } from 'lucide-react'
import type { IssuedDocument, BarangaySettings } from '@/lib/types'
import QRCode from 'qrcode'

function getPublicBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

export default function PrintDocumentPage() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()
  const printRef = useRef<HTMLDivElement>(null)

  const [doc, setDoc] = useState<IssuedDocument | null>(null)
  const [settings, setSettings] = useState<BarangaySettings | null>(null)
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState('')
  const [reprinting, setReprinting] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: docData }, { data: s }, { data: { user } }] = await Promise.all([
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
          .from('barangay-assets')
          .getPublicUrl(s.logo_path)
        setLogoUrl(publicUrl)
      }

      // Generate QR code
      const verifyUrl = `${getPublicBaseUrl()}/verify/${id}`
      const qr = await QRCode.toDataURL(verifyUrl, {
        width: 100, margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      })
      setQrDataUrl(qr)

      setLoading(false)
    }
    load()
  }, [id])

  const canReprint = ['super_admin', 'captain', 'secretary'].includes(userRole)

  async function handleReprint() {
    if (!doc) return
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

    window.print()
    setReprinting(false)
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Loading document...
    </div>
  )

  if (!doc || !settings) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      color: '#94a3b8', fontSize: 14
    }}>
      Document not found.{' '}
      <Link href="/dashboard/clearance" style={{ color: '#e8820c' }}>Back</Link>
    </div>
  )

  const isFirstIssue = doc.reprint_count === 0

  return (
    <>
      {/* Print Controls — hidden on print */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          .print-page {
            width: 8.5in !important;
            min-height: 11in !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
        @page {
          size: letter portrait;
          margin: 0.5in;
        }
      `}</style>

      {/* Control Bar */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'white', borderBottom: '1px solid #e8e6df',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href={`/print/${doc.id}`} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 8,
            border: '1px solid #e2e0d9', background: 'white',
            color: '#64748b', textDecoration: 'none', fontSize: 13
          }}>
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              {doc.document_type}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
              {doc.control_number} · {doc.resident_name}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {doc.status === 'Voided' && (
            <span style={{
              padding: '7px 14px', borderRadius: 8, fontSize: 13,
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca'
            }}>
              This document has been VOIDED
            </span>
          )}
          {isFirstIssue ? (
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 9,
                background: 'linear-gradient(135deg, #f4a020, #c96008)',
                color: 'white', border: 'none', fontSize: 14,
                fontWeight: 500, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(232,130,12,0.35)'
              }}
            >
              <Printer size={15} /> Print Document
            </button>
          ) : canReprint && doc.status !== 'Voided' ? (
            <button
              onClick={handleReprint}
              disabled={reprinting}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 9,
                background: reprinting ? '#f0a050'
                  : 'linear-gradient(135deg, #f4a020, #c96008)',
                color: 'white', border: 'none', fontSize: 14,
                fontWeight: 500, cursor: reprinting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(232,130,12,0.35)'
              }}
            >
              <RotateCcw size={15} />
              {reprinting ? 'Processing...' : 'Reprint'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Print Page */}
      <div style={{
        minHeight: '100vh', background: '#f0f0f0',
        paddingTop: 80, paddingBottom: 40,
        display: 'flex', justifyContent: 'center'
      }}>
        <div
          ref={printRef}
          className="print-page"
          style={{
            width: '8.5in', minHeight: '11in',
            background: 'white',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            padding: '0.6in 0.65in',
            fontFamily: 'Times New Roman, Times, serif',
            fontSize: '11pt',
            color: '#000',
            position: 'relative',
            boxSizing: 'border-box',
          }}
        >
          {/* VOID watermark */}
          {doc.status === 'Voided' && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', pointerEvents: 'none',
              zIndex: 10
            }}>
              <p style={{
                fontSize: 96, fontWeight: 900,
                color: 'rgba(220,38,38,0.12)',
                transform: 'rotate(-35deg)',
                margin: 0, letterSpacing: 8,
                userSelect: 'none'
              }}>
                VOID
              </p>
            </div>
          )}

          {/* Document Header */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 20, marginBottom: 10
            }}>
              {/* Logo */}
              <div style={{ width: 70, height: 70, flexShrink: 0 }}>
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Barangay Logo"
                    style={{
                      width: '100%', height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                ) : (
                  <div style={{
                    width: 70, height: 70, border: '1px solid #ccc',
                    borderRadius: '50%', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, color: '#999', textAlign: 'center'
                  }}>
                    LOGO
                  </div>
                )}
              </div>

              {/* Header Text */}
              <div>
                <p style={{
                  margin: '0 0 2px', fontSize: '9pt',
                  fontWeight: 'normal', letterSpacing: 1
                }}>
                  Republic of the Philippines
                </p>
                <p style={{
                  margin: '0 0 2px', fontSize: '10pt',
                  fontWeight: 'normal'
                }}>
                  Province of {settings.province}
                </p>
                <p style={{
                  margin: '0 0 2px', fontSize: '10pt',
                  fontWeight: 'normal'
                }}>
                  {settings.city}
                </p>
                <p style={{
                  margin: '0 0 2px', fontSize: '13pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {settings.barangay_name}
                </p>
                <p style={{ margin: 0, fontSize: '9pt', color: '#444' }}>
                  {settings.contact_number && `Tel: ${settings.contact_number}`}
                  {settings.contact_number && settings.email_address && ' · '}
                  {settings.email_address}
                </p>
              </div>

              {/* Right logo placeholder (DILG) */}
              <div style={{
                width: 70, height: 70, flexShrink: 0,
                border: '1px dashed #ccc', borderRadius: '50%',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8, color: '#999', textAlign: 'center'
              }}>
                DILG LOGO
              </div>
            </div>

            {/* Divider */}
            <div style={{
              borderTop: '3px solid #000',
              borderBottom: '1px solid #000',
              padding: '4px 0', marginBottom: 16
            }}>
              <p style={{
                margin: 0, fontSize: '14pt',
                fontWeight: 'bold', letterSpacing: 2,
                textTransform: 'uppercase'
              }}>
                Office of the Punong Barangay
              </p>
            </div>

            {/* Document Title */}
            <p style={{
              margin: '0 0 4px', fontSize: '16pt',
              fontWeight: 'bold', textTransform: 'uppercase',
              letterSpacing: 1, textDecoration: 'underline'
            }}>
              {doc.document_type}
            </p>
            <p style={{ margin: 0, fontSize: '9pt', color: '#444' }}>
              Control No.:{' '}
              <strong style={{ fontFamily: 'Courier, monospace' }}>
                {doc.control_number}
              </strong>
              {settings.show_or_number && doc.or_number && (
                <span style={{ marginLeft: 16 }}>
                  OR No.: <strong>{doc.or_number}</strong>
                </span>
              )}
            </p>
          </div>

          {/* Body */}
          <div style={{ lineHeight: 1.8, textAlign: 'justify' }}>
            <p style={{ marginBottom: 16 }}>
              TO WHOM IT MAY CONCERN:
            </p>

            <p style={{ marginBottom: 12 }}>
              {getDocumentBody(
                doc.document_type,
                doc.resident_name,
                doc.resident_address,
                doc.resident_age,
                doc.resident_civil_status,
                doc.purpose
              )}
            </p>

            <p style={{ marginBottom: 24 }}>
              This certification is issued upon the request of the above-named person
              for whatever legal purpose it may serve.
            </p>

            {/* Validity */}
            <p style={{ marginBottom: 24, fontSize: '10pt' }}>
              Issued this{' '}
              <strong>
                {new Date(doc.issued_date).toLocaleDateString('en-PH', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </strong>
              {' '}at {settings.barangay_name}, {settings.city},{' '}
              {settings.province}.
            </p>

            <p style={{ fontSize: '10pt', color: '#444', marginBottom: 32 }}>
              Valid until:{' '}
              <strong>
                {new Date(doc.expiry_date).toLocaleDateString('en-PH', {
                  month: 'long', day: 'numeric', year: 'numeric'
                })}
              </strong>
            </p>

            {/* Signature Block */}
            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <div style={{ display: 'inline-block', minWidth: 240 }}>
                <div style={{
                  borderBottom: '1px solid #000',
                  marginBottom: 4,
                  paddingBottom: 4,
                  minHeight: 48
                }}>
                  {/* Signature image will go here when we have it */}
                </div>
                <p style={{
                  margin: '0 0 2px', fontSize: '12pt',
                  fontWeight: 'bold', textTransform: 'uppercase'
                }}>
                  {doc.punong_barangay ?? 'PUNONG BARANGAY'}
                </p>
                <p style={{ margin: 0, fontSize: '10pt' }}>
                  Punong Barangay
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '9pt', color: '#444' }}>
                  {settings.barangay_name}, {settings.city}
                </p>
              </div>
            </div>
          </div>

          {/* Footer with QR */}
          <div style={{
            position: 'absolute',
            bottom: '0.4in', left: '0.65in', right: '0.65in',
            display: 'flex', alignItems: 'flex-end',
            justifyContent: 'space-between',
            borderTop: '1px solid #ccc', paddingTop: 8
          }}>
            <div style={{ fontSize: '8pt', color: '#666' }}>
              <p style={{ margin: '0 0 2px' }}>
                Issued by: {doc.issued_by_name}
              </p>
              <p style={{ margin: 0 }}>
                Date/Time: {new Date(doc.created_at).toLocaleString('en-PH')}
              </p>
              {doc.reprint_count > 0 && (
                <p style={{ margin: '2px 0 0', color: '#dc2626' }}>
                  REPRINT #{doc.reprint_count}
                </p>
              )}
            </div>
            <div style={{ textAlign: 'center' }}>
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="Verification QR Code"
                  style={{ width: 72, height: 72 }}
                />
              )}
              <p style={{ margin: '4px 0 0', fontSize: '7pt', color: '#666' }}>
                Scan to verify
              </p>
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
          within the jurisdiction of this barangay. The said business has
          complied with the requirements of this barangay{purposeEl}.
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