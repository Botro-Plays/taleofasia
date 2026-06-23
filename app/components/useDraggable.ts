'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Orientation = 'horizontal' | 'vertical';
type EdgeZone = 'top' | 'bottom' | 'left' | 'right';

interface DraggablePosition {
  x: number;
  y: number;
}

interface DraggableState extends DraggablePosition {
  orientation: Orientation;
  edge: EdgeZone;
}

const STORAGE_PREFIX = 'toc_draggable_';
const EDGE_THRESHOLD = 80;

function getEdgeFromPosition(x: number, y: number, win: Window): EdgeZone {
  const w = win.innerWidth;
  const h = win.innerHeight;
  const distTop = y;
  const distBottom = h - y;
  const distLeft = x;
  const distRight = w - x;
  const min = Math.min(distTop, distBottom, distLeft, distRight);
  if (min === distTop && distTop < EDGE_THRESHOLD) return 'top';
  if (min === distBottom && distBottom < EDGE_THRESHOLD) return 'bottom';
  if (min === distLeft && distLeft < EDGE_THRESHOLD) return 'left';
  if (min === distRight && distRight < EDGE_THRESHOLD) return 'right';
  if (min === distTop) return 'top';
  if (min === distBottom) return 'bottom';
  if (min === distLeft) return 'left';
  return 'right';
}

function getOrientationForEdge(edge: EdgeZone): Orientation {
  return (edge === 'left' || edge === 'right') ? 'vertical' : 'horizontal';
}

interface UseDraggableOptions {
  storageKey: string;
  initialPosition?: DraggablePosition;
  dragExcludeSelector?: string;
  threshold?: number;
  autoOrient?: boolean;
}

export function useDraggable({
  storageKey,
  initialPosition,
  dragExcludeSelector = 'a, button, input, select, textarea',
  threshold = 3,
  autoOrient = false,
}: UseDraggableOptions) {
  const fullKey = STORAGE_PREFIX + storageKey;
  const elementRef = useRef<HTMLElement>(null);
  const [state, setState] = useState<DraggableState>({
    x: 0,
    y: 0,
    orientation: 'horizontal',
    edge: 'bottom',
  });
  const [isDragging, setIsDragging] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const dragMoved = useRef(false);

  useEffect(() => {
    const restore = () => {
    try {
      const raw = localStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          setState({
            x: parsed.x,
            y: parsed.y,
            orientation: parsed.orientation || 'horizontal',
            edge: parsed.edge || 'bottom',
          });
          setInitialized(true);
          return;
        }
      }
    } catch { /* ignore */ }

    if (initialPosition) {
      const edge = autoOrient
        ? getEdgeFromPosition(initialPosition.x, initialPosition.y, window)
        : 'bottom';
      const orientation = autoOrient ? getOrientationForEdge(edge) : 'horizontal';
      setState({ x: initialPosition.x, y: initialPosition.y, orientation, edge });
    } else {
      const el = elementRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const elW = el?.offsetWidth || 400;
      const elH = el?.offsetHeight || 50;
      setState({ x: (w - elW) / 2, y: h - elH - 120, orientation: 'horizontal', edge: 'bottom' });
    }
    setInitialized(true);
    };
    queueMicrotask(restore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveState = useCallback((next: DraggableState) => {
    try { localStorage.setItem(fullKey, JSON.stringify(next)); } catch { /* ignore */ }
  }, [fullKey]);

  useEffect(() => {
    if (!initialized) return;
    const handleResize = () => {
      const el = elementRef.current;
      if (!el) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const elW = el.offsetWidth;
      const elH = el.offsetHeight;
      setState((prev) => {
        const clampedX = Math.max(8, Math.min(prev.x, w - elW - 8));
        const clampedY = Math.max(8, Math.min(prev.y, h - elH - 8));
        let next: DraggableState = { ...prev, x: clampedX, y: clampedY };
        if (autoOrient) {
          const edge = getEdgeFromPosition(clampedX + elW / 2, clampedY + elH / 2, window);
          const orientation = getOrientationForEdge(edge);
          next = { ...next, orientation, edge };
        }
        saveState(next);
        return next;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initialized, fullKey, autoOrient, saveState]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(dragExcludeSelector)) return;
    const el = elementRef.current;
    if (!el) return;
    setIsDragging(true);
    dragMoved.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: state.x, posY: state.y };
    el.setPointerCapture(e.pointerId);
  }, [state.x, state.y, dragExcludeSelector]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      dragMoved.current = true;
    }
    if (!dragMoved.current) return;

    const el = elementRef.current;
    if (!el) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const elW = el.offsetWidth;
    const elH = el.offsetHeight;

    const newX = Math.max(8, Math.min(dragStart.current.posX + dx, w - elW - 8));
    const newY = Math.max(8, Math.min(dragStart.current.posY + dy, h - elH - 8));

    let next: DraggableState = { ...state, x: newX, y: newY };

    if (autoOrient) {
      const centerX = newX + elW / 2;
      const centerY = newY + elH / 2;
      const edge = getEdgeFromPosition(centerX, centerY, window);
      const orientation = getOrientationForEdge(edge);

      if (state.orientation !== orientation) {
        next = { ...next, orientation, edge };
        setState(next);
        saveState(next);
        requestAnimationFrame(() => {
          const el2 = elementRef.current;
          if (!el2) return;
          const newW = el2.offsetWidth;
          const newH = el2.offsetHeight;
          setState((prev) => {
            const clamped = {
              ...prev,
              x: Math.max(8, Math.min(prev.x, w - newW - 8)),
              y: Math.max(8, Math.min(prev.y, h - newH - 8)),
            };
            saveState(clamped);
            return clamped;
          });
        });
        return;
      }
      next = { ...next, orientation, edge };
    }

    setState(next);
    saveState(next);
  }, [isDragging, threshold, autoOrient, state, saveState]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const el = elementRef.current;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  }, [isDragging]);

  const dragHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  };

  const style: React.CSSProperties = {
    left: `${state.x}px`,
    top: `${state.y}px`,
    cursor: isDragging ? 'grabbing' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
  };

  return {
    elementRef,
    position: { x: state.x, y: state.y },
    orientation: state.orientation,
    edge: state.edge,
    isDragging,
    initialized,
    dragHandlers,
    style,
  };
}
