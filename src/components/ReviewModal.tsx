import React, { useState } from 'react';
import { LineageGraph, LineageEdge, FileNode } from '../types';

interface ReviewModalProps {
  graph: LineageGraph;
  onClose: () => void;
  onEdgeUpdate: (edgeId: string, updates: Partial<LineageEdge>) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ graph, onClose, onEdgeUpdate }) => {
  const [filter, setFilter] = useState<'all' | 'uncertain' | 'confirmed' | 'deprecated'>('all');
  const [selectedEdge, setSelectedEdge] = useState<LineageEdge | null>(null);
  const [reason, setReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const getEdgeDetails = (edge: LineageEdge) => {
    const source = graph.nodes.find(n => n.id === edge.source);
    const target = graph.nodes.find(n => n.id === edge.target);
    return { source, target };
  };

  const filteredEdges = graph.edges.filter(edge => {
    const matchesFilter = 
      filter === 'all' ||
      (filter === 'uncertain' && !edge.confirmed && edge.confidence < 0.9) ||
      (filter === 'confirmed' && edge.confirmed) ||
      (filter === 'deprecated' && edge.deprecated);
    
    const matchesSearch = searchQuery === '' ||
      getEdgeDetails(edge).source?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getEdgeDetails(edge).target?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const handleConfirm = () => {
    if (selectedEdge) {
      onEdgeUpdate(selectedEdge.id, { confirmed: true });
      setSelectedEdge(null);
    }
  };

  const handleMarkDeprecated = () => {
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
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
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: '12px', fontSize: '14px', color: '#a0a0a0' }}>
                关系列表 ({filteredEdges.length})
              </h3>
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {filteredEdges.map(edge => {
                  const { source, target } = getEdgeDetails(edge);
                  return (
                    <div
                      key={edge.id}
                      className="edge-item"
                      style={{
                        cursor: 'pointer',
                        background: selectedEdge?.id === edge.id ? '#3a3a3a' : undefined
                      }}
                      onClick={() => setSelectedEdge(edge)}
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
                        {edge.confirmed && <span className="confirmed-badge">已确认</span>}
                        {edge.deprecated && <span className="deprecated-badge">已废弃</span>}
                        {!edge.confirmed && !edge.deprecated && edge.confidence < 0.9 && (
                          <span className="confidence-badge confidence-medium">待确认</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedEdge && (
              <div style={{ flex: 1, borderLeft: '1px solid #404040', paddingLeft: '20px' }}>
                <h3 style={{ marginBottom: '16px', fontSize: '14px', color: '#a0a0a0' }}>
                  编辑关系
                </h3>
                
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
                    disabled={selectedEdge.confirmed}
                  >
                    确认关系
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleMarkDeprecated}
                    disabled={selectedEdge.deprecated}
                  >
                    标记废弃
                  </button>
                </div>
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
