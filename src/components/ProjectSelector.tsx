import React from 'react';
import { Project } from '../types';

interface ProjectSelectorProps {
  projects: Project[];
  currentProjectId: string | null;
  onSelect: (project: Project) => void;
  onClose: () => void;
  onNewProject: () => void;
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ projects, currentProjectId, onSelect, onClose, onNewProject }) => {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <h2 className="modal-title">选择项目</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {projects.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-text">暂无项目</div>
              <div className="empty-state-hint">点击下方按钮创建新项目</div>
            </div>
          ) : (
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {projects.map(project => (
                <div
                  key={project.id}
                  className="preview-item"
                  style={{
                    cursor: 'pointer',
                    background: currentProjectId === project.id ? '#3a3a3a' : undefined,
                    border: currentProjectId === project.id ? '2px solid #4a9eff' : undefined
                  }}
                  onClick={() => onSelect(project)}
                >
                  <div className="preview-item-header">
                    <div>
                      <h4 style={{ margin: 0 }}>{project.name}</h4>
                      <span style={{ fontSize: '12px', color: '#a0a0a0' }}>
                        创建于: {formatDate(project.createdAt)}
                      </span>
                    </div>
                    {currentProjectId === project.id && (
                      <span className="confirmed-badge">当前项目</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#a0a0a0', marginTop: '8px' }}>
                    <div>文件夹: {project.folderPath || '未导入'}</div>
                    <div>最后修改: {formatDate(project.lastModified)}</div>
                    <div>
                      文件数: {Object.keys(project.fileMetadata).length} | 
                      已确认关系: {project.confirmedEdges.length} | 
                      废弃文件: {project.deprecatedFiles.length}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={onNewProject}>新建项目</button>
        </div>
      </div>
    </div>
  );
};

export default ProjectSelector;
