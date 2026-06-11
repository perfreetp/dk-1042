import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import { LineageGraph, FileNode } from '../types';

interface LineageCanvasProps {
  graph: LineageGraph;
  selectedFile: FileNode | null;
  colorBy: 'type' | 'owner' | 'date';
  onFileSelect: (file: FileNode) => void;
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
  owner: {
    alice: '#e91e63',
    bob: '#00bcd4',
    charlie: '#8bc34a',
    default: '#9e9e9e'
  },
  date: {
    recent: '#4caf50',
    week: '#ff9800',
    month: '#f44336',
    older: '#9e9e9e'
  }
};

const LineageCanvas = forwardRef<any, LineageCanvasProps>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

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

  useEffect(() => {
    if (!containerRef.current || props.graph.nodes.length === 0) return;

    const elements: ElementDefinition[] = [];

    props.graph.nodes.forEach(node => {
      let color = colorSchemes.type.other;
      
      if (props.colorBy === 'type') {
        color = colorSchemes.type[node.type as keyof typeof colorSchemes.type] || colorSchemes.type.other;
      } else if (props.colorBy === 'owner') {
        color = colorSchemes.owner[(node as any).owner as keyof typeof colorSchemes.owner] || colorSchemes.owner.default;
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

      elements.push({
        data: {
          id: node.id,
          label: node.name,
          color,
          type: node.type,
          extension: node.extension
        }
      });
    });

    props.graph.edges.forEach(edge => {
      elements.push({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type,
          confidence: edge.confidence,
          confirmed: edge.confirmed
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
            'width': 60,
            'height': 60,
            'shape': 'roundrectangle',
            'border-width': 2,
            'border-color': '#ffffff'
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
      wheelSensitivity: 0.2
    });

    cyRef.current.on('tap', 'node', (evt) => {
      const nodeId = evt.target.id();
      const node = props.graph.nodes.find(n => n.id === nodeId);
      if (node) {
        props.onFileSelect(node);
      }
    });

    return () => {
      if (cyRef.current) {
        cyRef.current.destroy();
      }
    };
  }, [props.graph, props.colorBy]);

  useEffect(() => {
    if (cyRef.current && props.selectedFile) {
      cyRef.current.elements().unselect();
      const selected = cyRef.current.$(`#${props.selectedFile.id}`);
      selected.select();
    }
  }, [props.selectedFile]);

  return (
    <div ref={containerRef} className="cytoscape-container" />
  );
});

LineageCanvas.displayName = 'LineageCanvas';

export default LineageCanvas;
