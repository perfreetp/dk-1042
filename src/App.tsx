import React, { useState, useEffect, useRef } from 'react';
import { FileNode, LineageEdge, LineageGraph, Project } from './types';
import { analyzeLineage, groupByExtension } from './utils/lineageAnalyzer';
import LineageCanvas from './components/LineageCanvas';
import FileCard from './components/FileCard';
import ReviewModal from './components/ReviewModal';
import ChangePreviewModal from './components/ChangePreviewModal';

declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string>;
      scanFolder: (folderPath: string) => Promise<FileNode[]>;
      readFile: (filePath: string) => Promise<string | null>;
    };
  }
}

const App: React.FC = () => {
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
  const canvasRef = useRef<any>(null);

  useEffect(() => {
    if (project) {
      const grouped = groupByExtension(files);
      const analysis = analyzeLineage(files);
      setGraph(analysis);
    }
  }, [files, project]);

  const handleNewProject = () => {
    const name = prompt('请输入项目名称:');
    if (name) {
      setProject({
        id: Date.now().toString(),
        name,
        folderPath: '',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        graph: { nodes: [], edges: [] }
      });
    }
  };

  const handleImportFolder = async () => {
    if (!window.electronAPI) {
      alert('请在 Electron 环境中运行');
      return;
    }
    
    const folderPath = await window.electronAPI.selectFolder();
    if (folderPath) {
      const scannedFiles = await window.electronAPI.scanFolder(folderPath);
      setFiles(scannedFiles);
      if (project) {
        setProject({ ...project, folderPath, lastModified: new Date().toISOString() });
      }
    }
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    setShowProperties(true);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(200, zoom + 20);
    setZoom(newZoom);
    canvasRef.current?.zoom(newZoom / 100);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(20, zoom - 20);
    setZoom(newZoom);
    canvasRef.current?.zoom(newZoom / 100);
  };

  const handleFit = () => {
    setZoom(100);
    canvasRef.current?.fit();
  };

  const handleEdgeUpdate = (edgeId: string, updates: Partial<LineageEdge>) => {
    setGraph(prev => ({
      ...prev,
      edges: prev.edges.map(e => e.id === edgeId ? { ...e, ...updates } : e)
    }));
  };

  const filteredFiles = files.filter(f => {
    const matchesType = filterType === 'all' || f.type === filterType;
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
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
          <div className="sidebar-title">{project?.name || '文件血缘图工具'}</div>
          <div className="sidebar-actions">
            <button className="btn btn-primary" onClick={handleNewProject}>新建项目</button>
            <button className="btn btn-secondary" onClick={handleImportFolder}>导入文件夹</button>
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
              className={`file-item ${selectedFile?.id === file.id ? 'selected' : ''}`}
              onClick={() => handleFileSelect(file)}
            >
              <div className="file-item-name">{file.name}</div>
              <div className="file-item-path">{file.path}</div>
              <span className={`file-item-type type-${file.type}`}>{file.type}</span>
            </div>
          ))}
          {filteredFiles.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-text">暂无文件</div>
              <div className="empty-state-hint">点击"导入文件夹"开始分析</div>
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
              ref={canvasRef}
              graph={graph}
              selectedFile={selectedFile}
              colorBy={colorBy}
              onFileSelect={handleFileSelect}
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
              onEdgeUpdate={handleEdgeUpdate}
            />
          )}
        </div>
      </div>

      {showReviewModal && (
        <ReviewModal
          graph={graph}
          onClose={() => setShowReviewModal(false)}
          onEdgeUpdate={handleEdgeUpdate}
        />
      )}

      {showPreviewModal && (
        <ChangePreviewModal
          graph={graph}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
};

export default App;
