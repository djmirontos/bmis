'use client'

import {
  createContext, useContext, useEffect,
  useState, useCallback, type ReactNode
} from 'react'

export interface PublicSettings {
  barangay_name: string
  city: string
  province: string
  region: string
  logo_url: string | null
  city_logo_url: string | null
  contact_number: string | null
  email_address: string | null
}

const defaultSettings: PublicSettings = {
  barangay_name: process.env.NEXT_PUBLIC_BARANGAY_NAME ?? 'Barangay IV',
  city: process.env.NEXT_PUBLIC_CITY ?? 'Tangub City',
  province: process.env.NEXT_PUBLIC_PROVINCE ?? 'Misamis Occidental',
  region: process.env.NEXT_PUBLIC_REGION ?? 'Region X',
  logo_url: null,
  city_logo_url: null,
  contact_number: null,
  email_address: null,
}

const SettingsContext = createContext<{
  settings: PublicSettings
  loading: boolean
  refresh: () => void
}>({
  settings: defaultSettings,
  loading: true,
  refresh: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/barangay-info', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setSettings({
          barangay_name: data.barangay_name ?? defaultSettings.barangay_name,
          city: data.city ?? defaultSettings.city,
          province: data.province ?? defaultSettings.province,
          region: data.region ?? defaultSettings.region,
          logo_url: data.logo_url ?? null,
          city_logo_url: data.city_logo_url ?? null,
          contact_number: data.contact_number ?? null,
          email_address: data.email_address ?? null,
        })
      }
    } catch {
      // Keep defaults on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  return (
    <SettingsContext.Provider value={{
      settings, loading, refresh: fetchSettings
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}