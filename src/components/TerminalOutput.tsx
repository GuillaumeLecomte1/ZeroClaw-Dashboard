import { useRef, useEffect } from 'react'
import './TerminalOutput.css'

export interface OutputLine {
  id: string
  type: 'input' | 'output' | 'error' | 'system'
  content: string
  timestamp: Date
}

interface TerminalOutputProps {
  outputs: OutputLine[]
}

export function TerminalOutput({ outputs }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [outputs])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  return (
    <div className="terminal-output" ref={containerRef}>
      {outputs.length === 0 ? (
        <div className="terminal-empty">
          <div className="terminal-empty-icon">▶</div>
          <div className="terminal-empty-text">Ready for commands</div>
        </div>
      ) : (
        outputs.map(line => (
          <div key={line.id} className={`terminal-line terminal-line--${line.type}`}>
            <span className="terminal-line-time">[{formatTime(line.timestamp)}]</span>
            <span className="terminal-line-prompt">
              {line.type === 'input' ? '$' : line.type === 'error' ? '!' : '>'}
            </span>
            <pre className="terminal-line-content">{line.content}</pre>
          </div>
        ))
      )}
    </div>
  )
}
