import Link from 'next/link'
import { isKnowledgeSource, type KnowledgeSource } from '@/lib/ai-knowledge-types'

export default function KnowledgeSources({ sources }: { sources?: KnowledgeSource[] }) {
  const safeSources = Array.isArray(sources) ? sources.filter(isKnowledgeSource) : []
  if (!safeSources.length) return null
  return (
    <details style={{ fontSize: 12, maxWidth: '90%', marginTop: 6 }}>
      <summary style={{ cursor: 'pointer' }}>Sources ({safeSources.length})</summary>
      <ul style={{ paddingLeft: 18 }}>
        {safeSources.map(source => (
          <li key={source.id} style={{ marginTop: 6 }}>
            <Link href={source.href}>[{source.id}] {source.label}</Link>
            <p style={{ margin: '2px 0' }}>{source.summary}</p>
            <span>Observed {new Date(source.observedAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
