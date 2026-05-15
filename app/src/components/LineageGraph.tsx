import Fuse from 'fuse.js'
import { useEffect, useMemo, useState } from 'react'
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
  graphContainer: { height: '100%', flex: 1, position: 'relative' } as const,
  controlsPanel: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 10,
    padding: 12,
    width: 280,
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.1)',
  } as const,
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    marginBottom: 12,
    fontSize: 14,
  } as const,
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

const getLineageTraversal = (
  startNodeId: string,
  edges: Edge[],
  direction: 'upstream' | 'downstream',
): { nodeIds: Set<string>; edgeIds: Set<string> } => {
  const relationMap = new Map<string, { nodeId: string; edgeId: string }[]>()

  edges.forEach((edge) => {
    const from = direction === 'upstream' ? edge.target : edge.source
    const to = direction === 'upstream' ? edge.source : edge.target
    const relations = relationMap.get(from) ?? []

    relations.push({ nodeId: to, edgeId: edge.id })
    relationMap.set(from, relations)
  })

  const visited = new Set<string>()
  const edgeIds = new Set<string>()
  const stack = [startNodeId]

  while (stack.length > 0) {
    const currentNodeId = stack.pop()
    if (!currentNodeId) {
      continue
    }

    const relations = relationMap.get(currentNodeId) ?? []

    relations.forEach(({ nodeId, edgeId }) => {
      edgeIds.add(edgeId)

      if (!visited.has(nodeId)) {
        visited.add(nodeId)
        stack.push(nodeId)
      }
    })
  }

  return { nodeIds: visited, edgeIds }
}

const LineageGraph = () => {
  const [baseNodes, setBaseNodes] = useState<Node<LineageNodeData>[]>([])
  const [baseEdges, setBaseEdges] = useState<Edge[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [nodeTypeFilters, setNodeTypeFilters] = useState<Record<LineageNodeData['nodeType'], boolean>>({
    model: true,
    seed: true,
    source: true,
  })

  useEffect(() => {
    const loadGraph = async () => {
      try {
        const parsed = await parseManifest()

        setBaseNodes(
          parsed.nodes.map((node) => ({
            ...node,
            data: node.data as LineageNodeData,
          })),
        )
        setBaseEdges(parsed.edges.map((edge) => ({ ...edge, type: 'smoothstep' })))
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load lineage graph')
      } finally {
        setIsLoading(false)
      }
    }

    void loadGraph()
  }, [])

  const selectedNode = useMemo(
    () => baseNodes.find((node) => node.id === selectedNodeId)?.data ?? null,
    [baseNodes, selectedNodeId],
  )

  const fuse = useMemo(
    () =>
      new Fuse(baseNodes, {
        keys: ['data.label', 'data.columns'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [baseNodes],
  )

  const searchMatchedNodeIds = useMemo(() => {
    const normalizedQuery = searchQuery.trim()

    if (!normalizedQuery) {
      return new Set(baseNodes.map((node) => node.id))
    }

    return new Set(fuse.search(normalizedQuery).map((result) => result.item.id))
  }, [baseNodes, fuse, searchQuery])

  const visibleNodeIds = useMemo(
    () =>
      new Set(
        baseNodes
          .filter(
            (node) => nodeTypeFilters[node.data.nodeType] && searchMatchedNodeIds.has(node.id),
          )
          .map((node) => node.id),
      ),
    [baseNodes, nodeTypeFilters, searchMatchedNodeIds],
  )

  const visibleEdges = useMemo(
    () =>
      baseEdges.filter(
        (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
      ),
    [baseEdges, visibleNodeIds],
  )

  const { nodeIds: upstreamNodeIds, edgeIds: upstreamEdgeIds } = useMemo(
    () =>
      selectedNodeId
        ? getLineageTraversal(selectedNodeId, visibleEdges, 'upstream')
        : { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
    [selectedNodeId, visibleEdges],
  )

  const { nodeIds: downstreamNodeIds, edgeIds: downstreamEdgeIds } = useMemo(
    () =>
      selectedNodeId
        ? getLineageTraversal(selectedNodeId, visibleEdges, 'downstream')
        : { nodeIds: new Set<string>(), edgeIds: new Set<string>() },
    [selectedNodeId, visibleEdges],
  )

  const highlightedNodeIds = useMemo(() => {
    const highlighted = new Set<string>([...upstreamNodeIds, ...downstreamNodeIds])

    if (selectedNodeId) {
      highlighted.add(selectedNodeId)
    }

    return highlighted
  }, [downstreamNodeIds, selectedNodeId, upstreamNodeIds])

  const displayedNodes = useMemo(
    () =>
      baseNodes
        .filter((node) => visibleNodeIds.has(node.id))
        .map((node) => {
          const hasSelection = selectedNodeId !== null
          const isSelected = node.id === selectedNodeId
          const isHighlighted = highlightedNodeIds.has(node.id)

          return {
            ...node,
            style: {
              border: `2px solid ${nodeColors[node.data.nodeType]}`,
              borderRadius: 10,
              backgroundColor: isSelected
                ? '#dbeafe'
                : isHighlighted
                  ? '#f8fafc'
                  : '#ffffff',
              padding: 8,
              width: 240,
              opacity: hasSelection && !isHighlighted ? 0.25 : 1,
              boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.35)' : 'none',
            },
          }
        }),
    [baseNodes, highlightedNodeIds, selectedNodeId, visibleNodeIds],
  )

  const displayedEdges = useMemo(
    () =>
      visibleEdges.map((edge) => {
        const hasSelection = selectedNodeId !== null
        const isHighlighted = upstreamEdgeIds.has(edge.id) || downstreamEdgeIds.has(edge.id)

        return {
          ...edge,
          style: {
            stroke: isHighlighted ? '#2563eb' : '#94a3b8',
            strokeWidth: isHighlighted ? 2.5 : 1.5,
            opacity: hasSelection && !isHighlighted ? 0.15 : 0.8,
          },
        }
      }),
    [downstreamEdgeIds, selectedNodeId, upstreamEdgeIds, visibleEdges],
  )

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
      <div style={styles.graphContainer}>
        <section style={styles.controlsPanel} aria-label="Search and filters">
          <input
            type="search"
            placeholder="Search model or column..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={styles.searchInput}
          />

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {(['model', 'seed', 'source'] as const).map((nodeType) => (
              <label key={nodeType} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={nodeTypeFilters[nodeType]}
                  onChange={(event) =>
                    setNodeTypeFilters((previous) => ({
                      ...previous,
                      [nodeType]: event.target.checked,
                    }))
                  }
                />
                {nodeType}
              </label>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
            Showing {displayedNodes.length} of {baseNodes.length} nodes
          </p>
        </section>

        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          fitView
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId(null)}
        >
          <MiniMap position="bottom-right" zoomable pannable />
          <Controls position="bottom-left" />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
      </div>

      {selectedNode ? (
        <aside style={styles.panel} tabIndex={0} aria-label="Selected node details">
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
