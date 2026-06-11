import { FileNode, LineageEdge, LineageGraph, Project, FileMetadata } from '../types';

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

export function confirmEdge(projectId: string, edgeId: string): void {
  const project = loadProject(projectId);
  if (project && !project.confirmedEdges.includes(edgeId)) {
    project.confirmedEdges.push(edgeId);
    saveProject(project);
  }
}

export function deprecateEdge(projectId: string, edgeId: string): void {
  const project = loadProject(projectId);
  if (project) {
    if (!project.deprecatedEdges.includes(edgeId)) {
      project.deprecatedEdges.push(edgeId);
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

export function getStableEdgeId(sourceFile: FileNode, targetFile: FileNode, type: string): string {
  return `${type}-${sourceFile.name}-${sourceFile.extension}-to-${targetFile.name}-${targetFile.extension}`;
}

export function applyProjectState(graph: LineageGraph, project: Project): LineageGraph {
  const fileNameMap = new Map<string, FileNode>();
  graph.nodes.forEach(node => {
    const key = `${node.name}-${node.extension}`;
    fileNameMap.set(key, node);
  });

  return {
    nodes: graph.nodes.map(node => ({
      ...node,
      deprecated: project.deprecatedFiles.includes(node.id) ||
        Object.values(project.fileMetadata).some(m => m.fileId === node.id && m.deprecated)
    })),
    edges: graph.edges.map(edge => {
      const sourceNode = graph.nodes.find(n => n.id === edge.source);
      const targetNode = graph.nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return edge;

      const stableId = getStableEdgeId(sourceNode, targetNode, edge.type);
      
      return {
        ...edge,
        confirmed: project.confirmedEdges.includes(edge.id) || 
                   project.confirmedEdges.includes(stableId),
        deprecated: project.deprecatedEdges.includes(edge.id) ||
                   project.deprecatedEdges.includes(stableId)
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
