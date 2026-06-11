import { FileNode, LineageEdge, LineageGraph } from '../types';

interface ReadOperation {
  tableName: string;
  confidence: number;
}

interface WriteOperation {
  tableName: string;
  confidence: number;
}

export function analyzeLineage(files: FileNode[], fileContents: Map<string, string>): LineageGraph {
  const edges: LineageEdge[] = [];
  const tableExtensions = ['.xlsx', '.xls', '.csv', '.parquet', '.db', '.sqlite'];
  const scriptExtensions = ['.py', '.sql', '.r', '.js', '.sh', '.bat'];

  const tables = files.filter(f => tableExtensions.includes(f.extension));
  const scripts = files.filter(f => scriptExtensions.includes(f.extension));

  for (const script of scripts) {
    const content = fileContents.get(script.path) || '';
    const { reads, writes } = analyzeScriptContent(content, script.extension);

    for (const read of reads) {
      const table = findMatchingTable(read.tableName, tables);
      if (table && table.id !== script.id) {
        const edgeExists = edges.some(e => 
          e.source === table.id && e.target === script.id && e.type === 'input'
        );
        if (!edgeExists) {
          edges.push(createEdge(table, script, 'input', read.confidence));
        }
      }
    }

    for (const write of writes) {
      const table = findMatchingTable(write.tableName, tables);
      if (table && table.id !== script.id) {
        const edgeExists = edges.some(e => 
          e.source === script.id && e.target === table.id && e.type === 'output'
        );
        if (!edgeExists) {
          edges.push(createEdge(script, table, 'output', write.confidence));
        }
      }
    }

    const referencedByName = analyzeByTableName(script, tables, edges);
    edges.push(...referencedByName.filter(e => 
      !edges.some(existing => existing.id === e.id)
    ));
  }

  const versionGroups = analyzeVersionGroups(files);
  for (const group of versionGroups) {
    for (let i = 0; i < group.length - 1; i++) {
      const edgeId = `${group[i].id}-version-${group[i + 1].id}`;
      if (!edges.some(e => e.id === edgeId)) {
        edges.push(createEdge(group[i], group[i + 1], 'version', 1.0));
      }
    }
  }

  const scriptDeps = analyzeScriptDependencies(files, edges);
  for (const dep of scriptDeps) {
    if (!edges.some(e => e.id === dep.id)) {
      edges.push(dep);
    }
  }

  return { nodes: files, edges };
}

function analyzeScriptContent(content: string, extension: string): { reads: ReadOperation[], writes: WriteOperation[] } {
  const reads: ReadOperation[] = [];
  const writes: WriteOperation[] = [];

  if (extension === '.py') {
    const readPatterns = [
      /read_csv\s*\(\s*['"]([^'"]+)['"]/gi,
      /read_excel\s*\(\s*['"]([^'"]+)['"]/gi,
      /pd\.read_[a-z]+\s*\(\s*['"]([^'"]+)['"]/gi,
      /open\s*\(\s*['"]([^'"]+\.(?:csv|xlsx?|parquet))['"]/gi,
    ];

    for (const pattern of readPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fileName = extractFileName(match[1]);
        reads.push({ tableName: fileName, confidence: 0.85 });
      }
    }

    const writePatterns = [
      /to_csv\s*\(\s*['"]([^'"]+)['"]/gi,
      /to_excel\s*\(\s*['"]([^'"]+)['"]/gi,
      /df\.to_[a-z]+\s*\(\s*['"]([^'"]+)['"]/gi,
    ];

    for (const pattern of writePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fileName = extractFileName(match[1]);
        writes.push({ tableName: fileName, confidence: 0.85 });
      }
    }

  } else if (extension === '.sql') {
    const selectPatterns = [
      /SELECT\s+.+\s+FROM\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      /FROM\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
      /JOIN\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,
    ];

    for (const pattern of selectPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        reads.push({ tableName: match[1], confidence: 0.9 });
      }
    }

    const insertPattern = /INSERT\s+INTO\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi;
    let match;
    while ((match = insertPattern.exec(content)) !== null) {
      writes.push({ tableName: match[1], confidence: 0.9 });
    }

  } else if (extension === '.sh') {
    const varPattern = /\$\{?([A-Za-z0-9_]*\.?(?:csv|xlsx?))\}?/gi;
    let match;
    while ((match = varPattern.exec(content)) !== null) {
      const fileName = extractFileName(match[1]);
      if (content.includes('>') || content.includes('echo')) {
        writes.push({ tableName: fileName, confidence: 0.7 });
      } else {
        reads.push({ tableName: fileName, confidence: 0.7 });
      }
    }
  }

  return { reads, writes };
}

function extractFileName(path: string): string {
  const parts = path.split(/[/\\]/);
  const fileName = parts[parts.length - 1];
  return fileName.replace(/\.[^.]+$/, '');
}

function findMatchingTable(tableName: string, tables: FileNode[]): FileNode | null {
  const lowerName = tableName.toLowerCase();
  
  for (const table of tables) {
    const tableBase = table.name.replace(/\.[^.]+$/, '').toLowerCase();
    if (tableBase === lowerName || table.name.toLowerCase() === lowerName + tables[0]?.extension.toLowerCase()) {
      return table;
    }
  }
  
  return null;
}

function analyzeByTableName(script: FileNode, tables: FileNode[], existingEdges: LineageEdge[]): LineageEdge[] {
  const edges: LineageEdge[] = [];
  const scriptBase = script.name.replace(/\.[^.]+$/, '').toLowerCase();

  for (const table of tables) {
    const tableBase = table.name.replace(/\.[^.]+$/, '').toLowerCase();
    
    if (scriptBase.includes(tableBase) || tableBase.includes(scriptBase)) {
      const edgeExists = existingEdges.some(e => 
        (e.source === table.id && e.target === script.id) ||
        (e.source === script.id && e.target === table.id)
      );
      
      if (!edgeExists) {
        edges.push(createEdge(table, script, 'input', 0.6));
      }
    }
  }

  return edges;
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

function analyzeScriptDependencies(files: FileNode[], existingEdges: LineageEdge[]): LineageEdge[] {
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
      const edgeExists = existingEdges.some(e => e.id === `input-${input.id}-${script.id}`);
      if (!edgeExists) {
        edges.push(createEdge(input, script, 'input', 0.8));
      }
    }

    const outputFiles = files.filter(f =>
      f.id !== script.id &&
      (f.path.includes(baseName + '_output') || 
       f.name.includes(baseName + '.output') ||
       f.name.includes(baseName + '_result') ||
       f.name.includes(baseName + '_out'))
    );

    for (const output of outputFiles) {
      const edgeExists = existingEdges.some(e => e.id === `output-${script.id}-${output.id}`);
      if (!edgeExists) {
        edges.push(createEdge(script, output, 'output', 0.8));
      }
    }
  }

  return edges;
}

function createEdge(source: FileNode, target: FileNode, type: LineageEdge['type'], confidence: number): LineageEdge {
  const stableId = `${type}-${source.name}-${source.extension}-to-${target.name}-${target.extension}`;
  return {
    id: stableId,
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
