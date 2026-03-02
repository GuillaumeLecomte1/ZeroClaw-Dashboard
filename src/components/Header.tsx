import { useState, useEffect } from 'react'
import { useLocation } from '@tanstack/react-router'
import './Header.css'

const API_BASE_URL = import.meta.env.VITE_ZEROCLAW_API_URL || 'http://localhost:3033'

type ConnectionStatus = 'connected' | 'disconnected' | 'checking'

function getPageTitle(pathname: string): string {
  switch (pathname) {
    case '/':
      return 'Dashboard'
    case '/chat':
      return 'Chat'
    case '/cli':
      return 'CLI'
    case '/playwright':
      return 'Playwright'
    case '/settings':
      return 'Settings'
    default:
      return 'Dashboard'
  }
}

export function Header() {
  const location = useLocation()
  const [status, setStatus] = useState<ConnectionStatus>('checking')

  useEffect(() => {
    let mounted = true

    async function checkConnection() {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)

        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (mounted) {
          setStatus(response.ok ? 'connected' : 'disconnected')
        }
      } catch {
        if (mounted) {
          setStatus('disconnected')
        }
      }
    }

    checkConnection()

    const interval = setInterval(checkConnection, 30000)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const pageTitle = getPageTitle(location.pathname)

  return (
    <header className="header">
      <div className="header-title">
        <h1>{pageTitle}</h1>
      </div>
      <div className="header-status">
        <span className="status-indicator" data-status={status} />
        <span className="status-text">
          {status === 'checking' && 'Checking...'}
          {status === 'connected' && 'Connected'}
          {status === 'disconnected' && 'Disconnected'}
        </span>
      </div>
    </header>
  )
}
