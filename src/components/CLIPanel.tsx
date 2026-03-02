import { useState, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import { CommandList, COMMAND_GROUPS } from './CommandList'
import { TerminalOutput } from './TerminalOutput'
import type { OutputLine } from './TerminalOutput'
import './CLIPanel.css'

const API_BASE_URL = import.meta.env.VITE_ZEROCLAW_API_URL || 'http://localhost:3033'

const WHITELISTED_COMMANDS = COMMAND_GROUPS.flatMap(g => 
  g.commands.map(c => `${g.name} ${c}`)
)

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function CLIPanel() {
  const [commandInput, setCommandInput] = useState('')
  const [outputs, setOutputs] = useState<OutputLine[]>([])
  const [isExecuting, setIsExecuting] = useState(false)

  const addOutput = useCallback((type: OutputLine['type'], content: string) => {
    setOutputs(prev => [...prev, {
      id: generateId(),
      type,
      content,
      timestamp: new Date()
    }])
  }, [])

  const isCommandWhitelisted = (cmd: string): boolean => {
    const trimmed = cmd.trim().toLowerCase()
    return WHITELISTED_COMMANDS.some(allowed => 
      trimmed === allowed.toLowerCase() || trimmed.startsWith(allowed.toLowerCase() + ' ')
    )
  }

  const executeCommand = async () => {
    const cmd = commandInput.trim()
    if (!cmd || isExecuting) return

    if (!isCommandWhitelisted(cmd)) {
      addOutput('error', `Command not whitelisted: ${cmd}`)
      setCommandInput('')
      return
    }

    setIsExecuting(true)
    addOutput('input', cmd)
    setCommandInput('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/cli/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        addOutput('error', errorData.message || `HTTP ${response.status}`)
        return
      }

      const data = await response.json()
      
      if (data.output) {
        addOutput('output', data.output)
      }
      if (data.error) {
        addOutput('error', data.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed'
      addOutput('error', message)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      executeCommand()
    }
  }

  const handleSelectCommand = (cmd: string) => {
    setCommandInput(cmd + ' ')
  }

  return (
    <div className="cli-panel">
      <CommandList onSelectCommand={handleSelectCommand} />
      
      <div className="cli-main">
        <TerminalOutput outputs={outputs} />
        
        <div className="cli-input-area">
          <span className="cli-input-prompt">$</span>
          <input
            type="text"
            className="cli-input"
            value={commandInput}
            onChange={e => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            disabled={isExecuting}
          />
          <button 
            className="cli-execute-btn"
            onClick={executeCommand}
            disabled={isExecuting || !commandInput.trim()}
          >
            {isExecuting ? '...' : 'Execute'}
          </button>
        </div>
        
        <div className="cli-hint">
          <span>Press Enter to execute • Only whitelisted commands allowed</span>
        </div>
      </div>
    </div>
  )
}
