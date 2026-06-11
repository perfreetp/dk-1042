import React, { useState } from 'react';
import { FileCard as FileCardType, LineageEdge } from '../types';

interface FileCardProps {
  fileCard: FileCardType;
  onClose: () => void;
  onEdgeUpdate: (edgeId: string, updates: Partial<LineageEdge>) => void;
}

const FileCard: React.FC<FileCardProps> = ({ fileCard, onClose, onEdgeUpdate }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'upstream' | 'downstream'>('info');
  const [version, setVersion] = useState<string>('v1.0');
  const [description, setDescription] = useState<string>('');
  const [owner, setOwner] = useState<string>('');

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="panel-header">
        <h3 className="panel-title">{fileCard.node.name}</h3>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          详情
        </button>
        <button
          className={`tab ${activeTab === 'upstream' ? 'active' : ''}`}
          onClick={() => setActiveTab('upstream')}
        >
          上游 ({fileCard.upstreamFiles.length})
        </button>
        <button
          className={`tab ${activeTab === 'downstream' ? 'active' : ''}`}
          onClick={() => setActiveTab('downstream')}
        >
          下游 ({fileCard.downstreamFiles.length})
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'info' && (
          <>
            <div className="info-section">
              <div className="info-label">文件路径</div>
              <div className="info-value">{fileCard.node.path}</div>
            </div>

            <div className="info-section">
              <div className="info-label">文件类型</div>
              <div className="info-value">
                <span className={`file-item-type type-${fileCard.node.type}`}>
                  {fileCard.node.type}
                </span>
                <span style={{ marginLeft: '8px' }}>{fileCard.node.extension}</span>
              </div>
            </div>

            <div className="info-section">
              <div className="info-label">文件大小</div>
              <div className="info-value">{formatSize(fileCard.node.size)}</div>
            </div>

            <div className="info-section">
              <div className="info-label">修改时间</div>
              <div className="info-value">{formatDate(fileCard.node.modifiedTime)}</div>
            </div>

            <div className="info-section">
              <div className="info-label">版本号</div>
              <input
                type="text"
                className="form-input"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="输入版本号"
              />
            </div>

            <div className="info-section">
              <div className="info-label">负责人</div>
              <input
                type="text"
                className="form-input"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="输入负责人"
              />
            </div>

            <div className="info-section">
              <div className="info-label">来源说明</div>
              <textarea
                className="form-input form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="描述文件的来源和用途..."
              />
            </div>

            <div className="info-section">
              <div className="info-label">影响分析</div>
              <div className="info-value">
                <div>上游依赖: {fileCard.upstreamFiles.length} 个文件</div>
                <div>下游影响: {fileCard.downstreamFiles.length} 个文件</div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'upstream' && (
          <div className="edge-list">
            {fileCard.upstreamEdges.length === 0 ? (
              <div className="empty-state" style={{ height: 'auto', padding: '40px 0' }}>
                <div className="empty-state-text">无上游依赖</div>
              </div>
            ) : (
              fileCard.upstreamEdges.map(edge => {
                const sourceFile = fileCard.upstreamFiles.find(f => f.id === edge.source);
                return (
                  <div key={edge.id} className="edge-item">
                    <div className="edge-item-name">
                      {sourceFile?.name || '未知文件'}
                      {edge.confirmed && <span className="confirmed-badge">已确认</span>}
                      {edge.deprecated && <span className="deprecated-badge">已废弃</span>}
                    </div>
                    <span className={`edge-item-type`}>{edge.type}</span>
                    <span className={`confidence-badge ${
                      edge.confidence >= 0.8 ? 'confidence-high' :
                      edge.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low'
                    }`}>
                      {Math.round(edge.confidence * 100)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'downstream' && (
          <div className="edge-list">
            {fileCard.downstreamEdges.length === 0 ? (
              <div className="empty-state" style={{ height: 'auto', padding: '40px 0' }}>
                <div className="empty-state-text">无下游影响</div>
              </div>
            ) : (
              fileCard.downstreamEdges.map(edge => {
                const targetFile = fileCard.downstreamFiles.find(f => f.id === edge.target);
                return (
                  <div key={edge.id} className="edge-item">
                    <div className="edge-item-name">
                      {targetFile?.name || '未知文件'}
                      {edge.confirmed && <span className="confirmed-badge">已确认</span>}
                      {edge.deprecated && <span className="deprecated-badge">已废弃</span>}
                    </div>
                    <span className={`edge-item-type`}>{edge.type}</span>
                    <span className={`confidence-badge ${
                      edge.confidence >= 0.8 ? 'confidence-high' :
                      edge.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low'
                    }`}>
                      {Math.round(edge.confidence * 100)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default FileCard;
