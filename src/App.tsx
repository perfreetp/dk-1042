import React, { useState, useEffect, useCallback } from 'react';
import { FileNode, LineageEdge, LineageGraph, Project } from './types';
import { analyzeLineage } from './utils/lineageAnalyzer';
import { 
  saveProject, getCurrentProject, getAllProjects, 
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
  const [colorByKey, setColorByKey] = useState(0);

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

  const loadProjectData = useCallback(async (proj: Project) => {
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
      const updatedGraph = applyProjectState(analysis, proj);
      setGraph(updatedGraph);
    } catch (error) {
      console.error('Failed to load project data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (project) {
      loadProjectData(project);
    }
  }, [project?.id]);

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
    }
  };

  const handleSelectProject = (proj: Project) => {
    setCurrentProject(proj.id);
    setProject(proj);
    setShowProjectSelector(false);
    setSelectedFile(null);
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

  const handleEdgeUpdate = useCallback((edgeId: string, updates: Partial<LineageEdge>) => {
    setGraph(prev => ({
      ...prev,
      edges: prev.edges.map(e => e.id === edgeId ? { ...e, ...updates } : e)
    }));
    
    if (project) {
      const updatedProject = { ...project };
      
      if (!updatedProject.edgeMetadata) {
        updatedProject.edgeMetadata = {};
      }
      
      if (!updatedProject.edgeMetadata[edgeId]) {
        updatedProject.edgeMetadata[edgeId] = { edgeId };
      }
      
      if (updates.type !== undefined) {
        updatedProject.edgeMetadata[edgeId].type = updates.type;
      }
      
      if (updates.confidence !== undefined) {
        updatedProject.edgeMetadata[edgeId].confidence = updates.confidence;
      }
      
      if (updates.reason !== undefined) {
        updatedProject.edgeMetadata[edgeId].reason = updates.reason;
      }
      
      if (updates.confirmed !== undefined) {
        updatedProject.edgeMetadata[edgeId].confirmed = updates.confirmed;
        
        const confirmedSet = new Set(updatedProject.confirmedEdges);
        if (updates.confirmed) {
          confirmedSet.add(edgeId);
        } else {
          confirmedSet.delete(edgeId);
        }
        updatedProject.confirmedEdges = Array.from(confirmedSet);
      }
      
      if (updates.deprecated !== undefined) {
        updatedProject.edgeMetadata[edgeId].deprecated = updates.deprecated;
        
        const deprecatedSet = new Set(updatedProject.deprecatedEdges);
        if (updates.deprecated) {
          deprecatedSet.add(edgeId);
        } else {
          deprecatedSet.delete(edgeId);
        }
        updatedProject.deprecatedEdges = Array.from(deprecatedSet);
      }
      
      saveProject(updatedProject);
      setProject(updatedProject);
    }
  }, [project]);

  const handleFileDeprecated = useCallback((fileId: string, deprecated: boolean) => {
    if (!project) return;
    
    const updatedProject = { ...project };
    const deprecatedSet = new Set(updatedProject.deprecatedFiles);
    
    if (deprecated) {
      deprecatedSet.add(fileId);
    } else {
      deprecatedSet.delete(fileId);
    }
    updatedProject.deprecatedFiles = Array.from(deprecatedSet);
    
    saveProject(updatedProject);
    setProject(updatedProject);
    
    setGraph(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === fileId ? { ...n, deprecated } : n),
      edges: prev.edges.map(e => 
        e.source === fileId || e.target === fileId
          ? { ...e, deprecated }
          : e
      )
    }));
  }, [project]);

  const handleMetadataUpdate = useCallback((fileId: string, metadata: { owner?: string; version?: string; description?: string }) => {
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
    
    if (metadata.owner !== undefined) {
      setColorByKey(prev => prev + 1);
    }
  }, [project]);

  const filteredFiles = files.filter(f => {
    const matchesType = filterType === 'all' || f.type === filterType;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getSelectedFileCard = useCallback(() => {
    if (!selectedFile || !project) return null;
    
    const currentFile = graph.nodes.find(n => n.id === selectedFile.id) || selectedFile;
    const isFileDeprecated = project.deprecatedFiles.includes(currentFile.id) || currentFile.deprecated;
    const metadata = project.fileMetadata[currentFile.id];
    
    const upstreamEdges = graph.edges.filter(e => e.target === currentFile.id);
    const downstreamEdges = graph.edges.filter(e => e.source === currentFile.id);
    const upstreamFiles = graph.nodes.filter(n => upstreamEdges.some(e => e.source === n.id));
    const downstreamFiles = graph.nodes.filter(n => downstreamEdges.some(e => e.target === n.id));
    
    return {
      node: { ...currentFile, deprecated: isFileDeprecated },
      metadata: metadata ? { ...metadata, deprecated: isFileDeprecated } : { fileId: currentFile.id, deprecated: isFileDeprecated },
      upstreamFiles,
      downstreamFiles,
      upstreamEdges,
      downstreamEdges
    };
  }, [selectedFile, project, graph]);

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
          {filteredFiles.map(file => {
            const isDeprecated = project?.deprecatedFiles.includes(file.id);
            return (
              <div
                key={file.id}
                className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
                onClick={() => handleFileSelect(file)}
                style={{ opacity: isDeprecated ? 0.5 : 1 }}
              >
                <div className="file-item-name">
                  {file.name}
                  {isDeprecated && (
                    <span className="deprecated-badge" style={{ marginLeft: '8px' }}>废弃</span>
                  )}
                </div>
                <div className="file-item-path">{file.path}</div>
                <span className={`file-item-type type-${file.type}`}>{file.type}</span>
              </div>
            );
          })}
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
              onChange={(e) => {
                setColorBy(e.target.value as any);
                setColorByKey(prev => prev + 1);
              }}
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
              key={colorByKey}
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
              key={selectedFile.id}
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
