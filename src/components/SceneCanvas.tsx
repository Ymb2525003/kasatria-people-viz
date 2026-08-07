"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { PeriodicScene } from "@/scene/PeriodicScene";
import type { LayoutId, Person } from "@/types/person";

/**
 * The scene actions the React shell may trigger.
 *
 * Deliberately narrow. Resetting the view is a one-off command, not state —
 * modelling it as a prop would mean inventing a counter to change, which is
 * state that exists only to be ignored. Everything that genuinely *is* state
 * (data, layout, visibility) still flows one way, as props.
 */
export interface SceneHandle {
  resetView: () => void;
}

interface SceneCanvasProps {
  people: readonly Person[];
  layout: LayoutId;
  visibleIds: ReadonlySet<string>;
  onSelect: (person: Person | null) => void;
  /** React 19 passes refs as an ordinary prop; no forwardRef needed. */
  ref?: Ref<SceneHandle>;
}

/**
 * The single bridge between React and the imperative three.js layer.
 *
 * This is the ONLY file that knows about both worlds. Everything above it is
 * ordinary React; everything below it is framework-agnostic TypeScript.
 */
export function SceneCanvas({ people, layout, visibleIds, onSelect, ref }: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PeriodicScene | null>(null);

  useImperativeHandle(ref, () => ({ resetView: () => sceneRef.current?.resetView() }), []);

  // Keep the latest callback in a ref so the scene is not torn down and
  // rebuilt every time the parent re-renders with a new function identity.
  // Assigned in an effect, not during render: mutating a ref during render
  // is unsafe under concurrent rendering, where a render can be discarded.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;

    const scene = new PeriodicScene({
      onSelect: (person) => onSelectRef.current(person),
    });
    scene.mount(container);
    sceneRef.current = scene;

    // Strict Mode invokes effects twice in development. Without this cleanup
    // a second renderer stays attached and every tile renders twice.
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setData(people);
    sceneRef.current?.transformTo(layout);
    // `layout` is intentionally omitted: this effect is about DATA changing.
    // The layout effect below handles layout changes on its own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people]);

  useEffect(() => {
    sceneRef.current?.transformTo(layout);
  }, [layout]);

  useEffect(() => {
    sceneRef.current?.setVisible(visibleIds);
  }, [visibleIds]);

  return <div ref={containerRef} className="scene-canvas" aria-hidden="true" />;
}
