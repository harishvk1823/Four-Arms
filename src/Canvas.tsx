import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Socket } from 'socket.io-client';

type Point = { x: number; y: number };
type ToolType = 'select' | 'pen' | 'pencil' | 'marker' | 'painter' | 'rectangle' | 'circle' | 'eraser';
type DrawingObject = { 
  id: string;
  type: ToolType;
  points: Point[]; 
  color: string; 
  width: number;
  authorId?: string; // Track who made it for undo
};

export const Canvas = forwardRef(({ currentTool = 'pen', currentColor = '#0f172a', onClearTriggered, socket }: { currentTool?: ToolType, currentColor?: string, onClearTriggered?: number, socket: Socket }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  
  // App state
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isDraggingObj, setIsDraggingObj] = useState(false);
  
  const [objects, setObjects] = useState<DrawingObject[]>([]);
  const [currentObject, setCurrentObject] = useState<DrawingObject | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);

  // View state
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState<Point | null>(null);
  const [lastDragPoint, setLastDragPoint] = useState<Point | null>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    undo: () => {
      // Find the last object created by this user (or just the last object in general if simpler)
      // For now, let's just undo the very last object in the list
      setObjects(prev => {
        if (prev.length === 0) return prev;
        const lastObj = prev[prev.length - 1];
        socket?.emit('delete-object', lastObj.id);
        return prev.slice(0, -1);
      });
    },
    exportImage: () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // We want to export the ACTUAL canvas content, not just the visible part
      // But for simplicity, let's export the current visible view
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
    socket.on('init-sync', (data: { objects: DrawingObject[] }) => setObjects(data.objects || []));
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

    return () => {
      socket.off('init-sync');
      socket.off('new-object');
      socket.off('object-updated');
      socket.off('object-deleted');
      socket.off('board-cleared');
    };
  }, [socket]);

  useEffect(() => {
    if (onClearTriggered && onClearTriggered > 0) {
      console.log('Clear triggered, emitting clear-board');
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
    
    // For pen, check all points. For rect/circle, just the primary two points dictate bounds
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
    return { 
      minX: minX - padding, minY: minY - padding, 
      maxX: maxX + padding, maxY: maxY + padding 
    };
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
    let strokeWidth = obj.width / scale;
    
    if (obj.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      strokeWidth = (obj.width * 5) / scale; 
    } else {
      ctx.globalCompositeOperation = 'source-over';
      if (obj.type === 'pencil') {
        ctx.globalAlpha = 0.6;
        strokeWidth = (obj.width * 0.5) / scale;
      } else if (obj.type === 'marker') {
        ctx.globalAlpha = 0.3;
        strokeWidth = (obj.width * 3) / scale;
        ctx.lineCap = 'butt';
      } else if (obj.type === 'painter') {
        ctx.shadowBlur = 10 / scale;
        ctx.shadowColor = obj.color;
        strokeWidth = (obj.width * 4) / scale;
      } else {
        ctx.globalAlpha = 1.0;
      }
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;

    const [start, ...rest] = obj.points;
    const end = rest[rest.length - 1] || start;

    if (['pen', 'eraser', 'pencil', 'marker', 'painter'].includes(obj.type)) {
      ctx.moveTo(start.x, start.y);
      if (rest.length === 0) {
        // Handle single point
        ctx.lineTo(start.x, start.y);
      } else {
        for (const p of rest) ctx.lineTo(p.x, p.y);
      }
    } else if (obj.type === 'rectangle') {
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (obj.type === 'circle') {
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
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

    // Match size to current visible canvas size
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

    // 1. Draw cached background
    ctx.drawImage(offscreen, 0, 0);

    // 2. Draw live interactions on top
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    if (currentObject) {
      drawObject(ctx, currentObject);
    }

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

  // Redraw sync hook via rAF
  useEffect(() => {
    let rafId: number;
    rafId = requestAnimationFrame(() => {
      renderBackground();
      renderInteractive();
    });
    return () => cancelAnimationFrame(rafId);
  }, [renderBackground, renderInteractive]);

  // Resize listener
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

  // Event Handlers
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

    setSelectedObjectId(null);
    setIsDrawing(true);
    
    let defaultWidth = 3;
    if (currentTool === 'eraser') defaultWidth = 10;
    
    const newObj: DrawingObject = { 
      id: crypto.randomUUID(), 
      type: currentTool, 
      points: [pos], 
      color: currentTool === 'eraser' ? '#000000' : currentColor, 
      width: defaultWidth
    };
    
    setCurrentObject(newObj);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    updateCursorPosition(e);

    if (isPanning && lastPanPoint) {
      const dx = e.clientX - lastPanPoint.x;
      const dy = e.clientY - lastPanPoint.y;

      setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      return;
    }

    const pos = getPointerPos(e);

    if (currentTool === 'select' && isDraggingObj && selectedObjectId && lastDragPoint) {
      const dx = pos.x - lastDragPoint.x;
      const dy = pos.y - lastDragPoint.y;
      
      setObjects(prev => prev.map(obj => {
        if (obj.id !== selectedObjectId) return obj;
        const updated = {
          ...obj,
          points: obj.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
        };
        socket?.emit('update-object', updated);
        return updated;
      }));
      setLastDragPoint(pos);
      return;
    }

    if (!isDrawing || !currentObject) return;
    
    setCurrentObject(prev => {
      if (!prev) return null;
      return { ...prev, points: [...prev.points, pos] };
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    if (isPanning) {
      setIsPanning(false);
      setLastPanPoint(null);
      return;
    }

    if (isDraggingObj) {
      setIsDraggingObj(false);
      setLastDragPoint(null);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentObject) {
      setObjects(prev => [...prev, currentObject]);
      socket?.emit('draw-object', currentObject);
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
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        let newScale = scale * Math.exp(delta);
        newScale = Math.max(0.1, Math.min(newScale, 10));

        const rect = canvas.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        setOffset(prev => ({
          x: cursorX - (cursorX - prev.x) * (newScale / scale),
          y: cursorY - (cursorY - prev.y) * (newScale / scale),
        }));
        setScale(newScale);
      } else {
        setOffset(prev => ({
          x: prev.x - e.deltaX,
          y: prev.y - e.deltaY,
        }));
      }
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [scale, offset, currentTool, isPanning]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        // Undo
        setObjects(prev => {
          if (prev.length === 0) return prev;
          const lastObj = prev[prev.length - 1];
          socket?.emit('delete-object', lastObj.id);
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
    let base = 3;
    if (currentTool === 'eraser') base = 10 * 5;
    else if (currentTool === 'pencil') base = 3 * 0.5;
    else if (currentTool === 'marker') base = 3 * 3;
    else if (currentTool === 'painter') base = 3 * 4;
    return Math.max(4, base); 
  };
  
  const cursorSize = getCursorSize();

  return (
    <>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`absolute top-0 left-0 w-full h-full touch-none z-10 ${
          isPanning ? 'cursor-grabbing' : 
          currentTool === 'select' ? 'cursor-default' : 'cursor-none'
        }`}
        style={{ touchAction: 'none' }}
      />
      
      {showCustomCursor && (
        <div 
          ref={cursorRef}
          className="fixed top-0 left-0 pointer-events-none z-50 rounded-full border border-black/10 mix-blend-multiply opacity-80"
          style={{
            width: `${cursorSize}px`,
            height: `${cursorSize}px`,
            backgroundColor: currentTool === 'eraser' ? 'transparent' : currentColor,
            boxShadow: currentTool === 'eraser' ? 'inset 0 0 0 2px rgba(0,0,0,0.4)' : 'none',
          }}
        />
      )}
    </>
  );
});
