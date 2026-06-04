'use client'

import { useFormFields } from '@payloadcms/ui'
import { useState } from 'react'
import { type SchemaType } from '../../lib/schema'

export const JSONLDPreview = () => {
  const [isExpanded, setIsExpanded] = useState(false)

  const schemaType =
    (useFormFields(([fields]) => fields?.['structuredData.schemaType']?.value as SchemaType)) || 'CreativeWork'
  const title = useFormFields(([fields]) => fields?.title?.value as string) || 'Untitled Project'
  const description = useFormFields(([fields]) => fields?.description?.value as string) || ''
  const publishedAt = useFormFields(([fields]) => fields?.publishedAt?.value as string) || ''
  const liveUrl = useFormFields(([fields]) => fields?.liveUrl?.value as string) || ''
  const client = useFormFields(([fields]) => fields?.client?.value as string) || ''

  // Build a preview JSON-LD object from live form values. Technologies are a
  // relationship array whose names only resolve once populated server-side, so
  // the live preview focuses on scalar fields; the published page adds mentions.
  const jsonld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: title,
  }
  if (description) jsonld.description = description
  if (publishedAt) jsonld.datePublished = publishedAt.split('T')[0]
  if (liveUrl) jsonld.url = liveUrl
  if (client) jsonld.author = { '@type': 'Organization', name: client }

  const jsonBody = JSON.stringify(jsonld, null, 2)

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid #e5e7eb' }}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#1f2937',
          color: '#ffffff',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: isExpanded ? '12px' : 0,
        }}
      >
        <span>📋 {isExpanded ? 'Hide' : 'Show'} Generated JSON-LD Code</span>
        <span style={{ fontSize: '12px' }}>{isExpanded ? '▼' : '▶'}</span>
      </button>

      {isExpanded && (
        <div
          style={{
            backgroundColor: '#0f172a',
            color: '#e2e8f0',
            padding: '16px',
            borderRadius: '4px',
            fontFamily: 'Courier, monospace',
            fontSize: '12px',
            lineHeight: '1.5',
            overflowX: 'auto',
            border: '1px solid #334155',
          }}
        >
          <div style={{ color: '#94a3b8', marginBottom: '8px' }}>
            &lt;!-- This code is injected into your page&apos;s &lt;head&gt; --&gt;
          </div>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <span style={{ color: '#f87171' }}>{'<script '}</span>
            <span style={{ color: '#fbbf24' }}>{'type'}</span>
            <span style={{ color: '#34d399' }}>{'="application/ld+json"'}</span>
            <span style={{ color: '#f87171' }}>{'>'}</span>
            {'\n'}
            <span style={{ color: '#e2e8f0' }}>{jsonBody}</span>
            {'\n'}
            <span style={{ color: '#f87171' }}>{'</script>'}</span>
          </pre>

          <div style={{ marginTop: '12px', padding: '8px', backgroundColor: '#1e293b', borderRadius: '4px', fontSize: '11px', color: '#cbd5e1' }}>
            <p style={{ margin: '0 0 4px' }}>
              <strong>Next steps:</strong>
            </p>
            <ul style={{ margin: '4px 0 0', paddingLeft: '16px' }}>
              <li>This JSON-LD is automatically injected into your page&apos;s &lt;head&gt;</li>
              <li>Google and AI crawlers read this to understand your project</li>
              <li>Selected technologies are added as <code>mentions</code> on the published page</li>
              <li>
                Validate with{' '}
                <a href="https://search.google.com/test/rich-results" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>
                  Google&apos;s Rich Results Test
                </a>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
