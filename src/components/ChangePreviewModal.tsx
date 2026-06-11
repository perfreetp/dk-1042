import React, { useState } from 'react';
import { LineageGraph, FileNode, ChangePreview, Project } from '../types';

interface ChangePreviewModalProps {
  graph: LineageGraph;
  project: Project | null;
  onClose: () => void;
}

const ChangePreviewModal: React.FC<ChangePreviewModalProps> = ({ graph, onClose, project }) => {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [action, setAction] = useState<'delete' | 'replace'>('delete');

  const calculateImpact = (fileId: string): ChangePreview => {
    const file = graph.nodes.find(n => n.id === fileId);
    if (!file) {
      return {
        fileId: '',
        fileName: '',
        action,
        affectedReports: [],
        impactLevel: 'low'
      };
    }

    const downstreamFiles: FileNode[] = [];
    const visited = new Set<string>();
    
    const collectDownstream = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const edges = graph.edges.filter(e => e.source === id);
      for (const edge of edges) {
        if (project?.deprecatedEdges.includes(edge.id)) continue;
        const targetFile = graph.nodes.find(n => n.id === edge.target);
        if (targetFile && !project?.deprecatedFiles.includes(targetFile.id)) {
          downstreamFiles.push(targetFile);
          collectDownstream(edge.target);
        }
      }
    };
    
    collectDownstream(fileId);

    const affectedReports = downstreamFiles.filter(f => f.type === 'report');
    const totalDownstream = downstreamFiles.length;
    
    let impactLevel: 'high' | 'medium' | 'low' = 'low';
    if (affectedReports.length > 5 || totalDownstream > 15) {
      impactLevel = 'high';
    } else if (affectedReports.length > 2 || totalDownstream > 5) {
      impactLevel = 'medium';
    }

    return {
      fileId,
      fileName: file.name,
      action,
      affectedReports,
      impactLevel
    };
  };

  const preview = selectedFile ? calculateImpact(selectedFile.id) : null;

  const exportCleanupList = () => {
    if (!selectedFile || !preview) return;

    const report = `=== 变更影响分析报告 ===
文件: ${preview.fileName}
操作: ${preview.action === 'delete' ? '删除' : '替换'}
生成时间: ${new Date().toLocaleString('zh-CN')}

文件状态: ${project?.deprecatedFiles.includes(selectedFile.id) ? '已废弃' : '正常使用'}

影响范围:
- 总受影响文件: ${graph.edges.filter(e => e.source === selectedFile.id || e.target === selectedFile.id).length}
- 下游影响文件: ${preview.affectedReports.length}
- 影响等级: ${preview.impactLevel === 'high' ? '高' : preview.impactLevel === 'medium' ? '中' : '低'}

受影响的下游报告:
${preview.affectedReports.map(r => `- ${r.name} (${r.path})`).join('\n') || '无'}

清理建议:
${preview.impactLevel === 'high' ? '⚠️ 警告: 此操作将影响多个重要报告，建议先创建备份' : ''}
${preview.impactLevel === 'medium' ? '⚡ 注意: 此操作将影响部分报告，请确认所有相关人员' : ''}
${preview.impactLevel === 'low' ? '✓ 此操作影响较小，但仍建议通知相关人员' : ''}
`;

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleanup-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!selectedFile || !preview) return;

    const data = {
      analysisDate: new Date().toISOString(),
      targetFile: selectedFile,
      action,
      impact: preview,
      deprecated: project?.deprecatedFiles.includes(selectedFile.id),
      graph: {
        nodes: graph.nodes.filter(n => 
          n.id === selectedFile.id ||
          preview.affectedReports.some(r => r.id === n.id)
        ),
        edges: graph.edges.filter(e =>
          e.source === selectedFile.id ||
          e.target === selectedFile.id ||
          preview.affectedReports.some(r => r.id === e.source || r.id === e.target)
        )
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `change-impact-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">变更预览</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ flex: 1 }}>
              <div className="form-group">
                <label className="form-label">选择文件</label>
                <select
                  className="form-input"
                  value={selectedFile?.id || ''}
                  onChange={(e) => {
                    const file = graph.nodes.find(n => n.id === e.target.value);
                    setSelectedFile(file || null);
                  }}
                >
                  <option value="">-- 选择文件 --</option>
                  {graph.nodes.map(file => (
                    <option key={file.id} value={file.id}>
                      {file.name} {project?.deprecatedFiles.includes(file.id) ? '(已废弃)' : ''} ({file.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">变更操作</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      checked={action === 'delete'}
                      onChange={() => setAction('delete')}
                    />
                    删除
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="radio"
                      checked={action === 'replace'}
                      onChange={() => setAction('replace')}
                    />
                    替换
                  </label>
                </div>
              </div>
            </div>

            {preview && (
              <div style={{ flex: 1.5 }}>
                <div className="preview-item">
                  <div className="preview-item-header">
                    <div>
                      <h4 style={{ margin: 0 }}>{preview.fileName}</h4>
                      <span style={{ fontSize: '12px', color: '#a0a0a0' }}>
                        {action === 'delete' ? '删除' : '替换'}操作
                        {project?.deprecatedFiles.includes(selectedFile!.id) && (
                          <span className="deprecated-badge" style={{ marginLeft: '8px' }}>已废弃</span>
                        )}
                      </span>
                    </div>
                    <span className={`preview-impact impact-${preview.impactLevel}`}>
                      {preview.impactLevel === 'high' ? '高影响' :
                       preview.impactLevel === 'medium' ? '中影响' : '低影响'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>
                      受影响的报告 ({preview.affectedReports.length}):
                    </div>
                    <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                      {preview.affectedReports.length === 0 ? (
                        <div style={{ color: '#a0a0a0', fontSize: '13px' }}>
                          无下游报告受影响
                        </div>
                      ) : (
                        preview.affectedReports.map(report => (
                          <div
                            key={report.id}
                            style={{
                              padding: '8px',
                              background: '#2d2d2d',
                              borderRadius: '4px',
                              marginBottom: '6px',
                              fontSize: '13px'
                            }}
                          >
                            <div>{report.name}</div>
                            <div style={{ color: '#a0a0a0', fontSize: '12px' }}>
                              {report.path}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="export-section">
                    <div className="export-section-title">导出清理清单</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-secondary" onClick={exportCleanupList}>
                        导出文本报告
                      </button>
                      <button className="btn btn-secondary" onClick={exportJSON}>
                        导出JSON
                      </button>
                    </div>
                  </div>
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

export default ChangePreviewModal;
