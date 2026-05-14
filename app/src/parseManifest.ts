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

const NODE_WIDTH = 240
const NODE_HEIGHT = 88

const isDbtNodeType = (resourceType: string): resourceType is DbtNodeType => {
  return resourceType === 'model' || resourceType === 'seed' || resourceType === 'source'
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
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  return (await response.json()) as T
}

const layoutNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120 })

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
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
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
  })
}

export const parseManifest = async (): Promise<ParsedGraph> => {
  const [manifest, catalog] = await Promise.all([
    fetchJson<ManifestFile>('/manifest.json'),
    fetchJson<CatalogFile>('/catalog.json'),
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
    nodes: layoutNodes(reactFlowNodes, edges),
    edges,
  }
}
