import { useState } from 'react'
import { Handle, Position, type NodeProps } from 'reactflow'
import type { LineageNodeData } from '../types'

const typeStyles: Record<
  LineageNodeData['nodeType'],
  {
    icon: string
    iconColor: string
    accentColor: string
    backgroundColor: string
    hoverColor: string
    selectedColor: string
    iconBgColor: string
  }
> = {
  model: {
    icon: '◈',
    iconColor: '#1d4ed8',
    accentColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    hoverColor: '#dbeafe',
    selectedColor: '#1d4ed8',
    iconBgColor: '#bfdbfe',
  },
  seed: {
    icon: '⬡',
    iconColor: '#15803d',
    accentColor: '#22c55e',
    backgroundColor: '#f0fdf4',
    hoverColor: '#dcfce7',
    selectedColor: '#15803d',
    iconBgColor: '#bbf7d0',
  },
  source: {
    icon: '⬟',
    iconColor: '#c2410c',
    accentColor: '#f97316',
    backgroundColor: '#fff7ed',
    hoverColor: '#ffedd5',
    selectedColor: '#c2410c',
    iconBgColor: '#fed7aa',
  },
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

  const backgroundColor = selected
    ? typeStyle.selectedColor
    : isHovered
      ? typeStyle.hoverColor
      : typeStyle.backgroundColor
  const borderColor = selected
    ? typeStyle.selectedColor
    : isHovered || isConnected
      ? typeStyle.accentColor
      : `${typeStyle.accentColor}55`
  const labelColor = selected ? '#ffffff' : '#313539'
  const subTextColor = selected ? 'rgba(255,255,255,0.75)' : '#5e666c'
  const iconBgColor = selected ? 'rgba(255,255,255,0.2)' : typeStyle.iconBgColor
  const iconColor = selected ? '#ffffff' : typeStyle.iconColor
  const boxShadow = selected
    ? `0 0 0 2px ${typeStyle.accentColor}66, 0 4px 12px rgba(0,0,0,0.15)`
    : '0 2px 8px rgba(0,0,0,0.10)'

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
          backgroundColor: iconBgColor,
          border: `1px solid ${typeStyle.accentColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: iconColor,
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
            color: labelColor,
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
            color: subTextColor,
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
