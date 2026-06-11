export interface FileNode {
  id: string;
  name: string;
  path: string;
  extension: string;
  size: number;
  modifiedTime: string;
  createdTime: string;
  type: 'table' | 'script' | 'report' | 'config' | 'data' | 'other';
  deprecated?: boolean;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: 'reference' | 'input' | 'output' | 'version';
  confidence: number;
  confirmed: boolean;
  reason?: string;
  deprecated?: boolean;
}

export interface LineageGraph {
  nodes: FileNode[];
  edges: LineageEdge[];
}

export interface FileMetadata {
  fileId: string;
  owner?: string;
  version?: string;
  description?: string;
  deprecated?: boolean;
}

export interface EdgeMetadata {
  edgeId: string;
  type?: 'reference' | 'input' | 'output' | 'version';
  confidence?: number;
  reason?: string;
  confirmed?: boolean;
  deprecated?: boolean;
}

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
  lastModified: string;
  fileMetadata: Record<string, FileMetadata>;
  edgeMetadata: Record<string, EdgeMetadata>;
  confirmedEdges: string[];
  deprecatedEdges: string[];
  deprecatedFiles: string[];
}

export interface FileCard {
  node: FileNode;
  metadata?: FileMetadata;
  upstreamFiles: FileNode[];
  downstreamFiles: FileNode[];
  upstreamEdges: LineageEdge[];
  downstreamEdges: LineageEdge[];
}

export interface ChangePreview {
  fileId: string;
  fileName: string;
  action: 'delete' | 'replace';
  affectedReports: FileNode[];
  impactLevel: 'high' | 'medium' | 'low';
  deprecated?: boolean;
}

export interface ColorScheme {
  byOwner: Record<string, string>;
  byDate: Record<string, string>;
  byType: Record<string, string>;
}

export interface CollapsedNode {
  nodeId: string;
  collapsed: boolean;
  childNodeIds: string[];
}

export interface SelectionState {
  selectedNodeIds: string[];
  count: number;
}
