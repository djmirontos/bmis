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
    <div className="min-h-screen flex bg-slate-100">
      {/* LEFT PANEL — Government Blue (Hidden on Mobile) */}
      <div className="hidden md:flex md:w-2/5 bg-gradient-to-br from-slate-900 via-blue-900 to-blue-800" style={{ flexDirection: 'column', padding: '48px 32px', justifyContent: 'space-between', alignItems: 'center', textAlign: 'center' }}>
        {/* Logo + Barangay Info */}
        <div>
          {/* Logo Circle */}
          <div style={{
            width: 120, height: 120, borderRadius: '50%',
            background: logoError || !settings.logo_url ? '#1e40af' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', overflow: 'hidden',
            border: '3px solid rgba(255,255,255,0.3)'
          }}>
            {settings.logo_url && !logoError ? (
              <img
                src={settings.logo_url}
                alt="Government Seal"
                onError={() => setLogoError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <span style={{ fontSize: 28, fontWeight: 700, color: 'white' }}>
                {settings.barangay_name.charAt(settings.barangay_name.length - 1)}
              </span>
            )}
          </div>

          {/* Barangay Info */}
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Republic of the Philippines
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: '0 0 8px' }}>
            {settings.barangay_name}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {settings.city}, {settings.province}
          </p>

          {/* Divider */}
          <div style={{ width: 60, height: '1px', background: 'rgba(255,255,255,0.2)', margin: '24px auto' }} />

          {/* System Name */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: '0 0 4px' }}>
            Barangay Management
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Information System
          </p>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>
            Powered by BMIS Platform
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
            v1.0 · For authorized personnel only
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — Login Form */}
      <div className="w-full md:w-3/5 flex items-center justify-center" style={{ background: 'white', padding: '24px' }}>
        <div style={{ width: '100%', maxWidth: 380 }}>

          {/* Mobile Logo Section (Hidden on Desktop) */}
          <div className="md:hidden" style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: logoError || !settings.logo_url ? '#1e40af' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px', overflow: 'hidden',
              border: '3px solid #e2e8f0'
            }}>
              {settings.logo_url && !logoError ? (
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  onError={() => setLogoError(true)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>
                  {settings.barangay_name.charAt(settings.barangay_name.length - 1)}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              {settings.barangay_name}
            </h1>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              {settings.city}, {settings.province}
            </p>
          </div>

          {/* Form Card */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 32 }}>

            {/* Form Header */}
            <p style={{ fontSize: 10, color: '#1e40af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 16px' }}>
              Official Access Portal
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>
              Sign in to your account
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 32px' }}>
              Enter your credentials to continue
            </p>

            {/* Error Banner */}
            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 6, marginBottom: 20,
                background: '#fef2f2', border: '1px solid #fecaca',
                borderLeft: '3px solid #dc2626',
                fontSize: 13, color: '#dc2626'
              }}>
                {error}
              </div>
            )}

            {/* Email Field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: '#374151', marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.gov.ph"
                disabled={loading}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '1.5px solid #e2e8f0', borderRadius: 8,
                  fontSize: 14, color: '#0f172a',
                  background: '#f8fafc',
                  boxSizing: 'border-box' as const,
                  outline: 'none', transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#1e40af'
                  e.target.style.background = 'white'
                  e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.background = '#f8fafc'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 28 }}>
              <label style={{
                display: 'block', fontSize: 12, fontWeight: 600,
                color: '#374151', marginBottom: 8,
                textTransform: 'uppercase', letterSpacing: '0.04em'
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
                  width: '100%', padding: '11px 14px',
                  border: '1.5px solid #e2e8f0', borderRadius: 8,
                  fontSize: 14, color: '#0f172a',
                  background: '#f8fafc',
                  boxSizing: 'border-box' as const,
                  outline: 'none', transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                onFocus={e => {
                  e.target.style.borderColor = '#1e40af'
                  e.target.style.background = 'white'
                  e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#e2e8f0'
                  e.target.style.background = '#f8fafc'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            {/* Sign In Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%', padding: '12px',
                background: loading ? '#93c5fd' : '#1e40af',
                color: 'white', border: 'none',
                borderRadius: 8, fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8,
                boxShadow: loading ? 'none' : '0 2px 8px rgba(30,64,175,0.3)',
                transition: 'all 0.2s',
                fontFamily: 'inherit'
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.target as HTMLButtonElement).style.background = '#1d4ed8'
                  ;(e.target as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(30,64,175,0.4)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  (e.target as HTMLButtonElement).style.background = '#1e40af'
                  ;(e.target as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(30,64,175,0.3)'
                }
              }}
            >
              {loading && <Loader2 size={16} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            {/* Divider */}
            <div style={{ height: '1px', background: '#e2e8f0', margin: '24px 0' }} />

            {/* Official Notice */}
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: 6, padding: '10px 14px',
              fontSize: 11, color: '#1e40af', lineHeight: 1.6
            }}>
              ⚠ This is an official government system. Unauthorized access is prohibited and may be subject to legal action under applicable Philippine laws.
            </div>
          </div>

          {/* Footer */}
          <p style={{
            textAlign: 'center', fontSize: 11,
            color: '#94a3b8', marginTop: 24
          }}>
            © {new Date().getFullYear()} BMIS Platform · Republic of the Philippines
          </p>
        </div>
      </div>
    </div>
  )
}
