import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

const DEFAULT_DIAGRAM = `flowchart TD
  A[Agent posts opportunity] --> B[Marketplace status: Open]
  B --> C[Advisor clicks Interested]
  C --> D[Interest saved + Interested ✓]
  D --> E[Agent reviews interested advisors]
  E --> F[Agent selects advisor]
  F --> G[Status: advisor_selected]
  G --> H[Removed from open marketplace]
  H --> I[Shared timeline page]
  I --> J[Both can comment + update milestones]
  J --> K[Track expected and close value]`;

const INITIAL_NODES: Node[] = [
  { id: 'start', position: { x: 80, y: 120 }, data: { label: 'Start' }, type: 'input' },
  { id: 'action-1', position: { x: 360, y: 120 }, data: { label: 'Agent posts opportunity' } },
  { id: 'decision-1', position: { x: 680, y: 120 }, data: { label: 'Advisor interested?' } },
  { id: 'end', position: { x: 980, y: 120 }, data: { label: 'Track timeline + value' }, type: 'output' },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1', source: 'start', target: 'action-1' },
  { id: 'e2', source: 'action-1', target: 'decision-1' },
  { id: 'e3', source: 'decision-1', target: 'end', label: 'Yes' },
];

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });

export function App() {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [code, setCode] = useState(() => localStorage.getItem('flowchart_code') || DEFAULT_DIAGRAM);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const renderId = useMemo(() => `m${Math.random().toString(36).slice(2)}`, [code]);
  const previewRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    () => JSON.parse(localStorage.getItem('flowchart_nodes') || 'null') || INITIAL_NODES
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    () => JSON.parse(localStorage.getItem('flowchart_edges') || 'null') || INITIAL_EDGES
  );

  useEffect(() => {
    localStorage.setItem('flowchart_code', code);
    let cancelled = false;

    (async () => {
      try {
        setError('');
        const { svg } = await mermaid.render(renderId, code);
        if (!cancelled) setSvg(svg);
      } catch (err) {
        if (!cancelled) {
          setSvg('');
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, renderId]);

  useEffect(() => {
    localStorage.setItem('flowchart_nodes', JSON.stringify(nodes));
  }, [nodes]);

  useEffect(() => {
    localStorage.setItem('flowchart_edges', JSON.stringify(edges));
  }, [edges]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [setEdges]
  );

  const addNode = (kind: 'action' | 'decision' | 'end') => {
    const id = `${kind}-${Date.now()}`;
    const y = 120 + nodes.length * 70;
    setNodes((curr) => [
      ...curr,
      {
        id,
        data: {
          label:
            kind === 'action'
              ? 'New Action'
              : kind === 'decision'
              ? 'New Decision'
              : 'End',
        },
        type: kind === 'end' ? 'output' : 'default',
        position: { x: 220 + (curr.length % 3) * 280, y },
      },
    ]);
  };

  const clearVisual = () => {
    setNodes(INITIAL_NODES);
    setEdges(INITIAL_EDGES);
  };

  const downloadSvg = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flowchart.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = async () => {
    const svgEl = previewRef.current?.querySelector('svg');
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgText = serializer.serializeToString(svgEl);
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((pngBlob) => {
          if (!pngBlob) return;
          const pngUrl = URL.createObjectURL(pngBlob);
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = 'flowchart.png';
          a.click();
          URL.revokeObjectURL(pngUrl);
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="app">
      <header>
        <h1>Flowchart Builder</h1>
        <p>Visual drag/drop workflow canvas + Mermaid code editor.</p>
      </header>

      <div className="tabs">
        <button className={mode === 'visual' ? 'active' : ''} onClick={() => setMode('visual')}>
          Visual Builder
        </button>
        <button className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>
          Mermaid Code
        </button>
      </div>

      {mode === 'visual' ? (
        <section className="visualWrap">
          <aside className="panel">
            <h2>Node Palette</h2>
            <button onClick={() => addNode('action')}>+ Action</button>
            <button onClick={() => addNode('decision')}>+ Decision</button>
            <button onClick={() => addNode('end')}>+ End</button>
            <button onClick={clearVisual}>Reset Canvas</button>
            <p className="hint">Drag nodes, connect handles, pan/zoom with mouse.</p>
          </aside>

          <div className="canvasWrap">
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
              <MiniMap />
              <Controls />
              <Background />
            </ReactFlow>
          </div>
        </section>
      ) : (
        <main>
          <section className="editor">
            <div className="row">
              <h2>Diagram Code</h2>
              <button onClick={() => setCode(DEFAULT_DIAGRAM)}>Reset</button>
            </div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
          </section>

          <section className="preview">
            <div className="row">
              <h2>Preview</h2>
              <div className="actions">
                <button onClick={downloadSvg} disabled={!svg}>Export SVG</button>
                <button onClick={downloadPng} disabled={!svg}>Export PNG</button>
              </div>
            </div>

            {error ? <pre className="error">{error}</pre> : <div className="canvas" ref={previewRef} dangerouslySetInnerHTML={{ __html: svg }} />}
          </section>
        </main>
      )}
    </div>
  );
}
