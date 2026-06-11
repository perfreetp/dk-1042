import React, { useState, useEffect } from 'react';
import { LineageGraph, LineageEdge, FileNode, Project } from '../types';

interface ReviewModalProps {
  graph: LineageGraph;
  project: Project;
  onClose: () => void;
  onEdgeUpdate: (edgeId: string, updates: Partial<LineageEdge>) => void;
  onFileDeprecated: (fileId: string, deprecated: boolean) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ graph, project, onClose, onEdgeUpdate, onFileDeprecated }) => {
  const [viewMode, setViewMode] = useState<'edges' | 'files'>('edges');
  const [selectedEdge, setSelectedEdge] = useState<LineageEdge | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [localProject, setLocalProject] = useState(project);

  useEffect(() => {
    setLocalProject(project);
  }, [project]);

  const getEdgeDetails = (edge: LineageEdge) => {
    const source = graph.nodes.find(n => n.id === edge.source);
    const target = graph.nodes.find(n => n.id === edge.target);
    return { source, target };
  };

  const filteredEdges = graph.edges.filter(edge => {
    const isConfirmed = localProject.confirmedEdges.includes(edge.id);
    const isDeprecated = localProject.deprecatedEdges.includes(edge.id);
    
    const matchesFilter = 
      filter === 'all' ||
      (filter === 'uncertain' && !isConfirmed && edge.confidence < 0.9) ||
      (filter === 'confirmed' && isConfirmed) ||
      (filter === 'deprecated' && isDeprecated);
    
    const matchesSearch = searchQuery === '' ||
      getEdgeDetails(edge).source?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getEdgeDetails(edge).target?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const [filter, setFilter] = useState<'all' | 'uncertain' | 'confirmed' | 'deprecated'>('all');

  const filteredFiles = graph.nodes.filter(node => {
    const isDeprecated = localProject.deprecatedFiles.includes(node.id);
    const matchesSearch = searchQuery === '' || node.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleEdgeConfirm = () => {
    if (selectedEdge) {
      const newConfirmed = localProject.confirmedEdges.includes(selectedEdge.id)
        ? localProject.confirmedEdges
        : [...localProject.confirmedEdges, selectedEdge.id];
      setLocalProject({ ...localProject, confirmedEdges: newConfirmed });
      onEdgeUpdate(selectedEdge.id, { confirmed: true });
      setSelectedEdge(null);
    }
  };

  const handleEdgeMarkDeprecated = () => {
    if (selectedEdge) {
      const newDeprecated = localProject.deprecatedEdges.includes(selectedEdge.id)
        ? localProject.deprecatedEdges
        : [...localProject.deprecatedEdges, selectedEdge.id];
      setLocalProject({ ...localProject, deprecatedEdges: newDeprecated });
      onEdgeUpdate(selectedEdge.id, { deprecated: true, reason });
      setSelectedEdge(null);
      setReason('');
    }
  };

  const handleSetReason = () => {
    if (selectedEdge && reason) {
      onEdgeUpdate(selectedEdge.id, { reason });
      setReason('');
    }
  };

  const handleFileToggleDeprecated = (fileId: string, current: boolean) => {
    const newDeprecated = current
      ? localProject.deprecatedFiles.filter(id => id !== fileId)
      : [...localProject.deprecatedFiles, fileId];
    setLocalProject({ ...localProject, deprecatedFiles: newDeprecated });
    onFileDeprecated(fileId, !current);
  };

  const handleEdgeTypeChange = (edgeId: string, newType: LineageEdge['type']) => {
    onEdgeUpdate(edgeId, { type: newType });
    if (selectedEdge?.id === edgeId) {
      setSelectedEdge({ ...selectedEdge, type: newType });
    }
  };

  const handleEdgeConfidenceChange = (edgeId: string, confidence: number) => {
    onEdgeUpdate(edgeId, { confidence });
    if (selectedEdge?.id === edgeId) {
      setSelectedEdge({ ...selectedEdge, confidence });
    }
  };

  const isEdgeConfirmed = (edgeId: string) => localProject.confirmedEdges.includes(edgeId);
  const isEdgeDeprecated = (edgeId: string) => localProject.deprecatedEdges.includes(edgeId);
  const isFileDeprecated = (fileId: string) => localProject.deprecatedFiles.includes(fileId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1000px' }}>
        <div className="modal-header">
          <h2 className="modal-title">校对窗口</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="搜索文件名..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="form-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{ width: '120px' }}
            >
              <option value="all">全部</option>
              <option value="uncertain">不确定</option>
              <option value="confirmed">已确认</option>
              <option value="deprecated">已废弃</option>
            </select>
          </div>

          <div className="tabs" style={{ marginBottom: '12px' }}>
            <button
              className={`tab ${viewMode === 'edges' ? 'active' : ''}`}
              onClick={() => setViewMode('edges')}
            >
              关系列表 ({filteredEdges.length})
            </button>
            <button
              className={`tab ${viewMode === 'files' ? 'active' : ''}`}
              onClick={() => setViewMode('files')}
            >
              文件列表 ({filteredFiles.length})
            </button>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              {viewMode === 'edges' ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {filteredEdges.map(edge => {
                    const { source, target } = getEdgeDetails(edge);
                    const confirmed = isEdgeConfirmed(edge.id);
                    const deprecated = isEdgeDeprecated(edge.id);
                    return (
                      <div
                        key={edge.id}
                        className="edge-item"
                        style={{
                          cursor: 'pointer',
                          background: selectedEdge?.id === edge.id ? '#3a3a3a' : undefined,
                          opacity: deprecated ? 0.5 : 1
                        }}
                        onClick={() => {
                          setSelectedEdge(edge);
                          setSelectedFile(null);
                          setReason(edge.reason || '');
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="edge-item-name">
                            {source?.name || '未知'} → {target?.name || '未知'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#a0a0a0', marginTop: '4px' }}>
                            类型: {edge.type} | 置信度: {Math.round(edge.confidence * 100)}%
                          </div>
                        </div>
                        <div>
                          {confirmed && <span className="confirmed-badge">已确认</span>}
                          {deprecated && <span className="deprecated-badge">已废弃</span>}
                          {!confirmed && !deprecated && edge.confidence < 0.9 && (
                            <span className="confidence-badge confidence-medium">待确认</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {filteredFiles.map(file => {
                    const deprecated = isFileDeprecated(file.id);
                    return (
                      <div
                        key={file.id}
                        className="edge-item"
                        style={{
                          cursor: 'pointer',
                          background: selectedFile?.id === file.id ? '#3a3a3a' : undefined,
                          opacity: deprecated ? 0.5 : 1
                        }}
                        onClick={() => {
                          setSelectedFile(file);
                          setSelectedEdge(null);
                        }}
                        onDoubleClick={() => handleFileToggleDeprecated(file.id, deprecated)}
                      >
                        <div className="edge-item-name">{file.name}</div>
                        <span className={`file-item-type type-${file.type}`}>{file.type}</span>
                        {deprecated && (
                          <span className="deprecated-badge" style={{ marginLeft: '8px' }}>已废弃</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(selectedEdge || selectedFile) && (
              <div style={{ flex: 1, borderLeft: '1px solid #404040', paddingLeft: '20px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '14px', color: '#a0a0a0' }}>
                  {selectedEdge ? '编辑关系' : '编辑文件'}
                </h3>

                {selectedEdge && (
                  <>
                    <div className="info-section">
                      <div className="info-label">源文件</div>
                      <div className="info-value">{getEdgeDetails(selectedEdge).source?.name}</div>
                    </div>

                    <div className="info-section">
                      <div className="info-label">目标文件</div>
                      <div className="info-value">{getEdgeDetails(selectedEdge).target?.name}</div>
                    </div>

                    <div className="info-section">
                      <div className="info-label">关系类型</div>
                      <select
                        className="form-input"
                        value={selectedEdge.type}
                        onChange={(e) => handleEdgeTypeChange(selectedEdge.id, e.target.value as LineageEdge['type'])}
                      >
                        <option value="reference">引用</option>
                        <option value="input">输入</option>
                        <option value="output">输出</option>
                        <option value="version">版本</option>
                      </select>
                    </div>

                    <div className="info-section">
                      <div className="info-label">置信度</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={selectedEdge.confidence * 100}
                          onChange={(e) => handleEdgeConfidenceChange(selectedEdge.id, Number(e.target.value) / 100)}
                          style={{ flex: 1 }}
                        />
                        <span>{Math.round(selectedEdge.confidence * 100)}%</span>
                      </div>
                    </div>

                    <div className="info-section">
                      <div className="info-label">依赖原因</div>
                      <textarea
                        className="form-input form-textarea"
                        value={reason || selectedEdge.reason || ''}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="说明此依赖关系的原因..."
                      />
                      {reason && (
                        <button className="btn btn-secondary" onClick={handleSetReason} style={{ marginTop: '8px' }}>
                          保存原因
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleEdgeConfirm}
                        disabled={isEdgeConfirmed(selectedEdge.id)}
                      >
                        {isEdgeConfirmed(selectedEdge.id) ? '已确认' : '确认关系'}
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={handleEdgeMarkDeprecated}
                        disabled={isEdgeDeprecated(selectedEdge.id)}
                      >
                        {isEdgeDeprecated(selectedEdge.id) ? '已废弃' : '标记废弃'}
                      </button>
                    </div>
                  </>
                )}

                {selectedFile && (
                  <>
                    <div className="info-section">
                      <div className="info-label">文件名</div>
                      <div className="info-value">{selectedFile.name}</div>
                    </div>

                    <div className="info-section">
                      <div className="info-label">文件类型</div>
                      <div className="info-value">{selectedFile.type}</div>
                    </div>

                    <div className="info-section">
                      <div className="info-label">文件状态</div>
                      <button
                        className={`btn ${isFileDeprecated(selectedFile.id) ? 'btn-secondary' : 'btn-danger'}`}
                        onClick={() => handleFileToggleDeprecated(selectedFile.id, isFileDeprecated(selectedFile.id))}
                        style={{ width: '100%' }}
                      >
                        {isFileDeprecated(selectedFile.id) ? '取消废弃标记' : '标记为废弃'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
