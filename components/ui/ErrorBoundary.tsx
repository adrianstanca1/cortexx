'use client'

import React from 'react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-system)' }}>
          <div style={{ color: '#ef4444', fontSize: 14, marginBottom: 8 }}>
            Something went wrong
          </div>
          <div style={{ color: '#52749a', fontSize: 12, marginBottom: 16 }}>
            {this.state.error?.message || 'Unexpected error'}
          </div>
          <button
            onClick={this.reset}
            style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontFamily: 'var(--font-system)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
