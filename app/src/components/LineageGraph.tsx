import { useEffect, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type Edge,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { parseManifest } from '../parseManifest'

interface LineageNodeData {
  label: string
  nodeType: 'model' | 'seed' | 'source'
  schema: string
  description: string
  columns: string[]
}

const nodeColors: Record<LineageNodeData['nodeType'], string> = {
  model: '#3b82f6',
  seed: '#22c55e',
  source: '#f97316',
}

const styles = {
  full: { width: '100%', height: '100%' } as const,
  panel: {
    height: '100%',
    width: 384,
    overflowY: 'auto',
    borderLeft: '1px solid #e2e8f0',
    backgroundColor: '#fff',
    padding: 16,
    boxSizing: 'border-box',
  } as const,
}

const LineageGraph = () => {
  const [nodes, setNodes] = useState<Node<LineageNodeData>[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNode, setSelectedNode] = useState<LineageNodeData | null>(null)

  useEffect(() => {
    const loadGraph = async () => {
      try {
        const parsed = await parseManifest()

        setNodes(
          parsed.nodes.map((node) => ({
            ...node,
            data: node.data as LineageNodeData,
            style: {
              border: `2px solid ${nodeColors[(node.data as LineageNodeData).nodeType]}`,
              borderRadius: 10,
              backgroundColor: '#ffffff',
              padding: 8,
              width: 240,
            },
          })),
        )
        setEdges(parsed.edges.map((edge) => ({ ...edge, type: 'smoothstep' })))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load lineage graph')
      } finally {
        setIsLoading(false)
      }
    }

    void loadGraph()
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          ...styles.full,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '4px solid #cbd5e1',
            borderTopColor: '#3b82f6',
            animation: 'spin 1s linear infinite',
          }}
        />
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          ...styles.full,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          color: '#dc2626',
          textAlign: 'center',
          padding: 16,
          boxSizing: 'border-box',
        }}
      >
        {error}
      </div>
    )
  }

  return (
    <div style={{ ...styles.full, display: 'flex' }}>
      <div style={{ height: '100%', flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeClick={(_, node) => setSelectedNode(node.data as LineageNodeData)}
        >
          <MiniMap position="bottom-right" zoomable pannable />
          <Controls position="bottom-left" />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>

      {selectedNode ? (
        <aside style={styles.panel}>
          <h2 style={{ margin: '0 0 8px', fontSize: 24 }}>{selectedNode.label}</h2>
          <span
            style={{
              display: 'inline-block',
              marginBottom: 12,
              padding: '4px 8px',
              borderRadius: 9999,
              backgroundColor: '#f1f5f9',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {selectedNode.nodeType}
          </span>
          <p style={{ margin: '0 0 8px', fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>Schema:</span> {selectedNode.schema || 'N/A'}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 14 }}>
            {selectedNode.description || 'No description available.'}
          </p>
          <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
            Columns
          </h3>
          {selectedNode.columns.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14 }}>No columns found.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 14 }}>
              {selectedNode.columns.map((column) => (
                <li key={column} style={{ marginBottom: 4 }}>
                  {column}
                </li>
              ))}
            </ul>
          )}
        </aside>
      ) : null}
    </div>
  )
}

export default LineageGraph
