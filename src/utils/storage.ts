import { FileNode, LineageEdge, LineageGraph, Project, FileMetadata, EdgeMetadata } from '../types';

const STORAGE_KEY = 'file-lineage-tool-data';

export interface StoredData {
  projects: Project[];
  currentProjectId: string | null;
}

function getDefaultData(): StoredData {
  return {
    projects: [],
    currentProjectId: null
  };
}

export function loadData(): StoredData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load data:', error);
  }
  return getDefaultData();
}

export function saveData(data: StoredData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save data:', error);
  }
}

export function createProject(name: string, folderPath: string): Project {
  return {
    id: `project-${Date.now()}`,
    name,
    folderPath,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    fileMetadata: {},
    edgeMetadata: {},
    confirmedEdges: [],
    deprecatedEdges: [],
    deprecatedFiles: []
  };
}

export function saveProject(project: Project): void {
  const data = loadData();
  const index = data.projects.findIndex(p => p.id === project.id);
  
  project.lastModified = new Date().toISOString();
  
  if (index >= 0) {
    data.projects[index] = project;
  } else {
    data.projects.push(project);
  }
  
  data.currentProjectId = project.id;
  saveData(data);
}

export function loadProject(projectId: string): Project | null {
  const data = loadData();
  return data.projects.find(p => p.id === projectId) || null;
}

export function getCurrentProject(): Project | null {
  const data = loadData();
  if (data.currentProjectId) {
    return loadProject(data.currentProjectId);
  }
  return null;
}

export function deleteProject(projectId: string): void {
  const data = loadData();
  data.projects = data.projects.filter(p => p.id !== projectId);
  if (data.currentProjectId === projectId) {
    data.currentProjectId = data.projects[0]?.id || null;
  }
  saveData(data);
}

export function updateFileMetadata(projectId: string, fileId: string, metadata: Partial<FileMetadata>): void {
  const project = loadProject(projectId);
  if (project) {
    if (!project.fileMetadata[fileId]) {
      project.fileMetadata[fileId] = { fileId };
    }
    project.fileMetadata[fileId] = { ...project.fileMetadata[fileId], ...metadata };
    saveProject(project);
  }
}

export function saveEdgeMetadata(projectId: string, edgeId: string, metadata: Partial<EdgeMetadata>): void {
  const project = loadProject(projectId);
  if (project) {
    if (!project.edgeMetadata[edgeId]) {
      project.edgeMetadata[edgeId] = { edgeId };
    }
    project.edgeMetadata[edgeId] = { ...project.edgeMetadata[edgeId], ...metadata };
    saveProject(project);
  }
}

export function confirmEdge(projectId: string, edgeId: string): void {
  const project = loadProject(projectId);
  if (project && !project.confirmedEdges.includes(edgeId)) {
    project.confirmedEdges.push(edgeId);
    if (project.edgeMetadata[edgeId]) {
      project.edgeMetadata[edgeId].confirmed = true;
    }
    saveProject(project);
  }
}

export function deprecateEdge(projectId: string, edgeId: string): void {
  const project = loadProject(projectId);
  if (project) {
    if (!project.deprecatedEdges.includes(edgeId)) {
      project.deprecatedEdges.push(edgeId);
    }
    if (project.edgeMetadata[edgeId]) {
      project.edgeMetadata[edgeId].deprecated = true;
    }
    saveProject(project);
  }
}

export function deprecateFile(projectId: string, fileId: string): void {
  const project = loadProject(projectId);
  if (project && !project.deprecatedFiles.includes(fileId)) {
    project.deprecatedFiles.push(fileId);
    saveProject(project);
  }
}

export function undeprecateFile(projectId: string, fileId: string): void {
  const project = loadProject(projectId);
  if (project) {
    project.deprecatedFiles = project.deprecatedFiles.filter(id => id !== fileId);
    saveProject(project);
  }
}

export function getFileMetadata(projectId: string, fileId: string): FileMetadata | null {
  const project = loadProject(projectId);
  return project?.fileMetadata[fileId] || null;
}

export function getEdgeMetadata(projectId: string, edgeId: string): EdgeMetadata | null {
  const project = loadProject(projectId);
  return project?.edgeMetadata[edgeId] || null;
}

export function getStableEdgeId(sourceFile: FileNode, targetFile: FileNode, type: string): string {
  return `${type}-${sourceFile.name}-${sourceFile.extension}-to-${targetFile.name}-${targetFile.extension}`;
}

export function applyProjectState(graph: LineageGraph, project: Project): LineageGraph {
  return {
    nodes: graph.nodes.map(node => ({
      ...node,
      deprecated: project.deprecatedFiles.includes(node.id) ||
        Object.values(project.fileMetadata).some(m => m.fileId === node.id && m.deprecated)
    })),
    edges: graph.edges.map(edge => {
      const meta = project.edgeMetadata[edge.id];
      return {
        ...edge,
        type: meta?.type || edge.type,
        confidence: meta?.confidence ?? edge.confidence,
        reason: meta?.reason || edge.reason,
        confirmed: project.confirmedEdges.includes(edge.id) || edge.confirmed || meta?.confirmed || false,
        deprecated: project.deprecatedEdges.includes(edge.id) || edge.deprecated || meta?.deprecated || false
      };
    })
  };
}

export function getAllProjects(): Project[] {
  return loadData().projects;
}

export function setCurrentProject(projectId: string | null): void {
  const data = loadData();
  data.currentProjectId = projectId;
  saveData(data);
}
