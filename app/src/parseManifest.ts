import dagre from 'dagre'
import { type Edge, Position, type Node } from 'reactflow'

export interface DbtNode {
  id: string
  label: string
  nodeType: 'model' | 'seed' | 'source'
  schema: string
  description: string
  columns: string[]
  dependsOn: string[]
}

export interface ParsedGraph {
  nodes: Node[]
  edges: Edge[]
}

export interface LayoutOptions {
  nodeSpacing: number
  rankSpacing: number
  nodeSizeMultiplier: number
}

type DbtNodeType = DbtNode['nodeType']

interface ManifestRelation {
  name: string
  resource_type: string
  schema?: string
  description?: string
  depends_on?: {
    nodes?: string[]
  }
}

interface ManifestFile {
  nodes?: Record<string, ManifestRelation>
  sources?: Record<string, ManifestRelation>
}

interface CatalogRelation {
  description?: string
  columns?: Record<string, unknown>
}

interface CatalogFile {
  nodes?: Record<string, CatalogRelation>
  sources?: Record<string, CatalogRelation>
}

export const BASE_NODE_WIDTH = 240
export const BASE_NODE_HEIGHT = 88

const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  nodeSpacing: 40,
  rankSpacing: 120,
  nodeSizeMultiplier: 1.0,
}

const isDbtNodeType = (resourceType: string): resourceType is DbtNodeType => {
  return (['model', 'seed', 'source'] as const).includes(resourceType as DbtNodeType)
}

const getCatalogRelation = (
  catalog: CatalogFile,
  nodeType: DbtNodeType,
  id: string,
): CatalogRelation | undefined => {
  if (nodeType === 'source') {
    return catalog.sources?.[id]
  }

  return catalog.nodes?.[id]
}

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  return (await response.json()) as T
}

const layoutNodes = (nodes: Node[], edges: Edge[], options: LayoutOptions): Node[] => {
  const nodeWidth = BASE_NODE_WIDTH * options.nodeSizeMultiplier
  const nodeHeight = BASE_NODE_HEIGHT * options.nodeSizeMultiplier
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', nodesep: options.nodeSpacing, ranksep: options.rankSpacing })

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target)
  })

  dagre.layout(graph)

  return nodes.map((node) => {
    const position = graph.node(node.id)

    return {
      ...node,
      position: {
        x: position.x - nodeWidth / 2,
        y: position.y - nodeHeight / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
  })
}

export const fetchDbtNodes = async (): Promise<DbtNode[]> => {
  const [manifest, catalog] = await Promise.all([
    fetchJson<ManifestFile>(`${import.meta.env.BASE_URL}manifest.json`),
    fetchJson<CatalogFile>(`${import.meta.env.BASE_URL}catalog.json`),
  ])

  const relations = [
    ...Object.entries(manifest.nodes ?? {}),
    ...Object.entries(manifest.sources ?? {}),
  ]

  const dbtNodes: DbtNode[] = relations
    .filter(([, relation]) => isDbtNodeType(relation.resource_type))
    .map(([id, relation]) => {
      const nodeType = relation.resource_type as DbtNodeType
      const catalogRelation = getCatalogRelation(catalog, nodeType, id)

      return {
        id,
        label: relation.name,
        nodeType,
        schema: relation.schema ?? '',
        description: catalogRelation?.description ?? relation.description ?? '',
        columns: Object.keys(catalogRelation?.columns ?? {}),
        dependsOn: relation.depends_on?.nodes ?? [],
      }
    })

  return dbtNodes
}

export const layoutGraph = (dbtNodes: DbtNode[], options: LayoutOptions): ParsedGraph => {
  const nodeIds = new Set(dbtNodes.map((node) => node.id))

  const edges: Edge[] = dbtNodes.flatMap((node) =>
    node.dependsOn
      .filter((dependencyId) => nodeIds.has(dependencyId))
      .map((dependencyId) => ({
        id: `${dependencyId}-${node.id}`,
        source: dependencyId,
        target: node.id,
      })),
  )

  const reactFlowNodes: Node[] = dbtNodes.map((node) => ({
    id: node.id,
    data: {
      label: node.label,
      nodeType: node.nodeType,
      schema: node.schema,
      description: node.description,
      columns: node.columns,
    },
    position: { x: 0, y: 0 },
  }))

  return {
    nodes: layoutNodes(reactFlowNodes, edges, options),
    edges,
  }
}

export const parseManifest = async (): Promise<ParsedGraph> => {
  const dbtNodes = await fetchDbtNodes()

  return layoutGraph(dbtNodes, DEFAULT_LAYOUT_OPTIONS)
}
