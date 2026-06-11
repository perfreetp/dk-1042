import { FileNode, LineageEdge, LineageGraph } from '../types';

export function analyzeLineage(files: FileNode[]): LineageGraph {
  const edges: LineageEdge[] = [];
  const fileMap = new Map(files.map(f => [f.path, f]));

  // 1. 分析同名版本关系
  const versionGroups = analyzeVersionGroups(files);
  for (const group of versionGroups) {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push(createEdge(group[i], group[i + 1], 'version', 1.0));
    }
  }

  // 2. 分析表格引用
  const tableRefs = analyzeTableReferences(files, fileMap);
  edges.push(...tableRefs);

  // 3. 分析脚本输入输出
  const scriptDeps = analyzeScriptDependencies(files, fileMap);
  edges.push(...scriptDeps);

  return { nodes: files, edges };
}

function analyzeVersionGroups(files: FileNode[]): FileNode[][] {
  const groups = new Map<string, FileNode[]>();
  const versionPattern = /[._-]v?\d+(\.\d+)*$/i;

  for (const file of files) {
    const baseName = file.name.replace(versionPattern, '').replace(/\.[^.]+$/, '');
    if (!groups.has(baseName)) {
      groups.set(baseName, []);
    }
    groups.get(baseName)!.push(file);
  }

  return Array.from(groups.values()).filter(g => g.length > 1);
}

function analyzeTableReferences(files: FileNode[], fileMap: Map<string, FileNode>): LineageEdge[] {
  const edges: LineageEdge[] = [];
  const tableExtensions = ['.xlsx', '.xls', '.csv', '.parquet'];
  const scriptExtensions = ['.py', '.sql', '.r', '.js', '.sh'];
  
  const tables = files.filter(f => tableExtensions.includes(f.extension));
  const scripts = files.filter(f => scriptExtensions.includes(f.extension));

  for (const script of scripts) {
    // 简化版本：检查文件名是否包含表格名
    for (const table of tables) {
      const tableBase = table.name.replace(/\.[^.]+$/, '');
      if (script.name.includes(tableBase) || containsReference(script.path, table.name, fileMap)) {
        if (script.extension === '.sql') {
          edges.push(createEdge(script, table, 'input', 0.7));
        } else {
          edges.push(createEdge(table, script, 'output', 0.7));
        }
      }
    }
  }

  return edges;
}

function containsReference(scriptPath: string, tableName: string, fileMap: Map<string, FileNode>): boolean {
  // 这里需要读取文件内容检查，在实际实现中会更复杂
  // 简化版本返回 false
  return false;
}

function analyzeScriptDependencies(files: FileNode[], fileMap: Map<string, FileNode>): LineageEdge[] {
  const edges: LineageEdge[] = [];
  const scriptExtensions = ['.py', '.sql', '.r', '.js', '.sh', '.bat'];
  const scripts = files.filter(f => scriptExtensions.includes(f.extension));

  for (const script of scripts) {
    // 分析输入依赖
    const baseName = script.name.replace(/\.[^.]+$/, '');
    const inputFiles = files.filter(f => 
      f.path !== script.path &&
      (f.path.includes(baseName) || f.name.startsWith(baseName + '_input'))
    );

    for (const input of inputFiles) {
      edges.push(createEdge(input, script, 'input', 0.8));
    }

    // 分析输出
    const outputFiles = files.filter(f =>
      f.path !== script.path &&
      (f.path.includes(baseName + '_output') || 
       f.name.includes(baseName + '.output') ||
       f.name.includes(baseName + '_result'))
    );

    for (const output of outputFiles) {
      edges.push(createEdge(script, output, 'output', 0.8));
    }
  }

  return edges;
}

function createEdge(source: FileNode, target: FileNode, type: LineageEdge['type'], confidence: number): LineageEdge {
  return {
    id: `${source.id}-${type}-${target.id}`,
    source: source.id,
    target: target.id,
    type,
    confidence,
    confirmed: false
  };
}

export function filterByExtension(files: FileNode[], extensions: string[]): FileNode[] {
  return files.filter(f => extensions.includes(f.extension));
}

export function groupByExtension(files: FileNode[]): Map<string, FileNode[]> {
  const groups = new Map<string, FileNode[]>();
  for (const file of files) {
    if (!groups.has(file.extension)) {
      groups.set(file.extension, []);
    }
    groups.get(file.extension)!.push(file);
  }
  return groups;
}

export function getUpstreamFiles(nodeId: string, graph: LineageGraph): FileNode[] {
  const upstreamIds = graph.edges
    .filter(e => e.target === nodeId)
    .map(e => e.source);
  return graph.nodes.filter(n => upstreamIds.includes(n.id));
}

export function getDownstreamFiles(nodeId: string, graph: LineageGraph): FileNode[] {
  const downstreamIds = graph.edges
    .filter(e => e.source === nodeId)
    .map(e => e.target);
  return graph.nodes.filter(n => downstreamIds.includes(n.id));
}
