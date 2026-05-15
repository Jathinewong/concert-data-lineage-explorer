import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { LineageNodeData } from '../types'

const typeStyles: Record<LineageNodeData['nodeType'], { icon: string; iconColor: string; accentColor: string }> = {
  model: { icon: '◈', iconColor: '#60a5fa', accentColor: '#3b82f6' },
  seed: { icon: '⬡', iconColor: '#4ade80', accentColor: '#22c55e' },
  source: { icon: '⬟', iconColor: '#fb923c', accentColor: '#f97316' },
}

const hiddenHandleStyle = {
  opacity: 0,
  width: 1,
  height: 1,
  border: 0,
} as const

const LineageNode = ({ data, selected }: NodeProps<LineageNodeData>) => {
  const [isHovered, setIsHovered] = useState(false)
  const typeStyle = typeStyles[data.nodeType]
  const isDimmed = data.isDimmed ?? false
  const isConnected = data.isConnected ?? false

  const backgroundColor = selected ? '#dbeafe' : isHovered ? '#f0f7ff' : '#ffffff'
  const borderColor = selected
    ? '#3b82f6'
    : isHovered
      ? '#7ab8d4'
      : isConnected
        ? typeStyle.accentColor
        : '#b0cfe0'
  const boxShadow = selected
    ? '0 0 0 2px rgba(59,130,246,0.4), 0 4px 12px rgba(0,0,0,0.15)'
    : '0 2px 8px rgba(0,0,0,0.12)'

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        backgroundColor,
        border: `1px solid ${borderColor}`,
        borderLeft: `4px solid ${typeStyle.accentColor}`,
        borderRadius: 8,
        boxShadow,
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: isDimmed ? 0.3 : 1,
        transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandleStyle} />
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: '#e8f0fe',
          border: `1px solid ${typeStyle.accentColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: typeStyle.iconColor,
          fontSize: 16,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {typeStyle.icon}
      </span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1e293b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={data.label}
        >
          {data.label}
        </span>
        <span
          style={{
            fontSize: 11,
            color: '#64748b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={`${data.schema}.${data.label}`}
        >
          {data.schema ? `${data.schema}.${data.label}` : data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Right} style={hiddenHandleStyle} />
    </div>
  )
}

export default LineageNode
