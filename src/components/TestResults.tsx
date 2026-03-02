import './TestResults.css'

interface TestResult {
  id: string
  name: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  error?: string
  logs: string[]
}

interface TestResultsProps {
  results: {
    total: number
    passed: number
    failed: number
    duration: number
    tests: TestResult[]
  }
}

export function TestResults({ results }: TestResultsProps) {
  return (
    <div className="test-results">
      <div className="results-header">
        <h3>Test Results</h3>
        <div className="results-badge">
          {results.failed === 0 ? (
            <span className="badge success">All Passed</span>
          ) : (
            <span className="badge failure">{results.failed} Failed</span>
          )}
        </div>
      </div>

      <div className="results-stats">
        <div className="stat">
          <span className="stat-value passed">{results.passed}</span>
          <span className="stat-label">Passed</span>
        </div>
        <div className="stat">
          <span className="stat-value failed">{results.failed}</span>
          <span className="stat-label">Failed</span>
        </div>
        <div className="stat">
          <span className="stat-value total">{results.total}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat">
          <span className="stat-value duration">{results.duration}ms</span>
          <span className="stat-label">Time</span>
        </div>
      </div>

      <div className="results-timeline">
        {results.tests.map((test, index) => (
          <div 
            key={test.id} 
            className={`timeline-item ${test.status}`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="timeline-marker">
              {test.status === 'passed' && '✓'}
              {test.status === 'failed' && '✗'}
              {test.status === 'running' && '◐'}
              {test.status === 'pending' && '○'}
            </div>
            <div className="timeline-content">
              <div className="timeline-test-name">{test.name}</div>
              <div className="timeline-meta">
                {test.duration && <span>{test.duration}ms</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {results.tests.some(t => t.error) && (
        <div className="error-panel">
          <h4>Errors</h4>
          {results.tests.filter(t => t.error).map(test => (
            <div key={test.id} className="error-item">
              <div className="error-test">{test.name}</div>
              <div className="error-message">{test.error}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
