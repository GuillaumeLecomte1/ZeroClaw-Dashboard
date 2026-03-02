import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import './Page.css'

interface DashboardStats {
  totalSessions: number
  activeSession: boolean
  commandsExecuted: number
  testsRun: number
  testsPassed: number
}

const API_BASE_URL = import.meta.env.VITE_ZEROCLAW_API_URL || 'http://localhost:3033'

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    activeSession: false,
    commandsExecuted: 0,
    testsRun: 0,
    testsPassed: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/stats`, {
          method: 'GET',
        })
        if (response.ok) {
          const data = await response.json()
          setStats({
            totalSessions: data.totalSessions || 0,
            activeSession: data.activeSession || false,
            commandsExecuted: data.commandsExecuted || 0,
            testsRun: data.testsRun || 0,
            testsPassed: data.testsPassed || 0,
          })
        }
        } catch (e) {
          console.error('Failed to fetch stats:', e)
        } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const quickActions = [
    {
      path: '/chat',
      label: 'New Chat',
      icon: '💬',
      description: 'Start a conversation with ZeroClaw',
      color: '#e94560',
    },
    {
      path: '/cli',
      label: 'CLI Terminal',
      icon: '⌨️',
      description: 'Execute commands directly',
      color: '#4ade80',
    },
    {
      path: '/playwright',
      label: 'Playwright Tests',
      icon: '🎭',
      description: 'Run browser automation tests',
      color: '#60a5fa',
    },
    {
      path: '/settings',
      label: 'Settings',
      icon: '⚙️',
      description: 'Configure preferences',
      color: '#a78bfa',
    },
  ]

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome to ZeroClaw</h1>
        <p>Your AI-powered testing and automation dashboard</p>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <div className="stat-value">{loading ? '-' : stats.totalSessions}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">{stats.activeSession ? '🟢' : '⚪'}</div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeSession ? 'Active' : 'Idle'}</div>
            <div className="stat-label">Status</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚡</div>
          <div className="stat-content">
            <div className="stat-value">{loading ? '-' : stats.commandsExecuted}</div>
            <div className="stat-label">Commands Executed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-value">
              {loading ? '-' : `${stats.testsPassed}/${stats.testsRun}`}
            </div>
            <div className="stat-label">Tests Passed</div>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path} className="action-card">
              <div className="action-icon" style={{ backgroundColor: action.color }}>
                {action.icon}
              </div>
              <div className="action-content">
                <div className="action-label">{action.label}</div>
                <div className="action-description">{action.description}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Getting Started</h2>
        <div className="getting-started">
          <div className="guide-card">
            <div className="guide-step">1</div>
            <div className="guide-content">
              <h3>Start a Chat</h3>
              <p>Begin a conversation to generate tests, analyze code, or get help with your project.</p>
            </div>
          </div>
          <div className="guide-card">
            <div className="guide-step">2</div>
            <div className="guide-content">
              <h3>Use CLI Commands</h3>
              <p>Execute terminal commands directly for file operations, git commands, and more.</p>
            </div>
          </div>
          <div className="guide-card">
            <div className="guide-step">3</div>
            <div className="guide-content">
              <h3>Run Playwright Tests</h3>
              <p>Execute browser automation tests to verify your application works correctly.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
