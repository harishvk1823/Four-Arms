import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Socket } from 'socket.io-client';

type Point = { x: number; y: number };
type ToolType = 'select' | 'pen' | 'pencil' | 'marker' | 'painter' | 'rectangle' | 'circle' | 'eraser' | 'text';
type DrawingObject = { 
  id: string;
  type: ToolType;
  points: Point[]; 
  color: string; 
  width: number;
  authorId?: string; // Track who made it for undo
  text?: string; // For text tool
};

type RemoteCursor = {
  id: string;
  name: string;
  x: number;
  y: number;
  lastUpdate: number;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback if randomUUID fails for some reason
    }
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

export const Canvas = forwardRef(({ 
  userName, 
  currentTool = 'pen', 
  currentColor = '#0f172a', 
  strokeWidth = 3, 
  onClearTriggered, 
  socket,
  objects,
  setObjects
}: { 
  userName: string, 
  currentTool?: ToolType, 
  currentColor?: string, 
  strokeWidth?: number, 
  onClearTriggered?: number, 
  socket: Socket,
  objects: DrawingObject[],
  setObjects: React.Dispatch<React.SetStateAction<DrawingObject[]>>
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  // App state
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingObj, setIsDraggingObj] = useState(false);
  
  const [, setRedoStack] = useState<DrawingObject[]>([]);
  const [currentObject, setCurrentObject] = useState<DrawingObject | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});

  // View state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const [lastDragPoint, setLastDragPoint] = useState<Point | null>(null);

  // Refs for high-frequency updates to avoid stale state and excessive re-renders
  const drawingStateRef = useRef({
    isDrawing: false,
    isPanning: false,
    isDraggingObj: false,
    currentObject: null as DrawingObject | null,
    lastPanPoint: null as Point | null,
    lastDragPoint: null as Point | null,
    lastEmitTime: 0,
    lastCursorEmitTime: 0
  });

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    undo: () => {
      setObjects(prev => {
        if (prev.length === 0) return prev;
        const lastObj = prev[prev.length - 1];
        setRedoStack(redo => [...redo, lastObj]);
        socket?.emit('delete-object', lastObj.id);
        return prev.slice(0, -1);
      });
    },
    redo: () => {
      setRedoStack(prev => {
        if (prev.length === 0) return prev;
        const nextObj = prev[prev.length - 1];
        setObjects(objs => [...objs, nextObj]);
        socket?.emit('draw-object', nextObj);
        return prev.slice(0, -1);
      });
    },
    exportImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `four-arms-export-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }));

  // Initialize offscreen canvas
  useEffect(() => {
    if (!offscreenCanvasRef.current && typeof document !== 'undefined') {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Use the Socket.io connection passed from App
  useEffect(() => {
    if (!socket) return;
    socket.on('new-object', (obj: DrawingObject) => setObjects(prev => [...prev, obj]));
    socket.on('object-updated', (updatedObj: DrawingObject) => setObjects(prev => prev.map(o => o.id === updatedObj.id ? updatedObj : o)));
    socket.on('object-deleted', (objId: string) => {
      setObjects(prev => prev.filter(o => o.id !== objId));
      setSelectedObjectId(prev => prev === objId ? null : prev);
    });
    socket.on('board-cleared', () => {
      setObjects([]);
      setSelectedObjectId(null);
    });

    socket.on('cursor-updated', (data: RemoteCursor) => {
      setRemoteCursors(prev => ({
        ...prev,
        [data.id]: { ...data, lastUpdate: Date.now() }
      }));
    });

    socket.on('users-updated', (users: { id: string, name: string }[]) => {
      // Clean up cursors for disconnected users
      const userIds = new Set(users.map(u => u.id));
      setRemoteCursors(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => {
          if (!userIds.has(id)) delete next[id];
        });
        return next;
      });
    });

    return () => {
      socket.off('new-object');
      socket.off('object-updated');
      socket.off('object-deleted');
      socket.off('board-cleared');
      socket.off('cursor-updated');
      socket.off('users-updated');
    };
  }, [socket, setObjects]);

  // Clean up stale cursors (30s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemoteCursors(prev => {
        const next = { ...prev };
        let changed = false;
        Object.keys(next).forEach(id => {
          if (now - next[id].lastUpdate > 30000) {
            delete next[id];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (onClearTriggered && onClearTriggered > 0) {
      if (socket) {
        socket.emit('clear-board');
      } else {
        setObjects([]);
        setSelectedObjectId(null);
      }
    }
  }, [onClearTriggered, socket]);

  const getObjectBounds = (obj: DrawingObject) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const pts = obj.type === 'pen' || obj.type === 'eraser' || obj.type === 'pencil' || obj.type === 'marker' || obj.type === 'painter' ? obj.points : [obj.points[0], obj.points[obj.points.length - 1]];
    for (const p of pts) {
      if (!p) continue;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (obj.type === 'circle') {
      const start = obj.points[0];
      const end = obj.points[obj.points.length - 1];
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      return { minX: start.x - radius, minY: start.y - radius, maxX: start.x + radius, maxY: start.y + radius };
    }
    const padding = Math.max(obj.width * 2, 5);
    return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
  };

  const isPointInBounds = (p: Point, bounds: {minX: number, minY: number, maxX: number, maxY: number}) => {
    return p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY;
  };

  const drawObject = (ctx: CanvasRenderingContext2D, obj: DrawingObject) => {
    if (obj.points.length < 1) return;
    ctx.save();
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    let strokeColor = obj.color;
    let sw = obj.width / scale;
    if (obj.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      sw = (obj.width * 5) / scale; 
    } else {
      ctx.globalCompositeOperation = 'source-over';
      if (obj.type === 'pencil') {
        ctx.globalAlpha = 0.6;
        sw = (obj.width * 0.5) / scale;
      } else if (obj.type === 'marker') {
        ctx.globalAlpha = 0.3;
        sw = (obj.width * 3) / scale;
        ctx.lineCap = 'butt';
      } else if (obj.type === 'painter') {
        ctx.shadowBlur = 10 / scale;
        ctx.shadowColor = obj.color;
        sw = (obj.width * 4) / scale;
      } else {
        ctx.globalAlpha = 1.0;
      }
    }
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = sw;
    const [start, ...rest] = obj.points;
    const end = rest[rest.length - 1] || start;
    if (['pen', 'eraser', 'pencil', 'marker', 'painter'].includes(obj.type)) {
      ctx.moveTo(start.x, start.y);
      if (rest.length === 0) ctx.lineTo(start.x, start.y);
      else for (const p of rest) ctx.lineTo(p.x, p.y);
    } else if (obj.type === 'rectangle') {
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (obj.type === 'circle') {
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
    } else if (obj.type === 'text' && obj.text) {
      ctx.font = `bold ${obj.width * 5}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text, start.x, start.y);
      ctx.restore();
      return;
    }
    ctx.stroke();
    ctx.restore();
  };

  // Background Cache Rendering (Offscreen)
  const renderBackground = useCallback(() => {
    const offscreen = offscreenCanvasRef.current;
    const canvas = canvasRef.current;
    if (!offscreen || !canvas) return;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    objects.forEach(obj => drawObject(ctx, obj));
    ctx.restore();
  }, [objects, scale, offset]);

  // Foreground (Live) Rendering
  const renderInteractive = useCallback(() => {
    const canvas = canvasRef.current;
    const offscreen = offscreenCanvasRef.current;
    if (!canvas || !offscreen) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreen, 0, 0);
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);
    if (currentObject) drawObject(ctx, currentObject);
    if (selectedObjectId) {
      const selObj = objects.find(o => o.id === selectedObjectId);
      if (selObj && selObj.type !== 'eraser') {
        const bounds = getObjectBounds(selObj);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1 / scale;
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }, [currentObject, selectedObjectId, objects, scale, offset]);

  useEffect(() => {
    let rafId: number;
    rafId = requestAnimationFrame(() => {
      renderBackground();
      renderInteractive();
    });
    return () => cancelAnimationFrame(rafId);
  }, [renderBackground, renderInteractive]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      renderBackground();
      renderInteractive();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [renderBackground, renderInteractive]);

  const getPointerPos = (e: React.PointerEvent | WheelEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left - offset.x) / scale,
      y: (e.clientY - rect.top - offset.y) / scale,
    };
  };

  const updateCursorPosition = (e: React.PointerEvent | WheelEvent) => {
    if (cursorRef.current && currentTool !== 'select' && !isPanning) {
      cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateCursorPosition(e);
    if (e.button === 1 || e.buttons === 4 || e.altKey) {
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }
    const pos = getPointerPos(e);
    if (currentTool === 'select') {
      const hitObject = [...objects].reverse().find(obj => isPointInBounds(pos, getObjectBounds(obj)));
      if (hitObject) {
        setSelectedObjectId(hitObject.id);
        setIsDraggingObj(true);
        setLastDragPoint(pos);
      } else {
        setSelectedObjectId(null);
      }
      return;
    }
    if (currentTool === 'text') {
      const text = window.prompt('Enter text:');
      if (text) {
        const newObj: DrawingObject = {
          id: generateId(),
          type: 'text',
          points: [pos],
          color: currentColor,
          width: strokeWidth,
          text: text
        };
        setObjects(prev => [...prev, newObj]);
        socket?.emit('draw-object', newObj);
      }
      return;
    }
    setSelectedObjectId(null);
    setRedoStack([]); // Clear redo stack on new action
    
    const newObj: DrawingObject = { 
      id: generateId(), 
      type: currentTool, 
      points: [pos], 
      color: currentTool === 'eraser' ? '#000000' : currentColor, 
      width: currentTool === 'eraser' ? 10 : strokeWidth
    };
    
    drawingStateRef.current.isDrawing = true;
    drawingStateRef.current.currentObject = newObj;
    setCurrentObject(newObj);
    socket?.emit('draw-object', newObj);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    updateCursorPosition(e);
    const state = drawingStateRef.current;

    if (isPanning && lastPanPoint) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;
      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }
    
    const pos = getPointerPos(e);
    
    // Throttled cursor broadcast (approx 30fps)
    const now = Date.now();
    if (now - state.lastCursorEmitTime > 32) {
      socket?.emit('cursor-move', { name: userName, x: e.clientX, y: e.clientY });
      state.lastCursorEmitTime = now;
    }

    if (currentTool === 'select' && isDraggingObj && selectedObjectId && lastDragPoint) {
      const dx = pos.x - lastDragPoint.x;
      const dy = pos.y - lastDragPoint.y;
      
      setObjects(prev => prev.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        const updated = { ...obj, points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
        
        // Throttled object update (approx 20fps)
        if (now - state.lastEmitTime > 50) {
          socket?.emit('update-object', updated);
          state.lastEmitTime = now;
        }
        return updated;
      }));
      setLastDragPoint(pos);
      return;
    }

    if (!state.isDrawing || !state.currentObject) return;
    
    const updated = { 
      ...state.currentObject, 
      points: [...state.currentObject.points, pos] 
    };
    
    state.currentObject = updated;
    setCurrentObject(updated);

    // Throttled drawing update (approx 20fps)
    if (now - state.lastEmitTime > 50) {
      socket?.emit('update-object', updated);
      state.lastEmitTime = now;
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const state = drawingStateRef.current;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (isPanning) { 
      setIsPanning(false); 
      setLastPanPoint(null); 
      return; 
    }
    
    if (isDraggingObj) { 
      setIsDraggingObj(false); 
      setLastDragPoint(null); 
      if (selectedObjectId) {
        const obj = objects.find(o => o.id === selectedObjectId);
        if (obj) socket?.emit('update-object', obj);
      }
      return; 
    }
    
    if (!state.isDrawing) return;
    
    const finalObj = state.currentObject;
    state.isDrawing = false;
    state.currentObject = null;
    
    if (finalObj) {
      setObjects(prev => [...prev, finalObj]);
      // Final update for the object to ensure everyone has the complete points
      socket?.emit('update-object', finalObj);
      setCurrentObject(null);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      updateCursorPosition(e);
      if (e.ctrlKey || e.metaKey) {
        const delta = -e.deltaY * 0.001;
        let ns = scale * Math.exp(delta);
        ns = Math.max(0.1, Math.min(ns, 10));
        const rect = canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        setOffset(prev => ({ x: cx - (cx - prev.x) * (ns / scale), y: cy - (cy - prev.y) * (ns / scale) }));
        setScale(ns);
      } else {
        setOffset(prev => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
      }
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [scale, offset, currentTool, isPanning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo (Ctrl+Shift+Z)
          setRedoStack(prev => {
            if (prev.length === 0) return prev;
            const nextObj = prev[prev.length - 1];
            setObjects(objs => [...objs, nextObj]);
            socket?.emit('draw-object', nextObj);
            return prev.slice(0, -1);
          });
        } else {
          // Undo (Ctrl+Z)
          setObjects(prev => {
            if (prev.length === 0) return prev;
            const lastObj = prev[prev.length - 1];
            setRedoStack(redo => [...redo, lastObj]);
            socket?.emit('delete-object', lastObj.id);
            return prev.slice(0, -1);
          });
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        // Redo (Ctrl+Y)
        setRedoStack(prev => {
          if (prev.length === 0) return prev;
          const nextObj = prev[prev.length - 1];
          setObjects(objs => [...objs, nextObj]);
          socket?.emit('draw-object', nextObj);
          return prev.slice(0, -1);
        });
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedObjectId) {
          setObjects(prev => prev.filter(obj => obj.id !== selectedObjectId));
          socket?.emit('delete-object', selectedObjectId);
          setSelectedObjectId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId]);

  const showCustomCursor = currentTool !== 'select' && !isPanning;
  const getCursorSize = () => {
    let b = currentTool === 'eraser' ? 50 : strokeWidth;
    if (currentTool === 'pencil') b *= 0.5;
    if (currentTool === 'marker') b *= 3;
    if (currentTool === 'painter') b *= 4;
    return Math.max(4, b); 
  };
  const cursorSize = getCursorSize();

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute top-0 left-0 w-full h-full touch-none z-10 ${isPanning ? 'cursor-grabbing' : currentTool === 'select' ? 'cursor-default' : 'cursor-none'}`}
        style={{ touchAction: 'none' }}
      />
      
      {showCustomCursor && (
        <div ref={cursorRef} className="fixed top-0 left-0 pointer-events-none z-50 rounded-full border border-black/10 mix-blend-multiply opacity-80"
          style={{ width: `${cursorSize}px`, height: `${cursorSize}px`, backgroundColor: currentTool === 'eraser' ? 'transparent' : currentColor, boxShadow: currentTool === 'eraser' ? 'inset 0 0 0 2px rgba(0,0,0,0.4)' : 'none' }}
        />
      )}

      {/* Remote Cursors */}
      {Object.values(remoteCursors).map(cur => (
        <div key={cur.id} className="fixed top-0 left-0 pointer-events-none z-[45] transition-transform duration-75"
             style={{ transform: `translate(${cur.x}px, ${cur.y}px)` }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-indigo-500 drop-shadow-md">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" fill="currentColor" />
            <path d="M13 13l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className="absolute top-4 left-4 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            {cur.name}
          </div>
        </div>
      ))}

      {/* Connection Status Indicator (Subtle) */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 px-3 py-1.5 bg-white/50 backdrop-blur-md rounded-full border border-white/20 shadow-sm pointer-events-none select-none z-10 transition-all opacity-60 hover:opacity-100">
        <div className={`w-2 h-2 rounded-full ${socket?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
          {socket?.connected ? 'Live Sync' : 'Offline'}
        </span>
      </div>
    </div>
  );
});
