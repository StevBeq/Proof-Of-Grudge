import { Component, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Outcome, Status } from '../lib/vaultSimulator';
import { sceneInput, scenePlacement } from '../lib/sceneInput';
import { startSceneLoop } from '../lib/smoothScroll';
import { SvgMonolith } from './SvgMonolith';

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Scene({ status, outcome }: { status: Status; outcome?: Outcome }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const svg = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [failed, setFailed] = useState(false);

  const fallback =
    reduced ||
    failed ||
    new URLSearchParams(window.location.search).get('renderer') === 'svg';

  useEffect(() => {
    sceneInput.status = status;
    if (outcome !== undefined) {
      sceneInput.outcome = outcome;
    }
  }, [status, outcome]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);

  useEffect(() => {
    let alive = true;
    let dispose: (() => void) | undefined;
    let stop: (() => void) | undefined;
    const node = canvas.current;

    const contextLost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    const contextRestored = () => {
      if (alive) setFailed(false);
    };

    node?.addEventListener('webglcontextlost', contextLost);
    node?.addEventListener('webglcontextrestored', contextRestored);

    if (fallback) {
      let lastPlacement = '';
      stop = startSceneLoop(() => {
        const place = scenePlacement();
        const element = svg.current;
        if (!element) return;
        const next = `${place.x}:${place.y}:${place.size}:${place.visible}`;
        if (next === lastPlacement) return;
        lastPlacement = next;
        element.style.visibility = place.visible ? 'visible' : 'hidden';
        element.style.width = `${place.size}px`;
        element.style.height = `${place.size}px`;
        element.style.transform = `translate(${place.x - place.size / 2}px, ${place.y - place.size / 2}px)`;
      }, reduced);
    } else if (node) {
      void import('./monolith')
        .then(({ createMonolith }) => {
          if (!alive) return;
          const monolith = createMonolith(node);
          dispose = monolith.dispose;
          stop = startSceneLoop(monolith.frame, false);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    }

    return () => {
      alive = false;
      stop?.();
      dispose?.();
      node?.removeEventListener('webglcontextlost', contextLost);
      node?.removeEventListener('webglcontextrestored', contextRestored);
    };
  }, [fallback, reduced]);

  return (
    <div className="scene-layer" aria-hidden="true">
      {fallback ? (
        <div className="svg-position" ref={svg}>
          <SvgMonolith status={status} outcome={outcome} />
        </div>
      ) : (
        <canvas ref={canvas} />
      )}
    </div>
  );
}

export function MonolithCanvas({
  status,
  outcome,
}: {
  status: Status;
  outcome?: Outcome;
}) {
  return (
    <SceneBoundary
      fallback={
        <div className="scene-emergency" aria-hidden="true">
          <SvgMonolith status={status} outcome={outcome} />
        </div>
      }
    >
      <Scene status={status} outcome={outcome} />
    </SceneBoundary>
  );
}
