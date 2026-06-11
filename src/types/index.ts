export interface FileNode {
  id: string;
  name: string;
  path: string;
  extension: string;
  size: number;
  modifiedTime: string;
  createdTime: string;
  type: 'table' | 'script' | 'report' | 'config' | 'data' | 'other';
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

export interface Project {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
  lastModified: string;
  graph: LineageGraph;
}

export interface FileCard {
  node: FileNode;
  version?: string;
  description?: string;
  owner?: string;
  upstreamFiles: string[];
  downstreamFiles: string[];
  upstreamEdges: LineageEdge[];
  downstreamEdges: LineageEdge[];
}

export interface ChangePreview {
  fileId: string;
  fileName: string;
  action: 'delete' | 'replace';
  affectedReports: FileNode[];
  impactLevel: 'high' | 'medium' | 'low';
}

export interface ColorScheme {
  byOwner: Record<string, string>;
  byDate: Record<string, string>;
  byType: Record<string, string>;
}
