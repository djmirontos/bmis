'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { useSettings } from '@/lib/settings-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const { settings } = useSettings()

  async function handleLogin() {
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) {
        setError('Invalid email or password. Please try again.')
        setLoading(false)
        return
      }
      if (data.session) {
        window.location.href = '/dashboard'
        return
      }
      setError('Login failed. Please try again.')
      setLoading(false)
    } catch {
      setError('Unexpected error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo + Barangay Info */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 100, height: 100,
            borderRadius: '50%',
            background: logoError || !settings.logo_url
              ? 'linear-gradient(135deg, #f4a020, #c96008)'
              : 'transparent',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            overflow: 'hidden',
          }}>
            {settings.logo_url && !logoError ? (
              <img
                src={settings.logo_url}
                alt="Barangay Logo"
                onError={() => setLogoError(true)}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{
                fontSize: 24, fontWeight: 700,
                color: 'white', letterSpacing: 1
              }}>
                {settings.barangay_name.charAt(settings.barangay_name.length - 1)}
              </span>
            )}
          </div>

          <h1 style={{
            fontSize: 22, fontWeight: 600,
            color: '#0f172a', margin: '0 0 4px'
          }}>
            {settings.barangay_name}
          </h1>
          <p style={{
            fontSize: 14, color: '#64748b',
            margin: '0 0 2px'
          }}>
            {settings.city}, {settings.province}
          </p>
          <p style={{
            fontSize: 12, color: '#94a3b8', margin: 0
          }}>
            Barangay Management Information System
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: 12,
          border: '2px solid #e8820c',
          padding: 32
        }}>
          <h2 style={{
            fontSize: 17, fontWeight: 600,
            margin: '0 0 4px', color: '#0f172a'
          }}>
            Sign in
          </h2>
          <p style={{
            fontSize: 13, color: '#64748b',
            margin: '0 0 24px'
          }}>
            Enter your credentials to access the system
          </p>

          {error && (
            <div style={{
              padding: '10px 12px', borderRadius: 8,
              marginBottom: 16, background: '#fef2f2',
              border: '1px solid #fecaca',
              fontSize: 13, color: '#dc2626'
            }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 13,
              fontWeight: 500, color: '#374151', marginBottom: 6
            }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '9px 12px',
                border: '1px solid #e2e0d9', borderRadius: 8,
                fontSize: 14, color: '#0f172a',
                boxSizing: 'border-box' as const,
                outline: 'none', transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = '#e8820c'}
              onBlur={e => e.target.style.borderColor = '#e2e0d9'}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={{
              display: 'block', fontSize: 13,
              fontWeight: 500, color: '#374151', marginBottom: 6
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{
                width: '100%', padding: '9px 12px',
                border: '1px solid #e2e0d9', borderRadius: 8,
                fontSize: 14, color: '#0f172a',
                boxSizing: 'border-box' as const,
                outline: 'none', transition: 'border-color 0.15s'
              }}
              onFocus={e => e.target.style.borderColor = '#e8820c'}
              onBlur={e => e.target.style.borderColor = '#e2e0d9'}
            />
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              background: loading
                ? '#f0a050'
                : 'linear-gradient(135deg, #f4a020 0%, #e8820c 40%, #c96008 100%)',
              color: 'white', border: 'none',
              borderRadius: 8, fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
              boxShadow: loading
                ? 'none'
                : '0 4px 12px rgba(244,160,32,0.5)',
              transition: 'all 0.2s'
            }}
          >
            {loading && <Loader2 size={16} />}
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        <p style={{
          textAlign: 'center', fontSize: 11,
          color: '#94a3b8', marginTop: 24
        }}>
          BMIS v1.0 · For authorized personnel only
        </p>
      </div>
    </div>
  )
}