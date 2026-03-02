import { useState } from 'react'
import './PlaywrightRunner.css'

interface TestResult {
  id: string
  name: string
  status: 'passed' | 'failed' | 'running' | 'pending'
  duration?: number
  error?: string
  logs: string[]
}

interface TestResults {
  total: number
  passed: number
  failed: number
  duration: number
  tests: TestResult[]
}

interface SavedTest {
  id: string
  name: string
  url: string
  assertions: { type: string; selector: string; value?: string }[]
  createdAt: string
}

interface RunHistory {
  id: string
  testId: string
  testName: string
  url: string
  timestamp: string
  results: TestResults | null
}

// Allowed domains for security - can be extended
const ALLOWED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  'example.com',
  'demo.example.com',
]

const STORAGE_KEYS = {
  TESTS: 'playwright_saved_tests',
  HISTORY: 'playwright_run_history',
}

function isAllowedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    return ALLOWED_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11)
}

export function PlaywrightRunner() {
  const [view, setView] = useState<'list' | 'create' | 'run'>('list')
  const [savedTests, setSavedTests] = useState<SavedTest[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.TESTS)
    return stored ? JSON.parse(stored) : []
  })
  const [runHistory, setRunHistory] = useState<RunHistory[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
    return stored ? JSON.parse(stored) : []
  })
  const [selectedTest, setSelectedTest] = useState<SavedTest | null>(null)
  
  // Form state for creating/editing tests
  const [testName, setTestName] = useState('')
  const [testUrl, setTestUrl] = useState('')
  const [assertions, setAssertions] = useState<{ type: string; selector: string; value?: string }[]>([
    { type: 'visible', selector: '', value: '' }
  ])
  
  // Run state
  const [targetUrl, setTargetUrl] = useState('')
  const [testScript, setTestScript] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState<TestResults | null>(null)
  const [urlError, setUrlError] = useState('')

  // Save tests to localStorage
  const saveTests = (tests: SavedTest[]) => {
    localStorage.setItem(STORAGE_KEYS.TESTS, JSON.stringify(tests))
    setSavedTests(tests)
  }

  // Save history to localStorage
  const saveHistory = (history: RunHistory[]) => {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history))
    setRunHistory(history)
  }

  const handleCreateTest = () => {
    setTestName('')
    setTestUrl('')
    setAssertions([{ type: 'visible', selector: '', value: '' }])
    setView('create')
  }

  const handleSaveTest = () => {
    if (!testName.trim()) {
      setUrlError('Please enter a test name')
      return
    }
    if (!testUrl.trim()) {
      setUrlError('Please enter a target URL')
      return
    }
    if (!isAllowedUrl(testUrl)) {
      setUrlError(`URL not allowed. Only testing: ${ALLOWED_DOMAINS.join(', ')}`)
      return
    }

    const newTest: SavedTest = {
      id: generateId(),
      name: testName,
      url: testUrl,
      assertions: assertions.filter(a => a.selector.trim()),
      createdAt: new Date().toISOString()
    }

    const updatedTests = [...savedTests, newTest]
    saveTests(updatedTests)
    setUrlError('')
    setView('list')
  }

  const handleDeleteTest = (id: string) => {
    const updatedTests = savedTests.filter(t => t.id !== id)
    saveTests(updatedTests)
  }

  const handleSelectTest = (test: SavedTest) => {
    setSelectedTest(test)
    setTargetUrl(test.url)
    
    // Generate script from assertions
    const script = generateScriptFromAssertions(test)
    setTestScript(script)
    setView('run')
  }

  const handleRunTest = async () => {
    setUrlError('')
    
    if (!targetUrl.trim()) {
      setUrlError('Please enter a target URL')
      return
    }

    if (!isAllowedUrl(targetUrl)) {
      setUrlError(`URL not allowed. Only testing: ${ALLOWED_DOMAINS.join(', ')}`)
      return
    }

    if (!testScript.trim()) {
      setUrlError('Please enter test script')
      return
    }

    setIsRunning(true)
    
    // Simulated test execution
    const mockResults: TestResults = {
      total: 2,
      passed: 1,
      failed: 1,
      duration: 3450,
      tests: [
        {
          id: '1',
          name: 'homepage loads',
          status: 'passed',
          duration: 2100,
          logs: [
            '[browser] Launching chromium...',
            '[page] Navigating to ' + targetUrl,
            '[page] Page loaded successfully',
            '[page] Network idle reached',
            '✓ Test passed'
          ]
        },
        {
          id: '2',
          name: 'element visible',
          status: 'failed',
          duration: 1350,
          error: 'Expected element to be visible but found 0 elements',
          logs: [
            '[page] Navigating to ' + targetUrl,
            '[locator] Looking for selector',
            '[assertion] Expected: visible',
            '[assertion] Actual: not found',
            '✗ Test failed'
          ]
        }
      ]
    }

    const runningTests = mockResults.tests.map(t => ({ ...t, status: 'running' as const }))
    setResults({
      ...mockResults,
      tests: runningTests,
      passed: 0,
      failed: 0
    })

    // Save to history
    const historyEntry: RunHistory = {
      id: generateId(),
      testId: selectedTest?.id || 'ad-hoc',
      testName: selectedTest?.name || 'Ad-hoc test',
      url: targetUrl,
      timestamp: new Date().toISOString(),
      results: null
    }
    
    setTimeout(() => {
      setResults(mockResults)
      setIsRunning(false)
      
      // Update history with results
      const finalHistory = { ...historyEntry, results: mockResults }
      const updatedHistory = [finalHistory, ...runHistory].slice(0, 50) // Keep last 50
      saveHistory(updatedHistory)
    }, 2500)
  }

  const handleClearResults = () => {
    setResults(null)
  }

  const addAssertion = () => {
    setAssertions([...assertions, { type: 'visible', selector: '', value: '' }])
  }

  const updateAssertion = (index: number, field: string, value: string) => {
    const updated = [...assertions]
    updated[index] = { ...updated[index], [field]: value }
    setAssertions(updated)
  }

  const removeAssertion = (index: number) => {
    if (assertions.length > 1) {
      setAssertions(assertions.filter((_, i) => i !== index))
    }
  }

  const generateScriptFromAssertions = (test: SavedTest): string => {
    const assertionsCode = test.assertions.map(a => {
      if (a.type === 'visible') {
        return `await expect(page.locator('${a.selector}')).toBeVisible();`
      } else if (a.type === 'contains') {
        return `await expect(page.locator('${a.selector}')).toContainText('${a.value}');`
      } else if (a.type === 'equals') {
        return `await expect(page.locator('${a.selector}')).toHaveValue('${a.value}');`
      } else if (a.type === 'url') {
        return `await expect(page).toHaveURL('${a.value}');`
      }
      return ''
    }).join('\n')

    return `// ${test.name}
test('${test.name}', async ({ page }) => {
  await page.goto('${test.url}');
  await page.waitForLoadState('networkidle');
  ${assertionsCode}
});`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  return (
    <div className="playwright-runner">
      <div className="runner-header">
        <h2>Playwright Test Runner</h2>
        <p>Create, manage, and run browser automation tests</p>
      </div>

      <div className="runner-layout">
        {/* Sidebar */}
        <div className="runner-sidebar">
          <div className="sidebar-section">
            <div className="sidebar-header">
              <h3>Tests</h3>
              <button className="add-test-btn" onClick={handleCreateTest}>
                + New
              </button>
            </div>
            <div className="test-list">
              {savedTests.length === 0 ? (
                <div className="empty-state">No saved tests yet</div>
              ) : (
                savedTests.map(test => (
                  <div 
                    key={test.id} 
                    className={`saved-test-item ${selectedTest?.id === test.id ? 'selected' : ''}`}
                    onClick={() => handleSelectTest(test)}
                  >
                    <div className="test-info">
                      <span className="test-name">{test.name}</span>
                      <span className="test-url">{test.url}</span>
                    </div>
                    <button 
                      className="delete-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteTest(test.id)
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Run History</h3>
            <div className="history-list">
              {runHistory.length === 0 ? (
                <div className="empty-state">No run history yet</div>
              ) : (
                runHistory.slice(0, 10).map(entry => (
                  <div key={entry.id} className="history-item">
                    <div className="history-info">
                      <span className="history-name">{entry.testName}</span>
                      <span className="history-time">{formatDate(entry.timestamp)}</span>
                    </div>
                    {entry.results && (
                      <div className="history-results">
                        <span className="passed">{entry.results.passed}</span>
                        <span className="divider">/</span>
                        <span className="failed">{entry.results.failed}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="runner-main">
          {view === 'list' && (
            <div className="welcome-view">
              <h3>Get Started</h3>
              <p>Create a new test or select an existing one from the sidebar.</p>
              <button className="run-button" onClick={handleCreateTest}>
                Create New Test
              </button>
            </div>
          )}

          {view === 'create' && (
            <div className="runner-form">
              <div className="form-header">
                <h3>Create New Test</h3>
                <button className="back-btn" onClick={() => setView('list')}>
                  Back
                </button>
              </div>

              <div className="form-group">
                <label htmlFor="test-name">Test Name</label>
                <input
                  id="test-name"
                  type="text"
                  placeholder="e.g., Homepage loads correctly"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="test-url">Target URL</label>
                <input
                  id="test-url"
                  type="text"
                  placeholder="https://localhost:3000"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className={urlError ? 'error' : ''}
                />
                {urlError && <span className="error-message">{urlError}</span>}
                <span className="help-text">
                  Allowed: {ALLOWED_DOMAINS.join(', ')}
                </span>
              </div>

              <div className="form-group">
                <label>Assertions</label>
                <div className="assertions-list">
                  {assertions.map((assertion, index) => (
                    <div key={index} className="assertion-row">
                      <select
                        value={assertion.type}
                        onChange={(e) => updateAssertion(index, 'type', e.target.value)}
                      >
                        <option value="visible">Is Visible</option>
                        <option value="contains">Contains Text</option>
                        <option value="equals">Equals Value</option>
                        <option value="url">URL Matches</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Selector or URL"
                        value={assertion.selector}
                        onChange={(e) => updateAssertion(index, 'selector', e.target.value)}
                      />
                      {(assertion.type === 'contains' || assertion.type === 'equals') && (
                        <input
                          type="text"
                          placeholder="Expected value"
                          value={assertion.value || ''}
                          onChange={(e) => updateAssertion(index, 'value', e.target.value)}
                        />
                      )}
                      <button 
                        className="remove-assertion"
                        onClick={() => removeAssertion(index)}
                        disabled={assertions.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <button className="add-assertion-btn" onClick={addAssertion}>
                  + Add Assertion
                </button>
              </div>

              <div className="form-actions">
                <button className="save-button" onClick={handleSaveTest}>
                  Save Test
                </button>
              </div>
            </div>
          )}

          {view === 'run' && selectedTest && (
            <div className="runner-form">
              <div className="form-header">
                <h3>Run Test: {selectedTest.name}</h3>
                <button className="back-btn" onClick={() => setView('list')}>
                  Back
                </button>
              </div>

              <div className="form-group">
                <label htmlFor="target-url">Target URL</label>
                <input
                  id="target-url"
                  type="text"
                  placeholder="https://localhost:3000"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  className={urlError ? 'error' : ''}
                />
                {urlError && <span className="error-message">{urlError}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="test-script">Test Script</label>
                <textarea
                  id="test-script"
                  value={testScript}
                  onChange={(e) => setTestScript(e.target.value)}
                  placeholder="// Write your Playwright test here..."
                  rows={12}
                />
              </div>

              <div className="form-actions">
                <button 
                  className="run-button" 
                  onClick={handleRunTest}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <span className="spinner"></span>
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <span className="play-icon">▶</span>
                      Run Tests
                    </>
                  )}
                </button>
                {results && (
                  <button className="clear-button" onClick={handleClearResults}>
                    Clear Results
                  </button>
                )}
              </div>
            </div>
          )}

          {results && view === 'run' && (
            <div className="runner-results">
              <div className="results-summary">
                <div className="summary-item passed">
                  <span className="summary-value">{results.passed}</span>
                  <span className="summary-label">Passed</span>
                </div>
                <div className="summary-item failed">
                  <span className="summary-value">{results.failed}</span>
                  <span className="summary-label">Failed</span>
                </div>
                <div className="summary-item total">
                  <span className="summary-value">{results.total}</span>
                  <span className="summary-label">Total</span>
                </div>
                <div className="summary-item duration">
                  <span className="summary-value">{results.duration}ms</span>
                  <span className="summary-label">Duration</span>
                </div>
              </div>

              <div className="test-list-results">
                {results.tests.map((test) => (
                  <div key={test.id} className={`test-item ${test.status}`}>
                    <div className="test-header">
                      <span className={`status-indicator ${test.status}`}></span>
                      <span className="test-name">{test.name}</span>
                      {test.duration && (
                        <span className="test-duration">{test.duration}ms</span>
                      )}
                    </div>
                    {test.error && (
                      <div className="test-error">{test.error}</div>
                    )}
                    <div className="test-logs">
                      {test.logs.map((log, i) => (
                        <div key={i} className="log-line">{log}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
