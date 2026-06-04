'use client'

import { useFormFields } from '@payloadcms/ui'
import { useState } from 'react'

export const TechStackSelector = () => {
  const [showDetails, setShowDetails] = useState(false)

  // Count selected technology rows from live form state. Rows are keyed as
  // `technologies.0.tech`, `technologies.1.tech`, etc.
  const techCount = useFormFields(([fields]) => {
    if (!fields) return 0
    return Object.keys(fields).filter((k) => /^technologies\.\d+\.tech$/.test(k) && fields[k]?.value).length
  })

  const basicExample = '["React", "Node.js", "AWS"]'
  const detailedExample = JSON.stringify(
    [
      { '@type': 'Thing', name: 'React', url: 'https://react.dev' },
      { '@type': 'Thing', name: 'Node.js', url: 'https://nodejs.org' },
    ],
    null,
    2,
  )

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
          Technology Schema Format
        </h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showDetails}
            onChange={(e) => setShowDetails(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Show detailed schema</span>
        </label>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280' }}>
        {techCount > 0
          ? `${techCount} technolog${techCount === 1 ? 'y' : 'ies'} selected. They will be rendered as schema.org "mentions" on the published page in the format below:`
          : 'Select technologies in the field above. They will be rendered as schema.org "mentions" in the format below:'}
      </p>

      <div
        style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          padding: '12px',
        }}
      >
        <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#6b7280' }}>
          {showDetails ? 'Detailed mode (schema.org Thing objects):' : 'Basic mode (simple array of names):'}
        </p>
        <pre
          style={{
            margin: 0,
            padding: '8px',
            backgroundColor: '#f3f4f6',
            borderRadius: '3px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#1f2937',
            overflowX: 'auto',
          }}
        >
          {showDetails ? detailedExample : basicExample}
        </pre>
      </div>

      <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#dbeafe', borderRadius: '4px', fontSize: '12px', color: '#1e40af' }}>
        <strong>About this field:</strong> The toggle shows how your technologies appear in the schema.org markup. Detailed mode includes documentation URLs and structured data types, giving AI crawlers richer context.
      </div>
    </div>
  )
}
