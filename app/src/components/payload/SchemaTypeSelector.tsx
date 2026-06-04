'use client'

import { useFormFields } from '@payloadcms/ui'
import { SCHEMA_DESCRIPTIONS, type SchemaType } from '../../lib/schema'

export const SchemaTypeSelector = () => {
  const schemaType = useFormFields(([fields]) => fields?.['structuredData.schemaType']?.value as SchemaType)
  const selectedType: SchemaType = schemaType || 'CreativeWork'
  const schema = SCHEMA_DESCRIPTIONS[selectedType]

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
        Selected Schema Type
      </h3>
      <div
        style={{
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          padding: '12px',
          marginBottom: '12px',
        }}
      >
        <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>
          {schema.title}
        </p>
        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280', lineHeight: 1.5 }}>
          {schema.description}
        </p>
        <a
          href={schema.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '12px',
            color: '#3b82f6',
            textDecoration: 'none',
          }}
        >
          Learn more on schema.org →
        </a>
      </div>
    </div>
  )
}
