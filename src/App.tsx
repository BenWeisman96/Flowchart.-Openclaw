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

type DiagramMeta = {
  id: string;
  name: string;
  updatedAt: string;
};

type Diagram = {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  updatedAt: string;
};

const DEFAULT_DIAGRAM = `flowchart TD
  A[Agent posts opportunity] --> B[Marketplace status Open]
  B --> C[Advisor clicks Interested]
  C --> D[Interest saved + Interested]
  D --> E[Agent reviews interested advisors]
  E --> F[Agent selects advisor]
  F --> G[Status advisor_selected]
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

const MINI_ARC_TEST_NODES: Node[] = [
  { id: 'a1', position: { x: 80, y: 120 }, data: { label: 'Agent posts opportunity' }, type: 'input' },
  { id: 'a2', position: { x: 380, y: 120 }, data: { label: 'Advisor clicks Interested' } },
  { id: 'a3', position: { x: 700, y: 120 }, data: { label: 'Agent selects advisor' } },
  { id: 'a4', position: { x: 1020, y: 120 }, data: { label: 'Timeline + comments + value tracking' }, type: 'output' },
];

const MINI_ARC_TEST_EDGES: Edge[] = [
  { id: 'ae1', source: 'a1', target: 'a2', label: 'Marketplace Open' },
  { id: 'ae2', source: 'a2', target: 'a3', label: 'Interested' },
  { id: 'ae3', source: 'a3', target: 'a4', label: 'Selected' },
];

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });

function parseSafe<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function App() {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [code, setCode] = useState(() => localStorage.getItem('flowchart_code') || DEFAULT_DIAGRAM);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const renderId = useMemo(() => `m${Math.random().toString(36).slice(2)}`, [code]);
  const previewRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    parseSafe<Node[]>(localStorage.getItem('flowchart_nodes'), INITIAL_NODES)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    parseSafe<Edge[]>(localStorage.getItem('flowchart_edges'), INITIAL_EDGES)
  );

  const [diagrams, setDiagrams] = useState<DiagramMeta[]>([]);
  const [activeDiagramId, setActiveDiagramId] = useState<string>('');
  const [activeName, setActiveName] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const loadList = useCallback(async () => {
    const res = await fetch('/api/diagrams');
    if (!res.ok) throw new Error('Failed to load diagrams list');
    const json = (await res.json()) as { diagrams: DiagramMeta[] };
    setDiagrams(json.diagrams || []);

    if (!activeDiagramId && json.diagrams?.length) {
      setActiveDiagramId(json.diagrams[0].id);
    }
  }, [activeDiagramId]);

  const loadDiagram = useCallback(async (diagramId: string) => {
    if (!diagramId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/diagrams/${diagramId}`);
      if (!res.ok) throw new Error('Failed to load diagram');
      const json = (await res.json()) as { diagram: Diagram };
      setNodes(json.diagram.nodes || INITIAL_NODES);
      setEdges(json.diagram.edges || INITIAL_EDGES);
      setActiveName(json.diagram.name || 'Untitled Diagram');
      setStatusMsg(`Loaded: ${json.diagram.name}`);
    } finally {
      setLoading(false);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    loadList().catch((e) => setStatusMsg(`API error: ${String(e)}`));
  }, [loadList]);

  useEffect(() => {
    if (activeDiagramId) {
      loadDiagram(activeDiagramId).catch((e) => setStatusMsg(`Load failed: ${String(e)}`));
    }
  }, [activeDiagramId, loadDiagram]);

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
    setStatusMsg('Canvas reset (not saved yet)');
  };

  const loadMiniArcTestFlow = () => {
    setNodes(MINI_ARC_TEST_NODES);
    setEdges(MINI_ARC_TEST_EDGES);
    setStatusMsg('Loaded mini ARC test flow. You can drag nodes around and edit as needed.');
  };

  const saveActive = async () => {
    if (!activeDiagramId) {
      setStatusMsg('No active diagram selected');
      return;
    }

    const res = await fetch(`/api/diagrams/${activeDiagramId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: activeName, nodes, edges }),
    });
    if (!res.ok) {
      const txt = await res.text();
      setStatusMsg(`Save failed: ${txt}`);
      return;
    }

    setStatusMsg('Saved ✓');
    await loadList();
  };

  const createProject = async () => {
    const name = window.prompt('New project name?', 'New Flowchart Project');
    if (!name) return;

    const res = await fetch('/api/diagrams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, nodes: INITIAL_NODES, edges: INITIAL_EDGES }),
    });

    if (!res.ok) {
      const txt = await res.text();
      setStatusMsg(`Create failed: ${txt}`);
      return;
    }

    const json = (await res.json()) as { diagram: Diagram };
    await loadList();
    setActiveDiagramId(json.diagram.id);
    setStatusMsg(`Created project: ${json.diagram.name}`);
  };

  const applyBlueprintFromPrompt = async () => {
    if (!activeDiagramId) return;
    const text = window.prompt('Paste blueprint JSON with { nodes, edges, name? }');
    if (!text) return;

    try {
      const payload = JSON.parse(text) as { name?: string; nodes: Node[]; edges: Edge[] };
      const res = await fetch(`/api/diagrams/${activeDiagramId}/apply-blueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text();
        setStatusMsg(`Blueprint apply failed: ${msg}`);
        return;
      }

      await loadDiagram(activeDiagramId);
      await loadList();
      setStatusMsg('Blueprint applied ✓');
    } catch {
      setStatusMsg('Invalid JSON blueprint');
    }
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
        <p>Public API + project tabs + visual drag/drop workflow canvas.</p>
      </header>

      <div className="projectsBar">
        <div className="tabs projectTabs">
          {diagrams.map((d) => (
            <button
              key={d.id}
              className={activeDiagramId === d.id ? 'active' : ''}
              onClick={() => setActiveDiagramId(d.id)}
              title={`${d.name} • ${new Date(d.updatedAt).toLocaleString()}`}
            >
              {d.name}
            </button>
          ))}
          <button onClick={createProject}>+ New Project</button>
        </div>

        <div className="projectActions">
          <input
            value={activeName}
            onChange={(e) => setActiveName(e.target.value)}
            placeholder="Project name"
          />
          <button onClick={saveActive}>Save Project</button>
          <button onClick={applyBlueprintFromPrompt}>Apply Blueprint JSON</button>
        </div>
      </div>

      <div className="statusLine">{loading ? 'Loading…' : statusMsg || 'Ready'}</div>

      <div className="tabs">
        <button className={mode === 'visual' ? 'active' : ''} onClick={() => setMode('visual')}>
          Visual Builder
        </button>
        <button className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>
          Mermaid Code
        </button>
      </div>

      {mode === 'visual' ? (
        <div className="coachMessage">
          ✅ You can drag nodes, connect paths, and move everything around. Try <strong>Load Mini ARC Test</strong> to start with a sample flow.
        </div>
      ) : null}

      {mode === 'visual' ? (
        <section className="visualWrap">
          <aside className="panel">
            <h2>Node Palette</h2>
            <button onClick={() => addNode('action')}>+ Action</button>
            <button onClick={() => addNode('decision')}>+ Decision</button>
            <button onClick={() => addNode('end')}>+ End</button>
            <button onClick={clearVisual}>Reset Canvas</button>
            <button onClick={loadMiniArcTestFlow}>Load Mini ARC Test</button>
            <p className="hint">Drag nodes, connect handles, pan/zoom with mouse.</p>
          </aside>

          <div className="canvasWrap">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              fitView
            >
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

            {error ? (
              <pre className="error">{error}</pre>
            ) : (
              <div className="canvas" ref={previewRef} dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </section>
        </main>
      )}
    </div>
  );
}
