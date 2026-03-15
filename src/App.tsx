import { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';

const DEFAULT_DIAGRAM = `flowchart TD
  A[Agent posts opportunity] --> B[Marketplace status: Open]
  B --> C[Advisor clicks \"I'm Interested\"]
  C --> D[Interest saved + Interested ✓]
  D --> E[Agent reviews interested advisors]
  E --> F[Agent selects advisor]
  F --> G[Status: advisor_selected]
  G --> H[Removed from open marketplace]
  H --> I[Shared timeline page]
  I --> J[Both can comment + update milestones]
  J --> K[Track expected and close value]`;

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'default' });

export function App() {
  const [code, setCode] = useState(() => localStorage.getItem('flowchart_code') || DEFAULT_DIAGRAM);
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const renderId = useMemo(() => `m${Math.random().toString(36).slice(2)}`, [code]);
  const previewRef = useRef<HTMLDivElement>(null);

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
        <p>Paste Mermaid flowchart/mindmap syntax, then export as SVG or PNG.</p>
      </header>

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
    </div>
  );
}
