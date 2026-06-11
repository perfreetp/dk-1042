import React, { useState } from 'react';
import { LineageGraph, LineageEdge, FileNode, Project } from '../types';

interface ReviewModalProps {
  graph: LineageGraph;
  project: Project;
  onClose: () => void;
  onEdgeUpdate: (edgeId: string, updates: Partial<LineageEdge>) => void;
  onFileDeprecated: (fileId: string, deprecated: boolean) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ graph, project, onClose, onEdgeUpdate, onFileDeprecated }) => {
  const [filter, setFilter] = useState<'all' | 'uncertain' | 'confirmed' | 'deprecated'>('all');
  const [fileFilter, setFileFilter] = useState<'all' | 'deprecated'>('all');
  const [selectedEdge, setSelectedEdge] = useState<LineageEdge | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const getEdgeDetails = (edge: LineageEdge) => {
    const source = graph.nodes.find(n => n.id === edge.source);
    const target = graph.nodes.find(n => n.id === edge.target);
    return { source, target };
  };

  const filteredEdges = graph.edges.filter(edge => {
    const isConfirmed = project.confirmedEdges.includes(edge.id);
    const isDeprecated = project.deprecatedEdges.includes(edge.id);
    
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

  const filteredFiles = graph.nodes.filter(node => {
    const isDeprecated = project.deprecatedFiles.includes(node.id);
    const matchesFileFilter = fileFilter === 'all' || (fileFilter === 'deprecated' && isDeprecated);
    const matchesSearch = searchQuery === '' || node.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFileFilter && matchesSearch;
  });

  const handleConfirm = () => {
    if (selectedEdge) {
      onEdgeUpdate(selectedEdge.id, { confirmed: true });
      setSelectedEdge(null);
    }
  };

  const handleMarkDeprecatedEdge = () => {
    if (selectedEdge) {
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
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
              style={{ width: '150px' }}
            >
              <option value="all">全部关系</option>
              <option value="uncertain">不确定</option>
              <option value="confirmed">已确认</option>
              <option value="deprecated">已废弃</option>
            </select>
            <select
              className="form-input"
              value={fileFilter}
              onChange={(e) => setFileFilter(e.target.value as any)}
              style={{ width: '150px' }}
            >
              <option value="all">全部文件</option>
              <option value="deprecated">已废弃文件</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div className="tabs" style={{ marginBottom: '12px' }}>
                <button
                  className={`tab ${!selectedFile ? 'active' : ''}`}
                  onClick={() => setSelectedFile(null)}
                >
                  关系 ({filteredEdges.length})
                </button>
                <button
                  className={`tab ${selectedFile ? 'active' : ''}`}
                  onClick={() => setSelectedFile(null)}
                >
                  文件 ({filteredFiles.length})
                </button>
              </div>

              {!selectedFile ? (
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {filteredEdges.map(edge => {
                    const { source, target } = getEdgeDetails(edge);
                    const isConfirmed = project.confirmedEdges.includes(edge.id);
                    const isDeprecated = project.deprecatedEdges.includes(edge.id);
                    return (
                      <div
                        key={edge.id}
                        className="edge-item"
                        style={{
                          cursor: 'pointer',
                          background: selectedEdge?.id === edge.id ? '#3a3a3a' : undefined,
                          opacity: isDeprecated ? 0.5 : 1
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
                          {isConfirmed && <span className="confirmed-badge">已确认</span>}
                          {isDeprecated && <span className="deprecated-badge">已废弃</span>}
                          {!isConfirmed && !isDeprecated && edge.confidence < 0.9 && (
                            <span className="confidence-badge confidence-medium">待确认</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                  {filteredFiles.map(file => {
                    const isDeprecated = project.deprecatedFiles.includes(file.id);
                    return (
                      <div
                        key={file.id}
                        className="edge-item"
                        style={{
                          cursor: 'pointer',
                          background: selectedFile?.id === file.id ? '#3a3a3a' : undefined,
                          opacity: isDeprecated ? 0.5 : 1
                        }}
                        onClick={() => {
                          setSelectedFile(file);
                          setSelectedEdge(null);
                        }}
                      >
                        <div className="edge-item-name">{file.name}</div>
                        <span className={`file-item-type type-${file.type}`}>{file.type}</span>
                        {isDeprecated && <span className="deprecated-badge" style={{ marginLeft: '8px' }}>已废弃</span>}
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
                        onChange={(e) => onEdgeUpdate(selectedEdge.id, { type: e.target.value as any })}
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
                          onChange={(e) => onEdgeUpdate(selectedEdge.id, { confidence: Number(e.target.value) / 100 })}
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
                        onClick={handleConfirm}
                        disabled={project.confirmedEdges.includes(selectedEdge.id)}
                      >
                        确认关系
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={handleMarkDeprecatedEdge}
                        disabled={project.deprecatedEdges.includes(selectedEdge.id)}
                      >
                        标记废弃
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
                        className={`btn ${project.deprecatedFiles.includes(selectedFile.id) ? 'btn-secondary' : 'btn-danger'}`}
                        onClick={() => onFileDeprecated(selectedFile.id, !project.deprecatedFiles.includes(selectedFile.id))}
                        style={{ width: '100%' }}
                      >
                        {project.deprecatedFiles.includes(selectedFile.id) ? '取消废弃标记' : '标记为废弃'}
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
