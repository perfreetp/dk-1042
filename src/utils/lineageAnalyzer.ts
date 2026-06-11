import { FileNode, LineageEdge, LineageGraph } from '../types';

interface FileContent {
  path: string;
  content: string;
}

export function analyzeLineage(files: FileNode[], fileContents: Map<string, string>): LineageGraph {
  const edges: LineageEdge[] = [];
  const fileMap = new Map(files.map(f => [f.path, f]));
  const tableNames = new Map<string, FileNode>();

  const tableExtensions = ['.xlsx', '.xls', '.csv', '.parquet', '.db', '.sqlite'];
  files.filter(f => tableExtensions.includes(f.extension)).forEach(table => {
    const baseName = table.name.replace(/\.[^.]+$/, '');
    tableNames.set(baseName.toLowerCase(), table);
    tableNames.set(table.name.replace(/\.[^.]+$/, '').toLowerCase(), table);
  });

  const versionGroups = analyzeVersionGroups(files);
  for (const group of versionGroups) {
    for (let i = 0; i < group.length - 1; i++) {
      edges.push(createEdge(group[i], group[i + 1], 'version', 1.0));
    }
  }

  const scriptExtensions = ['.py', '.sql', '.r', '.js', '.sh', '.bat'];
  const scripts = files.filter(f => scriptExtensions.includes(f.extension));

  for (const script of scripts) {
    const content = fileContents.get(script.path) || '';
    const contentLower = content.toLowerCase();

    for (const table of files.filter(f => tableExtensions.includes(f.extension))) {
      const tableBase = table.name.replace(/\.[^.]+$/, '').toLowerCase();
      
      if (contentLower.includes(tableBase)) {
        const edgeType = script.extension === '.sql' ? 'input' : 'output';
        const confidence = calculateConfidence(script, table, contentLower, tableBase);
        
        if (!edges.some(e => 
          e.source === script.id && e.target === table.id && e.type === 'input' ||
          e.source === table.id && e.target === script.id && e.type === 'output'
        )) {
          if (script.extension === '.sql') {
            edges.push(createEdge(script, table, 'input', confidence));
          } else {
            edges.push(createEdge(table, script, 'output', confidence));
          }
        }
      }
    }

    const referencedTableNames = extractTableNamesFromContent(content, script.extension);
    for (const refName of referencedTableNames) {
      const table = tableNames.get(refName.toLowerCase());
      if (table && table.id !== script.id) {
        const edgeType = script.extension === '.sql' ? 'input' : 'output';
        
        if (!edges.some(e => 
          (e.source === script.id && e.target === table.id) ||
          (e.source === table.id && e.target === script.id)
        )) {
          if (script.extension === '.sql') {
            edges.push(createEdge(script, table, 'input', 0.85));
          } else {
            edges.push(createEdge(table, script, 'output', 0.85));
          }
        }
      }
    }
  }

  const scriptDeps = analyzeScriptDependencies(files, fileMap);
  for (const dep of scriptDeps) {
    if (!edges.some(e => e.id === dep.id)) {
      edges.push(dep);
    }
  }

  return { nodes: files, edges };
}

function extractTableNamesFromContent(content: string, extension: string): string[] {
  const tableNames: string[] = [];
  
  if (extension === '.sql') {
    const patterns = [
      /FROM\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      /JOIN\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      /INTO\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      /TABLE\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      /INSERT\s+INTO\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        tableNames.push(match[1]);
      }
    }
  } else if (extension === '.py') {
    const patterns = [
      /read_csv\s*\(\s*['"]([^'"]+)['"]/gi,
      /to_csv\s*\(\s*['"]([^'"]+)['"]/gi,
      /read_excel\s*\(\s*['"]([^'"]+)['"]/gi,
      /to_excel\s*\(\s*['"]([^'"]+)['"]/gi,
      /pd\.read_[a-z]+\s*\(\s*['"]([^'"]+)['"]/gi,
      /open\s*\(\s*['"]([^'"]+)['"]/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fileName = match[1].split('/').pop()?.split('\\').pop() || match[1];
        tableNames.push(fileName.replace(/\.[^.]+$/, ''));
      }
    }
  } else if (extension === '.sh') {
    const patterns = [
      /\$\{?([A-Za-z0-9_]+\.csv)\}?/gi,
      /\$\{?([A-Za-z0-9_]+\.xlsx?)\}?/gi,
      /\$\{?([A-Za-z0-9_]+\.sql)\}?/gi,
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        tableNames.push(match[1].replace(/\.[^.]+$/, ''));
      }
    }
  }
  
  return [...new Set(tableNames)];
}

function calculateConfidence(script: FileNode, table: FileNode, contentLower: string, tableBase: string): number {
  let confidence = 0.6;
  
  const baseName = script.name.replace(/\.[^.]+$/, '').toLowerCase();
  if (contentLower.includes(baseName)) {
    confidence += 0.15;
  }
  
  if (script.extension === '.sql') {
    const sqlPatterns = ['select', 'from', 'join', 'where'];
    const matchCount = sqlPatterns.filter(p => contentLower.includes(p)).length;
    confidence += matchCount * 0.05;
  }
  
  const count = (contentLower.match(new RegExp(tableBase, 'g')) || []).length;
  if (count > 5) confidence += 0.1;
  
  return Math.min(confidence, 0.95);
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

function analyzeScriptDependencies(files: FileNode[], fileMap: Map<string, FileNode>): LineageEdge[] {
  const edges: LineageEdge[] = [];
  const scriptExtensions = ['.py', '.sql', '.r', '.js', '.sh', '.bat'];
  const scripts = files.filter(f => scriptExtensions.includes(f.extension));

  for (const script of scripts) {
    const baseName = script.name.replace(/\.[^.]+$/, '');
    
    const inputFiles = files.filter(f => 
      f.id !== script.id &&
      (f.path.includes(baseName + '_input') || 
       f.name.includes(baseName + '.input') ||
       f.name.includes(baseName + '_in'))
    );

    for (const input of inputFiles) {
      edges.push(createEdge(input, script, 'input', 0.8));
    }

    const outputFiles = files.filter(f =>
      f.id !== script.id &&
      (f.path.includes(baseName + '_output') || 
       f.name.includes(baseName + '.output') ||
       f.name.includes(baseName + '_result') ||
       f.name.includes(baseName + '_out'))
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
    .filter(e => e.target === nodeId && !e.deprecated)
    .map(e => e.source);
  return graph.nodes.filter(n => upstreamIds.includes(n.id));
}

export function getDownstreamFiles(nodeId: string, graph: LineageGraph): FileNode[] {
  const downstreamIds = graph.edges
    .filter(e => e.source === nodeId && !e.deprecated)
    .map(e => e.target);
  return graph.nodes.filter(n => downstreamIds.includes(n.id));
}

export function getAllDownstreamFiles(nodeId: string, graph: LineageGraph): FileNode[] {
  const result: FileNode[] = [];
  const visited = new Set<string>();
  
  const collect = (id: string) => {
    const edges = graph.edges.filter(e => e.source === id && !e.deprecated);
    for (const edge of edges) {
      if (!visited.has(edge.target)) {
        visited.add(edge.target);
        const node = graph.nodes.find(n => n.id === edge.target);
        if (node) {
          result.push(node);
          collect(edge.target);
        }
      }
    }
  };
  
  collect(nodeId);
  return result;
}
