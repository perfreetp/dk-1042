import React, { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { LineageGraph, FileNode, Project } from '../types';

interface LineageCanvasProps {
  graph: LineageGraph;
  selectedFile: FileNode | null;
  colorBy: 'type' | 'owner' | 'date';
  project: Project | null;
  collapsedNodes: Set<string>;
  onFileSelect: (file: FileNode) => void;
  onSelectionChange: (nodeIds: string[]) => void;
  onToggleCollapse: (nodeId: string) => void;
  zoom: number;
}

const colorSchemes = {
  type: {
    table: '#2196f3',
    script: '#4caf50',
    report: '#ff9800',
    config: '#9c27b0',
    data: '#607d8b',
    other: '#795548'
  },
  date: {
    recent: '#4caf50',
    week: '#ff9800',
    month: '#f44336',
    older: '#9e9e9e'
  }
};

const ownerColors = [
  '#e91e63', '#00bcd4', '#8bc34a', '#ff5722', 
  '#9c27b0', '#3f51b5', '#009688', '#795548',
  '#607d8b', '#ff9800', '#9e9e9e', '#673ab7'
];

const LineageCanvas = forwardRef<any, LineageCanvasProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const collapsedNodeIds = useRef<Set<string>>(new Set());
  const selectionBeforeCollapse = useRef<string[]>([]);

  useImperativeHandle(ref, () => ({
    zoom: (level: number) => {
      if (cyRef.current) {
        cyRef.current.zoom(level);
      }
    },
    fit: () => {
      if (cyRef.current) {
        cyRef.current.fit(undefined, 50);
      }
    }
  }));

  const getDownstreamNodes = useCallback((nodeId: string): string[] => {
    const result: string[] = [];
    const visited = new Set<string>();
    
    const collect = (id: string) => {
      const edges = props.graph.edges.filter(e => e.source === id);
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          result.push(edge.target);
          collect(edge.target);
        }
      }
    };
    
    collect(nodeId);
    return result;
  }, [props.graph.edges]);

  const hideSubgraph = useCallback((nodeId: string) => {
    if (!cyRef.current) return;
    
    selectionBeforeCollapse.current = cyRef.current.nodes(':selected').map(n => n.id());
    
    const downstream = getDownstreamNodes(nodeId);
    for (const id of downstream) {
      const node = cyRef.current.$(`#${id}`);
      const edges = cyRef.current.edges().filter(e => 
        e.source().id() === id || e.target().id() === id
      );
      edges.add(node.connectedEdges()).hide();
      node.hide();
    }
    
    collapsedNodeIds.current.add(nodeId);
  }, [getDownstreamNodes]);

  const showSubgraph = useCallback((nodeId: string) => {
    if (!cyRef.current) return;
    
    const downstream = getDownstreamNodes(nodeId);
    for (const id of downstream) {
      const node = cyRef.current.$(`#${id}`);
      const edges = cyRef.current.edges().filter(e => 
        e.source().id() === id || e.target().id() === id
      );
      edges.add(node.connectedEdges()).show();
      node.show();
    }
    
    collapsedNodeIds.current.delete(nodeId);
    
    cyRef.current.nodes().unselect();
    for (const id of selectionBeforeCollapse.current) {
      cyRef.current.$(`#${id}`).select();
    }
  }, [getDownstreamNodes]);

  useEffect(() => {
    if (!containerRef.current || props.graph.nodes.length === 0) return;

    const elements: ElementDefinition[] = [];

    props.graph.nodes.forEach(node => {
      let color = colorSchemes.type[node.type as keyof typeof colorSchemes.type] || colorSchemes.type.other;
      
      if (props.colorBy === 'type') {
        color = colorSchemes.type[node.type as keyof typeof colorSchemes.type] || colorSchemes.type.other;
      } else if (props.colorBy === 'owner') {
        const metadata = props.project?.fileMetadata[node.id];
        const owner = metadata?.owner;
        const ownerMap = new Map<string, number>();
        if (props.project) {
          Object.values(props.project.fileMetadata).forEach((meta, idx) => {
            if (meta.owner) ownerMap.set(meta.owner, idx % ownerColors.length);
          });
        }
        if (owner && ownerMap.has(owner)) {
          color = ownerColors[ownerMap.get(owner)!];
        } else {
          color = '#666666';
        }
      } else if (props.colorBy === 'date') {
        const date = new Date(node.modifiedTime);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        
        if (days < 7) color = colorSchemes.date.recent;
        else if (days < 30) color = colorSchemes.date.week;
        else if (days < 90) color = colorSchemes.date.month;
        else color = colorSchemes.date.older;
      }

      const isDeprecated = props.project?.deprecatedFiles.includes(node.id) || node.deprecated;

      elements.push({
        data: {
          id: node.id,
          label: node.name,
          color: isDeprecated ? '#666666' : color,
          type: node.type,
          extension: node.extension,
          deprecated: isDeprecated,
          collapsed: collapsedNodeIds.current.has(node.id)
        }
      });
    });

    props.graph.edges.forEach(edge => {
      const isDeprecated = props.project?.deprecatedEdges.includes(edge.id) || edge.deprecated;
      const sourceDeprecated = props.project?.deprecatedFiles.includes(edge.source) || 
                              props.graph.nodes.find(n => n.id === edge.source)?.deprecated;
      const targetDeprecated = props.project?.deprecatedFiles.includes(edge.target) || 
                               props.graph.nodes.find(n => n.id === edge.target)?.deprecated;

      elements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          confidence: edge.confidence,
          confirmed: props.project?.confirmedEdges.includes(edge.id) || edge.confirmed,
          deprecated: isDeprecated || sourceDeprecated || targetDeprecated
        }
      });
    });

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    cyRef.current = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#e0e0e0',
            'text-valign': 'bottom',
            'text-margin-y': 8,
            'font-size': '12px',
            'width': 50,
            'height': 50,
            'shape': 'roundrectangle',
            'border-width': 3,
            'border-color': '#ffffff'
          }
        },
        {
          selector: 'node[?deprecated]',
          style: {
            'background-color': '#666666',
            'opacity': 0.5,
            'border-style': 'dashed',
            'border-color': '#f44336',
            'border-width': 2
          }
        },
        {
          selector: 'node[?collapsed]',
          style: {
            'border-width': 4,
            'border-color': '#ff9800'
          }
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#4a9eff'
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#666666',
            'target-arrow-color': '#666666',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.7
          }
        },
        {
          selector: 'edge[?deprecated]',
          style: {
            'line-color': '#f44336',
            'target-arrow-color': '#f44336',
            'opacity': 0.4,
            'line-style': 'dashed'
          }
        },
        {
          selector: 'edge[type = "reference"]',
          style: {
            'line-color': '#4a9eff',
            'target-arrow-color': '#4a9eff',
            'line-style': 'dashed'
          }
        },
        {
          selector: 'edge[type = "input"]',
          style: {
            'line-color': '#4caf50',
            'target-arrow-color': '#4caf50'
          }
        },
        {
          selector: 'edge[type = "output"]',
          style: {
            'line-color': '#ff9800',
            'target-arrow-color': '#ff9800'
          }
        },
        {
          selector: 'edge[type = "version"]',
          style: {
            'line-color': '#9c27b0',
            'target-arrow-color': '#9c27b0'
          }
        },
        {
          selector: 'edge[?confirmed]',
          style: {
            'line-width': 3
          }
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 4,
            'line-color': '#ffffff',
            'target-arrow-color': '#ffffff'
          }
        },
        {
          selector: 'edge[confidence < 0.6]',
          style: {
            'opacity': 0.4
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: true,
        animationDuration: 1000,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 100
      },
      minZoom: 0.2,
      maxZoom: 2,
      wheelSensitivity: 0.2,
      boxSelectionEnabled: true
    });

    cyRef.current.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      const node = props.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        props.onFileSelect(node);
      }
    });

    cyRef.current.on('tap', (evt) => {
      if (evt.target === cyRef.current) {
        props.onSelectionChange([]);
      }
    });

    cyRef.current.on('select', 'node', () => {
      const selectedNodes = cyRef.current!.nodes(':selected').map(n => n.id());
      props.onSelectionChange(selectedNodes);
    });

    cyRef.current.on('unselect', 'node', () => {
      const selectedNodes = cyRef.current!.nodes(':selected').map(n => n.id());
      props.onSelectionChange(selectedNodes);
    });

    cyRef.current.on('cxttap', 'node', (evt) => {
      const nodeId = evt.target.id();
      
      if (collapsedNodeIds.current.has(nodeId)) {
        showSubgraph(nodeId);
      } else {
        hideSubgraph(nodeId);
      }
      
      const selectedNodes = cyRef.current!.nodes(':selected').map(n => n.id());
      props.onSelectionChange(selectedNodes);
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [props.graph, props.colorBy, props.project, hideSubgraph, showSubgraph]);

  useEffect(() => {
    if (cyRef.current && props.selectedFile) {
      cyRef.current.elements().unselect();
      const selected = cyRef.current.$(`#${props.selectedFile.id}`);
      if (selected.visible()) {
        selected.select();
      }
      
      if (props.zoom !== 100) {
        cyRef.current.zoom(props.zoom / 100);
      }
    }
  }, [props.selectedFile, props.zoom]);

  useEffect(() => {
    if (cyRef.current) {
      props.collapsedNodes.forEach(nodeId => {
        if (!collapsedNodeIds.current.has(nodeId)) {
          hideSubgraph(nodeId);
        }
      });
      
      collapsedNodeIds.current.forEach(nodeId => {
        if (!props.collapsedNodes.has(nodeId)) {
          showSubgraph(nodeId);
        }
      });
    }
  }, [props.collapsedNodes, hideSubgraph, showSubgraph]);

  return (
    <div ref={containerRef} className="cytoscape-container" />
  );
});

LineageCanvas.displayName = 'LineageCanvas';

export default LineageCanvas;
