import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CheckCircle, XCircle, AlertTriangle, FileText } from 'lucide-react'

export default async function VerifyPage({
  params
}: {
  params: { id: string }
}) {
  const supabase = await createServerSupabaseClient()

  const [{ data: doc }, { data: settings }] = await Promise.all([
    supabase.from('issued_documents').select('*').eq('id', params.id).single(),
    supabase.from('barangay_settings').select('*').single(),
  ])

  let logoUrl = ''
  if (settings?.logo_path) {
    const { data: { publicUrl } } = supabase.storage
      .from('barangay-assets')
      .getPublicUrl(settings.logo_path)
    logoUrl = publicUrl
  }

  const isValid = doc && doc.status === 'Issued'
  const isExpired = doc && new Date(doc.expiry_date) < new Date()
  const isVoided = doc && doc.status === 'Voided'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, sans-serif',
      padding: '40px 16px'
    }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Barangay Logo"
              style={{
                width: 72, height: 72,
                objectFit: 'contain', marginBottom: 12
              }}
            />
          )}
          <h1 style={{
            fontSize: 18, fontWeight: 600,
            color: '#0f172a', margin: '0 0 4px'
          }}>
            {settings?.barangay_name ?? 'Barangay IV'}
          </h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {settings?.city}, {settings?.province}
          </p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '4px 0 0' }}>
            Document Verification System
          </p>
        </div>

        {!doc ? (
          /* Not Found */
          <div style={{
            background: 'white', borderRadius: 14,
            border: '1px solid #e2e8f0', padding: 32,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <XCircle size={48} color="#dc2626"
              style={{ display: 'block', margin: '0 auto 16px' }} />
            <h2 style={{
              fontSize: 18, fontWeight: 600,
              color: '#dc2626', margin: '0 0 8px'
            }}>
              Document Not Found
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
              The document you are trying to verify does not exist
              in our system. It may have been issued by a different barangay
              or the QR code may be invalid.
            </p>
          </div>
        ) : isVoided ? (
          /* Voided */
          <div style={{
            background: 'white', borderRadius: 14,
            border: '1px solid #fecaca', padding: 32,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <XCircle size={48} color="#dc2626"
              style={{ display: 'block', margin: '0 auto 16px' }} />
            <h2 style={{
              fontSize: 18, fontWeight: 600,
              color: '#dc2626', margin: '0 0 8px'
            }}>
              Document VOIDED
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 16px' }}>
              This document has been officially voided and is no longer valid.
            </p>
            {doc.void_reason && (
              <p style={{
                fontSize: 13, color: '#b91c1c',
                background: '#fef2f2', borderRadius: 8,
                padding: '8px 12px', margin: 0
              }}>
                Reason: {doc.void_reason}
              </p>
            )}
          </div>
        ) : isExpired ? (
          /* Expired */
          <div style={{
            background: 'white', borderRadius: 14,
            border: '1px solid #fde68a', padding: 32,
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <AlertTriangle size={48} color="#d97706"
              style={{ display: 'block', margin: '0 auto 16px' }} />
            <h2 style={{
              fontSize: 18, fontWeight: 600,
              color: '#d97706', margin: '0 0 8px'
            }}>
              Document Expired
            </h2>
            <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 20px' }}>
              This document was valid when issued but has since expired.
            </p>
            <DocumentDetails doc={doc} settings={settings} />
          </div>
        ) : (
          /* Valid */
          <div style={{
            background: 'white', borderRadius: 14,
            border: '1px solid #bbf7d0', padding: 32,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <CheckCircle size={48} color="#16a34a"
                style={{ display: 'block', margin: '0 auto 12px' }} />
              <h2 style={{
                fontSize: 18, fontWeight: 600,
                color: '#15803d', margin: '0 0 4px'
              }}>
                Document Verified
              </h2>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                This is an authentic document issued by{' '}
                {settings?.barangay_name}
              </p>
            </div>
            <DocumentDetails doc={doc} settings={settings} />
          </div>
        )}

        <p style={{
          textAlign: 'center', fontSize: 11,
          color: '#94a3b8', marginTop: 24
        }}>
          BMIS · {settings?.barangay_name}, {settings?.city} ·
          Document Verification Portal
        </p>
      </div>
    </div>
  )
}

function DocumentDetails({ doc, settings }: { doc: any, settings: any }) {
  function Row({ label, value }: { label: string, value?: string | null }) {
    if (!value) return null
    return (
      <div style={{
        display: 'flex', gap: 10, padding: '8px 0',
        borderBottom: '1px solid #f8fafc'
      }}>
        <span style={{
          fontSize: 13, color: '#94a3b8',
          minWidth: 160, flexShrink: 0
        }}>
          {label}
        </span>
        <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
          {value}
        </span>
      </div>
    )
  }

  return (
    <div style={{
      background: '#f8fafc', borderRadius: 10,
      border: '1px solid #e2e8f0', padding: '4px 16px 12px'
    }}>
      <Row label="Control Number" value={doc.control_number} />
      <Row label="Document Type" value={doc.document_type} />
      <Row label="Issued To" value={doc.resident_name} />
      <Row label="Address" value={doc.resident_address} />
      <Row label="Purpose" value={doc.purpose} />
      <Row
        label="Date Issued"
        value={new Date(doc.issued_date).toLocaleDateString('en-PH', {
          month: 'long', day: 'numeric', year: 'numeric'
        })}
      />
      <Row
        label="Valid Until"
        value={new Date(doc.expiry_date).toLocaleDateString('en-PH', {
          month: 'long', day: 'numeric', year: 'numeric'
        })}
      />
      <Row label="Issued By" value={doc.punong_barangay} />
      <Row label="Barangay" value={settings?.barangay_name} />
    </div>
  )
}