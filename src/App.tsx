import React, { useState, useEffect } from 'react';
import { FileNode, LineageEdge, LineageGraph, Project } from './types';
import { analyzeLineage, groupByExtension } from './utils/lineageAnalyzer';
import { 
  loadData, saveProject, getCurrentProject, getAllProjects, 
  createProject, setCurrentProject, applyProjectState 
} from './utils/storage';
import LineageCanvas from './components/LineageCanvas';
import FileCard from './components/FileCard';
import ReviewModal from './components/ReviewModal';
import ChangePreviewModal from './components/ChangePreviewModal';
import ProjectSelector from './components/ProjectSelector';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string>;
      scanFolder: (folderPath: string) => Promise<FileNode[]>;
      scanFolderWithContent: (folderPath: string) => Promise<{files: FileNode[], contents: Record<string, string>}>;
      readFile: (filePath: string) => Promise<string | null>;
    };
  }
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [graph, setGraph] = useState<LineageGraph>({ nodes: [], edges: [] });
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [showProperties, setShowProperties] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [colorBy, setColorBy] = useState<'type' | 'owner' | 'date'>('type');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadedProjects = getAllProjects();
    setProjects(loadedProjects);
    const currentProject = getCurrentProject();
    if (currentProject) {
      setProject(currentProject);
      if (currentProject.folderPath) {
        loadProjectData(currentProject);
      }
    } else if (loadedProjects.length > 0) {
      setShowProjectSelector(true);
    }
  }, []);

  useEffect(() => {
    if (project && files.length > 0) {
      const updatedGraph = applyProjectState(graph, project);
      setGraph(updatedGraph);
    }
  }, [project]);

  const loadProjectData = async (proj: Project) => {
    if (!window.electronAPI) {
      alert('请在 Electron 环境中运行');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await window.electronAPI.scanFolderWithContent(proj.folderPath);
      setFiles(result.files);
      
      const fileContents = new Map(Object.entries(result.contents));
      const analysis = analyzeLineage(result.files, fileContents);
      setGraph(applyProjectState(analysis, proj));
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProject = async () => {
    const name = prompt('请输入项目名称:');
    if (name) {
      if (!window.electronAPI) {
        alert('请在 Electron 环境中运行');
        return;
      }
      
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        const newProject = createProject(name, folderPath);
        saveProject(newProject);
        setProject(newProject);
        setProjects(getAllProjects());
        
        setIsLoading(true);
        try {
          const result = await window.electronAPI.scanFolderWithContent(folderPath);
          setFiles(result.files);
          
          const fileContents = new Map(Object.entries(result.contents));
          const analysis = analyzeLineage(result.files, fileContents);
          setGraph(applyProjectState(analysis, newProject));
        } catch (error) {
          console.error('Failed to analyze files:', error);
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  const handleImportFolder = async () => {
    if (!project) {
      alert('请先创建或选择项目');
      return;
    }
    
    if (!window.electronAPI) {
      alert('请在 Electron 环境中运行');
      return;
    }
    
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      const updatedProject = { ...project, folderPath };
      saveProject(updatedProject);
      setProject(updatedProject);
      
      setIsLoading(true);
      try {
        const result = await window.electronAPI.scanFolderWithContent(folderPath);
        setFiles(result.files);
        
        const fileContents = new Map(Object.entries(result.contents));
        const analysis = analyzeLineage(result.files, fileContents);
        setGraph(applyProjectState(analysis, updatedProject));
      } catch (error) {
        console.error('Failed to analyze files:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSelectProject = (proj: Project) => {
    setCurrentProject(proj.id);
    setProject(proj);
    setShowProjectSelector(false);
    
    if (proj.folderPath) {
      loadProjectData(proj);
    }
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setShowProperties(true);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(200, zoom + 20);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(20, zoom - 20);
    setZoom(newZoom);
  };

  const handleFit = () => {
    setZoom(100);
  };

  const handleSelectionChange = (nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
  };

  const handleToggleCollapse = (nodeId: string) => {
    const newCollapsed = new Set(collapsedNodes);
    if (newCollapsed.has(nodeId)) {
      newCollapsed.delete(nodeId);
    } else {
      newCollapsed.add(nodeId);
    }
    setCollapsedNodes(newCollapsed);
  };

  const handleEdgeUpdate = (edgeId: string, updates: Partial<LineageEdge>) => {
    setGraph(prev => ({
      ...prev,
      edges: prev.edges.map(e => e.id === edgeId ? { ...e, ...updates } : e)
    }));
    
    if (project) {
      const updatedProject = { ...project };
      if (updates.confirmed !== undefined) {
        if (updates.confirmed) {
          if (!updatedProject.confirmedEdges.includes(edgeId)) {
            updatedProject.confirmedEdges.push(edgeId);
          }
        } else {
          updatedProject.confirmedEdges = updatedProject.confirmedEdges.filter(id => id !== edgeId);
        }
      }
      if (updates.deprecated !== undefined) {
        if (updates.deprecated) {
          if (!updatedProject.deprecatedEdges.includes(edgeId)) {
            updatedProject.deprecatedEdges.push(edgeId);
          }
        } else {
          updatedProject.deprecatedEdges = updatedProject.deprecatedEdges.filter(id => id !== edgeId);
        }
      }
      saveProject(updatedProject);
      setProject(updatedProject);
    }
  };

  const handleFileDeprecated = (fileId: string, deprecated: boolean) => {
    if (!project) return;
    
    const updatedProject = { ...project };
    if (deprecated) {
      if (!updatedProject.deprecatedFiles.includes(fileId)) {
        updatedProject.deprecatedFiles.push(fileId);
      }
    } else {
      updatedProject.deprecatedFiles = updatedProject.deprecatedFiles.filter(id => id !== fileId);
    }
    saveProject(updatedProject);
    setProject(updatedProject);
    
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === fileId ? { ...n, deprecated } : n)
    }));
  };

  const handleMetadataUpdate = (fileId: string, metadata: { owner?: string; version?: string; description?: string }) => {
    if (!project) return;
    
    const updatedProject = { ...project };
    if (!updatedProject.fileMetadata[fileId]) {
      updatedProject.fileMetadata[fileId] = { fileId };
    }
    updatedProject.fileMetadata[fileId] = { 
      ...updatedProject.fileMetadata[fileId], 
      ...metadata 
    };
    saveProject(updatedProject);
    setProject(updatedProject);
  };

  const filteredFiles = files.filter(f => {
    const matchesType = filterType === 'all' || f.type === filterType;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const isDeprecated = project?.deprecatedFiles.includes(f.id);
    return matchesType && matchesSearch;
  });

  const getSelectedFileCard = () => {
    if (!selectedFile) return null;
    const upstreamEdges = graph.edges.filter(e => e.target === selectedFile.id);
    const downstreamEdges = graph.edges.filter(e => e.source === selectedFile.id);
    const upstreamFiles = graph.nodes.filter(n => upstreamEdges.some(e => e.source === n.id));
    const downstreamFiles = graph.nodes.filter(n => downstreamEdges.some(e => e.target === n.id));
    
    return {
      node: selectedFile,
      metadata: project?.fileMetadata[selectedFile.id],
      upstreamFiles,
      downstreamFiles,
      upstreamEdges,
      downstreamEdges
    };
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">
            {project?.name || '文件血缘图工具'}
            {project && (
              <button 
                className="btn btn-secondary" 
                style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setShowProjectSelector(true)}
              >
                切换
              </button>
            )}
          </div>
          <div className="sidebar-actions">
            <button className="btn btn-primary" onClick={handleNewProject}>新建项目</button>
            {project && (
              <button className="btn btn-secondary" onClick={handleImportFolder}>导入文件夹</button>
            )}
          </div>
        </div>

        <div className="toolbar" style={{ height: 'auto', padding: '12px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: '8px' }}
          />
          <select
            className="form-input"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">所有类型</option>
            <option value="table">表格</option>
            <option value="script">脚本</option>
            <option value="report">报告</option>
            <option value="config">配置</option>
            <option value="data">数据</option>
            <option value="other">其他</option>
          </select>
        </div>

        <div className="file-list">
          {filteredFiles.map(file => (
            <div
              key={file.id}
              className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''} ${project?.deprecatedFiles.includes(file.id) ? 'deprecated' : ''}`}
              onClick={() => handleFileSelect(file)}
              style={{ opacity: project?.deprecatedFiles.includes(file.id) ? 0.5 : 1 }}
            >
              <div className="file-item-name">
                {file.name}
                {project?.deprecatedFiles.includes(file.id) && (
                  <span className="deprecated-badge" style={{ marginLeft: '8px' }}>废弃</span>
                )}
              </div>
              <div className="file-item-path">{file.path}</div>
              <span className={`file-item-type type-${file.type}`}>{file.type}</span>
            </div>
          ))}
          {filteredFiles.length === 0 && !isLoading && (
            <div className="empty-state">
              <div className="empty-state-text">暂无文件</div>
              <div className="empty-state-hint">点击"导入文件夹"开始分析</div>
            </div>
          )}
          {isLoading && (
            <div className="empty-state">
              <div className="empty-state-text">加载中...</div>
            </div>
          )}
        </div>
      </div>

      <div className="main-content">
        <div className="toolbar">
          <div className="toolbar-group">
            <button className="btn btn-secondary" onClick={handleZoomOut}>-</button>
            <span className="zoom-label">{zoom}%</span>
            <button className="btn btn-secondary" onClick={handleZoomIn}>+</button>
            <button className="btn btn-secondary" onClick={handleFit}>适应</button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <span style={{ fontSize: '14px' }}>着色:</span>
            <select
              className="form-input"
              style={{ width: '100px', padding: '6px' }}
              value={colorBy}
              onChange={(e) => setColorBy(e.target.value as any)}
            >
              <option value="type">按类型</option>
              <option value="owner">按负责人</option>
              <option value="date">按日期</option>
            </select>
          </div>

          <div className="toolbar-divider" />

          {selectedNodeIds.length > 0 && (
            <div className="toolbar-group">
              <span style={{ fontSize: '14px', color: '#4a9eff' }}>
                已选中 {selectedNodeIds.length} 个节点
              </span>
            </div>
          )}

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button className="btn btn-secondary" onClick={() => setShowReviewModal(true)}>
              校对窗口
            </button>
            <button className="btn btn-secondary" onClick={() => setShowPreviewModal(true)}>
              变更预览
            </button>
            <button className="btn btn-primary" onClick={() => {
              const json = JSON.stringify(graph, null, 2);
              const blob = new Blob([json], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `lineage-export-${Date.now()}.json`;
              a.click();
            }}>
              导出
            </button>
          </div>
        </div>

        <div className="canvas-container">
          {graph.nodes.length > 0 ? (
            <LineageCanvas
              graph={graph}
              selectedFile={selectedFile}
              colorBy={colorBy}
              project={project}
              collapsedNodes={collapsedNodes}
              onFileSelect={handleFileSelect}
              onSelectionChange={handleSelectionChange}
              onToggleCollapse={handleToggleCollapse}
              zoom={zoom}
            />
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-text">血缘关系图</div>
              <div className="empty-state-hint">
                {project ? '导入文件夹以查看血缘关系' : '新建项目并导入文件夹开始分析'}
              </div>
            </div>
          )}
        </div>

        <div className={`properties-panel ${showProperties ? 'open' : ''}`}>
          {selectedFile && (
            <FileCard
              fileCard={getSelectedFileCard()!}
              onClose={() => setShowProperties(false)}
              onMetadataUpdate={handleMetadataUpdate}
              onEdgeUpdate={handleEdgeUpdate}
              onFileDeprecated={handleFileDeprecated}
            />
          )}
        </div>
      </div>

      {showReviewModal && project && (
        <ReviewModal
          graph={graph}
          project={project}
          onClose={() => setShowReviewModal(false)}
          onEdgeUpdate={handleEdgeUpdate}
          onFileDeprecated={handleFileDeprecated}
        />
      )}

      {showPreviewModal && (
        <ChangePreviewModal
          graph={graph}
          project={project}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {showProjectSelector && (
        <ProjectSelector
          projects={projects}
          currentProjectId={project?.id || null}
          onSelect={handleSelectProject}
          onClose={() => setShowProjectSelector(false)}
          onNewProject={handleNewProject}
        />
      )}
    </div>
  );
};

export default App;
