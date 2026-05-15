import type { ColumnInfo } from './parseManifest'

export interface LineageNodeData {
  label: string
  nodeType: 'model' | 'seed' | 'source'
  schema: string
  description: string
  columns: ColumnInfo[]
  rawCode: string
  isDimmed?: boolean
  isConnected?: boolean
}
