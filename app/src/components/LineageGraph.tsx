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
import type { LineageNodeData } from '../types'
import LineageNode from './LineageNode'
import {
  BASE_NODE_HEIGHT,
  BASE_NODE_WIDTH,
  fetchDbtNodes,
  layoutGraph,
  type DbtNode,
  type LayoutOptions,
} from '../parseManifest'

const nodeColors: Record<LineageNodeData['nodeType'], string> = {
  model: '#3b82f6',
  seed: '#22c55e',
  source: '#f97316',
}

const DEFAULT_LAYOUT: LayoutOptions = {
  nodeSpacing: 20,
  rankSpacing: 80,
  nodeSizeMultiplier: 1.0,
}

const styles = {
  full: { width: '100%', height: '100%' } as const,
  graphContainer: { height: '100%', flex: 1, position: 'relative' } as const,
  controlsPanel: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 10,
    backgroundColor: '#1a1d35',
    border: '1px solid #2d3154',
    borderRadius: 10,
    padding: 12,
    width: 280,
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
  } as const,
  searchInput: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #2d3154',
    backgroundColor: '#1e2132',
    color: '#f1f5f9',
    marginBottom: 12,
    fontSize: 14,
    outline: 'none',
  } as const,
  panel: {
    height: '100%',
    width: 384,
    overflowY: 'auto',
    borderLeft: '1px solid #2d3154',
    backgroundColor: '#1a1d35',
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
  const [dbtNodes, setDbtNodes] = useState<DbtNode[]>([])
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>(DEFAULT_LAYOUT)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showRawSql, setShowRawSql] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [nodeTypeFilters, setNodeTypeFilters] = useState<Record<LineageNodeData['nodeType'], boolean>>({
    model: true,
    seed: true,
    source: true,
  })
  const flowNodeTypes = useMemo(() => ({ lineageNode: LineageNode }), [])

  useEffect(() => {
    const loadGraph = async () => {
      try {
        const parsedDbtNodes = await fetchDbtNodes()
        setDbtNodes(parsedDbtNodes)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load lineage graph')
      } finally {
        setIsLoading(false)
      }
    }

    void loadGraph()
  }, [])

  const parsedGraph = useMemo(() => layoutGraph(dbtNodes, layoutOptions), [dbtNodes, layoutOptions])

  const baseNodes = useMemo(
    () =>
      parsedGraph.nodes.map((node) => ({
        ...node,
        type: 'lineageNode',
        data: node.data as LineageNodeData,
      })),
    [parsedGraph.nodes],
  )

  const baseEdges = useMemo(
    () =>
      parsedGraph.edges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        animated: false,
        style: {
          stroke: '#2d3154',
          strokeWidth: 1.5,
        },
      })),
    [parsedGraph.edges],
  )

  const selectedNode = useMemo(
    () => baseNodes.find((node) => node.id === selectedNodeId)?.data ?? null,
    [baseNodes, selectedNodeId],
  )

  const fuse = useMemo(
    () =>
      new Fuse(baseNodes, {
        keys: ['data.label', 'data.columns.name', 'data.columns.description'],
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
            selected: isSelected,
            data: {
              ...node.data,
              isConnected: hasSelection && isHighlighted,
              isDimmed: hasSelection && !isHighlighted,
            },
            style: {
              width: BASE_NODE_WIDTH * layoutOptions.nodeSizeMultiplier,
              height: BASE_NODE_HEIGHT * layoutOptions.nodeSizeMultiplier,
              padding: 0,
              border: 'none',
              background: 'transparent',
            },
          }
        }),
    [baseNodes, highlightedNodeIds, layoutOptions.nodeSizeMultiplier, selectedNodeId, visibleNodeIds],
  )

  const displayedEdges = useMemo(
    () =>
      visibleEdges.map((edge) => {
        const hasSelection = selectedNodeId !== null
        const isHighlighted = upstreamEdgeIds.has(edge.id) || downstreamEdgeIds.has(edge.id)

        return {
          ...edge,
          animated: false,
          style: {
            stroke: isHighlighted ? '#3b82f6' : '#2d3154',
            strokeWidth: isHighlighted ? 2.5 : 1.5,
            opacity: hasSelection && !isHighlighted ? 0.1 : 1,
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
          backgroundColor: '#13152a',
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '4px solid #2d3154',
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
          backgroundColor: '#13152a',
          color: '#fda4af',
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
      <div style={{ ...styles.graphContainer, backgroundColor: '#13152a' }}>
        <section style={styles.controlsPanel} aria-label="Search and filters">
          <input
            className="lineage-search-input"
            type="search"
            placeholder="Search model or column..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            style={styles.searchInput}
          />

          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            {(['model', 'seed', 'source'] as const).map((nodeType) => (
              <label
                key={nodeType}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}
              >
                <input
                  type="checkbox"
                  checked={nodeTypeFilters[nodeType]}
                  onChange={(event) =>
                    setNodeTypeFilters((previous) => ({
                      ...previous,
                      [nodeType]: event.target.checked,
                    }))
                  }
                  style={{ accentColor: '#3b82f6' }}
                />
                {nodeType}
              </label>
            ))}
          </div>

          <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>
            Showing {displayedNodes.length} of {baseNodes.length} nodes
          </p>

          <hr style={{ border: 0, borderTop: '1px solid #2d3154', margin: '12px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: '#94a3b8',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              LAYOUT
            </span>
            <button
              type="button"
              onClick={() => setLayoutOptions(DEFAULT_LAYOUT)}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 6,
                border: '1px solid #2d3154',
                backgroundColor: '#252840',
                cursor: 'pointer',
                color: '#94a3b8',
              }}
            >
              Reset
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label htmlFor="node-spacing" style={{ fontSize: 12, color: '#94a3b8', width: 90, flexShrink: 0 }}>
              Node Spacing
            </label>
            <input
              id="node-spacing"
              type="range"
              min={10}
              max={150}
              step={5}
              value={layoutOptions.nodeSpacing}
              onChange={(event) =>
                setLayoutOptions((previous) => ({
                  ...previous,
                  nodeSpacing: Number(event.target.value),
                }))
              }
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: 12, color: '#f1f5f9', width: 36, textAlign: 'right' }}>
              {layoutOptions.nodeSpacing}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label htmlFor="rank-spacing" style={{ fontSize: 12, color: '#94a3b8', width: 90, flexShrink: 0 }}>
              Rank Spacing
            </label>
            <input
              id="rank-spacing"
              type="range"
              min={40}
              max={300}
              step={10}
              value={layoutOptions.rankSpacing}
              onChange={(event) =>
                setLayoutOptions((previous) => ({
                  ...previous,
                  rankSpacing: Number(event.target.value),
                }))
              }
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: 12, color: '#f1f5f9', width: 36, textAlign: 'right' }}>
              {layoutOptions.rankSpacing}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <label htmlFor="node-size" style={{ fontSize: 12, color: '#94a3b8', width: 90, flexShrink: 0 }}>
              Node Size
            </label>
            <input
              id="node-size"
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={layoutOptions.nodeSizeMultiplier}
              onChange={(event) =>
                setLayoutOptions((previous) => ({
                  ...previous,
                  nodeSizeMultiplier: Number(event.target.value),
                }))
              }
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span style={{ fontSize: 12, color: '#f1f5f9', width: 36, textAlign: 'right' }}>
              {layoutOptions.nodeSizeMultiplier.toFixed(1)}×
            </span>
          </div>
        </section>

        <ReactFlow
          nodes={displayedNodes}
          edges={displayedEdges}
          nodeTypes={flowNodeTypes}
          fitView
          onNodeClick={(_, node) => {
            setSelectedNodeId(node.id)
            setShowRawSql(false)
          }}
          onPaneClick={() => {
            setSelectedNodeId(null)
            setShowRawSql(false)
          }}
          style={{ backgroundColor: '#13152a' }}
        >
          <MiniMap
            position="bottom-right"
            zoomable
            pannable
            style={{ backgroundColor: '#1a1d35', border: '1px solid #2d3154' }}
            nodeColor={(node: Node) => nodeColors[(node.data as LineageNodeData).nodeType]}
            maskColor="rgba(19,21,42,0.7)"
          />
          <Controls position="bottom-left" />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1e2132" />
        </ReactFlow>
      </div>

      {selectedNode ? (
        <aside style={styles.panel} tabIndex={0} aria-label="Selected node details">
          <h2 style={{ margin: '0 0 8px', fontSize: 24, color: '#f1f5f9' }}>{selectedNode.label}</h2>
          <span
            style={{
              display: 'inline-block',
              marginBottom: 12,
              padding: '4px 8px',
              borderRadius: 9999,
              backgroundColor: '#252840',
              color: '#94a3b8',
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {selectedNode.nodeType}
          </span>
          <p style={{ margin: '0 0 8px', fontSize: 14, color: '#94a3b8' }}>
            <span style={{ fontWeight: 600, color: '#64748b' }}>Schema:</span> {selectedNode.schema || 'N/A'}
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: '#94a3b8' }}>
            {selectedNode.description || 'No description available.'}
          </p>
          <h3
            style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#f1f5f9' }}
          >
            COLUMNS ({selectedNode.columns.length})
          </h3>
          {selectedNode.columns.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>No columns found.</p>
          ) : (
            <div style={{ margin: 0 }}>
              {selectedNode.columns.map((column) => (
                <div key={column.name}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{column.name}</p>
                  {column.description ? (
                    <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', margin: '2px 0 8px 12px' }}>
                      └─ {column.description}
                    </p>
                  ) : (
                    <p style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', margin: '2px 0 8px 12px' }}>
                      └─ No description
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedNode.rawCode ? (
            <>
              <hr style={{ border: 0, borderTop: '1px solid #2d3154', margin: '12px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3
                  style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', color: '#f1f5f9' }}
                >
                  RAW SQL
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRawSql((previous) => !previous)}
                  style={{
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 6,
                    border: '1px solid #2d3154',
                    backgroundColor: '#252840',
                    cursor: 'pointer',
                    color: '#94a3b8',
                  }}
                >
                  {showRawSql ? '▲ hide' : '▼ show'}
                </button>
              </div>
              {showRawSql ? (
                <pre
                    style={{
                      fontFamily: 'monospace',
                      fontSize: 12,
                      backgroundColor: '#13152a',
                      border: '1px solid #2d3154',
                      color: '#94a3b8',
                      borderRadius: 6,
                    padding: 12,
                    overflowX: 'auto',
                    overflowY: 'auto',
                    whiteSpace: 'pre',
                    maxHeight: 400,
                    margin: '8px 0 0',
                  }}
                >
                  {selectedNode.rawCode}
                </pre>
              ) : null}
            </>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}

export default LineageGraph
