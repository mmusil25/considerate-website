'use client'

import { useFormFields } from '@payloadcms/ui'

interface FieldMapping {
  humanLabel: string
  humanValue: string | null
  machineProperty: string
  machineValue: string | null
}

export const SchemaFieldMapper = () => {
  const title = useFormFields(([fields]) => fields?.title?.value as string) || ''
  const description = useFormFields(([fields]) => fields?.description?.value as string) || ''
  const publishedAt = useFormFields(([fields]) => fields?.publishedAt?.value as string) || null
  const liveUrl = useFormFields(([fields]) => fields?.liveUrl?.value as string) || null
  const client = useFormFields(([fields]) => fields?.client?.value as string) || ''

  const dateFormatted = publishedAt
    ? new Date(publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  const mappings: FieldMapping[] = [
    {
      humanLabel: 'Title (your website)',
      humanValue: title || null,
      machineProperty: 'name',
      machineValue: title || null,
    },
    {
      humanLabel: 'Description (your website)',
      humanValue: description || null,
      machineProperty: 'description',
      machineValue: description || null,
    },
    {
      humanLabel: 'Published Date (your website)',
      humanValue: dateFormatted,
      machineProperty: 'datePublished',
      machineValue: publishedAt ? publishedAt.split('T')[0] : null,
    },
    {
      humanLabel: 'Live URL (your website)',
      humanValue: liveUrl || null,
      machineProperty: 'url',
      machineValue: liveUrl || null,
    },
    {
      humanLabel: 'Client (your website)',
      humanValue: client || null,
      machineProperty: 'author.name',
      machineValue: client || null,
    },
  ]

  return (
    <div style={{ padding: '16px 0', borderTop: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
        Auto-Mapped Fields
      </h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#6b7280' }}>
        These fields automatically map from your content to schema.org properties. Review the mapping below:
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          backgroundColor: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '4px',
          padding: '12px',
        }}
      >
        {/* Header */}
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px' }}>
          👤 Human-Readable (Website)
        </div>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', borderBottom: '1px solid #d1d5db', paddingBottom: '8px' }}>
          🤖 Machine-Readable (schema.org)
        </div>

        {/* Mappings */}
        {mappings.map((mapping, idx) => (
          <div key={idx} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingBottom: '12px', borderBottom: idx < mappings.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
            <div>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>
                {mapping.humanLabel}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: mapping.humanValue ? '#1f2937' : '#d1d5db' }}>
                {mapping.humanValue || '(empty)'}
              </p>
            </div>

            <div>
              <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>
                schema.org/{mapping.machineProperty}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  color: mapping.machineValue ? '#059669' : '#d1d5db',
                  fontFamily: 'monospace',
                }}
              >
                {mapping.machineValue || '(empty)'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '12px', padding: '8px 12px', backgroundColor: '#ecf0f1', borderRadius: '4px', fontSize: '12px', color: '#34495e' }}>
        <strong>Tip:</strong> Fill in all fields above, and they will automatically populate the schema.org markup that appears in your page&apos;s &lt;head&gt;.
      </div>
    </div>
  )
}
