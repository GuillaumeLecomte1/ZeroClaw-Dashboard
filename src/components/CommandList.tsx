import { useState } from 'react'
import './CommandList.css'

type CommandGroup = {
  name: string
  commands: string[]
  icon: string
}

const COMMAND_GROUPS: CommandGroup[] = [
  { name: 'git', icon: '⎇', commands: ['status', 'pull', 'push', 'commit', 'log'] },
  { name: 'docker', icon: '🐳', commands: ['ps', 'logs', 'restart', 'stats'] },
  { name: 'npm', icon: '📦', commands: ['run', 'test', 'build'] },
  { name: 'curl', icon: '🌐', commands: ['*'] },
]

interface CommandListProps {
  onSelectCommand: (command: string) => void
}

export function CommandList({ onSelectCommand }: CommandListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['git']))

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  const handleCommandClick = (groupName: string, command: string) => {
    onSelectCommand(`${groupName} ${command}`)
  }

  return (
    <div className="command-list">
      <h3 className="command-list-title">Commands</h3>
      <div className="command-groups">
        {COMMAND_GROUPS.map(group => (
          <div key={group.name} className="command-group">
            <button
              className="command-group-header"
              onClick={() => toggleGroup(group.name)}
            >
              <span className="command-group-icon">{group.icon}</span>
              <span className="command-group-name">{group.name}</span>
              <span className="command-group-arrow">
                {expandedGroups.has(group.name) ? '▼' : '▶'}
              </span>
            </button>
            {expandedGroups.has(group.name) && (
              <div className="command-items">
                {group.commands.map(cmd => (
                  <button
                    key={cmd}
                    className="command-item"
                    onClick={() => handleCommandClick(group.name, cmd)}
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export { COMMAND_GROUPS }
