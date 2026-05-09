'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { convexHull, Point2D, getBoundingBox, calculatePerimeter } from '@/lib/geometry';
import { CONTACT_DISTANCE, TOLERANCE } from '@/lib/parser';

export function WorkspaceCanvas() {
  const workspace = useAppStore(state => state.activeWorkspace);
  const theme = useAppStore(state => state.theme);
  const updateWorkspaceCenters = useAppStore(state => state.updateWorkspaceCenters);
  const pinnedDisks = useAppStore(state => state.pinnedDisks);
  
  const isRolling = useAppStore(state => state.isRolling);
  const rollTrigger = useAppStore(state => state.rollTrigger);
  const setIsRolling = useAppStore(state => state.setIsRolling);

  const togglePin = useAppStore(state => state.togglePin);
  const pushPerimeterHistory = useAppStore(state => state.pushPerimeterHistory);
  
  const showGrid = useAppStore(state => state.showGrid);
  const toggleGrid = useAppStore(state => state.toggleGrid);
  
  const restoreOriginalWorkspace = useAppStore(state => state.restoreOriginalWorkspace);
  
  const selectedDisks = useAppStore(state => state.selectedDisks);
  const toggleSelectDisk = useAppStore(state => state.toggleSelectDisk);
  const clearSelectedDisks = useAppStore(state => state.clearSelectedDisks);
  const snapshotDisk = useAppStore(state => state.snapshotDisk);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [scale, setScale] = useState(50);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  const isPanningRef = useRef(false);
  const draggedDiskRef = useRef<number | null>(null);
  const hasDraggedRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const isInitialFitRef = useRef(true);


  const fitToView = useCallback(() => {
    if (!workspace || !canvasRef.current) return;
    const { minX, minY, maxX, maxY } = getBoundingBox(workspace.centers as Point2D[]);
    
    const pMinX = minX - 2;
    const pMinY = minY - 2;
    const pMaxX = maxX + 2;
    const pMaxY = maxY + 2;
    
    const w = pMaxX - pMinX;
    const h = pMaxY - pMinY;
    
    const canvasW = canvasRef.current.width;
    const canvasH = canvasRef.current.height;
    
    if (w <= 0 || h <= 0) return;
    
    const newScale = Math.min(canvasW / w, canvasH / h);
    setScale(newScale);
    setOffset({
      x: pMinX + w / 2,
      y: pMinY + h / 2
    });
  }, [workspace]);

  useEffect(() => {
    isInitialFitRef.current = true;
    fitToView();
  }, [workspace?.id, fitToView]);

  const performRollStep = useCallback((deltaTimeMs: number = 16.6) => {
    const state = useAppStore.getState();
    const currentWorkspace = state.activeWorkspace;
    const rules = state.rollingRules;
    const isRollingState = state.isRolling;
    
    if (!currentWorkspace || rules.length === 0) return;
    
    const centers = [...currentWorkspace.centers] as Point2D[];
    let anyCollision = false;

    for (const rule of rules) {
      if (!rule.isActive) continue;

      const rIdx = rule.rollingDiskIdx;
      const pIdx = rule.pivotDiskIdx;
      
      if (rIdx === null || pIdx === null || rIdx === pIdx) continue;

      const pivot = centers[pIdx];
      const roll = centers[rIdx];
      
      const currentAngle = Math.atan2(roll[1] - pivot[1], roll[0] - pivot[0]);
      const angleStep = rule.speed * rule.direction * (deltaTimeMs / 1000.0);
      const nextAngle = currentAngle + angleStep;
      
      const targetPos: Point2D = [
        pivot[0] + CONTACT_DISTANCE * Math.cos(nextAngle),
        pivot[1] + CONTACT_DISTANCE * Math.sin(nextAngle)
      ];
      
      let collisionOccurred = false;
      for (let i = 0; i < centers.length; i++) {
        if (i === rIdx || i === pIdx) continue;
        
        const dx = targetPos[0] - centers[i][0];
        const dy = targetPos[1] - centers[i][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        
        const currentDx = roll[0] - centers[i][0];
        const currentDy = roll[1] - centers[i][1];
        const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
        
        if (d < CONTACT_DISTANCE - TOLERANCE && d < currentDist) {
          collisionOccurred = true;
          break;
        }
      }
      
      if (collisionOccurred) {
         anyCollision = true;
         break;
      }
      
      centers[rIdx] = targetPos;
    }
    
    if (anyCollision) {
       if (isRollingState) state.setIsRolling(false);
       state.updateWorkspaceCenters(centers);
       return; 
    }
    
    state.updateWorkspaceCenters(centers);
    const hull = convexHull(centers);
    state.pushPerimeterHistory(calculatePerimeter(hull));
    
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime: number | null = null;
    
    const loop = (time: number) => {
      if (isRolling) {
        if (lastTime !== null) {
          const deltaTimeMs = time - lastTime;
          performRollStep(Math.min(deltaTimeMs, 50)); 
        }
        lastTime = time;
        animationFrameId = requestAnimationFrame(loop);
      }
    };
    
    if (isRolling) {
      lastTime = performance.now();
      animationFrameId = requestAnimationFrame(loop);
    }
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isRolling, performRollStep]);

  useEffect(() => {
    if (rollTrigger > 0) {
      performRollStep(16.6);
    }
  }, [rollTrigger]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !workspace) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cw = canvas.width;
    const ch = canvas.height;

    ctx.fillStyle = theme === 'light' ? '#f4f4f5' : '#09090b';
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.translate(cw / 2, ch / 2);
    ctx.scale(scale, -scale);
    ctx.translate(-offset.x, -offset.y);

    if (showGrid) {
      const left = offset.x - (cw / 2) / scale;
      const right = offset.x + (cw / 2) / scale;
      const bottom = offset.y - (ch / 2) / scale;
      const top = offset.y + (ch / 2) / scale;

      ctx.lineWidth = 1 / scale;
      ctx.strokeStyle = theme === 'light' ? '#e4e4e7' : '#18181b';
      ctx.beginPath();
      
      const startX = Math.floor(left);
      const endX = Math.ceil(right);
      for (let x = startX; x <= endX; x++) {
        ctx.moveTo(x, bottom);
        ctx.lineTo(x, top);
      }
      
      const startY = Math.floor(bottom);
      const endY = Math.ceil(top);
      for (let y = startY; y <= endY; y++) {
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
      }
      ctx.stroke();

      ctx.lineWidth = 2 / scale;
      ctx.strokeStyle = theme === 'light' ? '#d4d4d8' : '#27272a';
      ctx.beginPath();
      ctx.moveTo(0, bottom);
      ctx.lineTo(0, top);
      ctx.moveTo(left, 0);
      ctx.lineTo(right, 0);
      ctx.stroke();
    }

    const centers = workspace.centers as Point2D[];
    const contacts = workspace.contacts;
    const hull = convexHull(centers);

    if (hull.length > 0) {
      ctx.beginPath();
      if (hull.length === 1) {
        ctx.arc(hull[0][0], hull[0][1], 1.0, 0, Math.PI * 2);
      } else if (hull.length === 2) {
        const p1 = hull[0];
        const p2 = hull[1];
        const dx = p2[0] - p1[0];
        const dy = p2[1] - p1[1];
        const l = Math.sqrt(dx*dx + dy*dy);
        const nx = dy / l;
        const ny = -dx / l;
        
        ctx.arc(p1[0], p1[1], 1.0, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
        ctx.arc(p2[0], p2[1], 1.0, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
      } else {
        for (let i = 0; i < hull.length; i++) {
          const p0 = hull[(i - 1 + hull.length) % hull.length];
          const p1 = hull[i];
          const p2 = hull[(i + 1) % hull.length];
          
          const dx1 = p2[0] - p1[0];
          const dy1 = p2[1] - p1[1];
          const l1 = Math.sqrt(dx1*dx1 + dy1*dy1);
          const nx1 = dy1 / l1;
          const ny1 = -dx1 / l1;
          
          const dx0 = p1[0] - p0[0];
          const dy0 = p1[1] - p0[1];
          const l0 = Math.sqrt(dx0*dx0 + dy0*dy0);
          const nx0 = dy0 / l0;
          const ny0 = -dx0 / l0;
          
          const startAngle = Math.atan2(ny0, nx0);
          let endAngle = Math.atan2(ny1, nx1);
          
          if (endAngle < startAngle) {
            endAngle += Math.PI * 2;
          }
          
          ctx.arc(p1[0], p1[1], 1.0, startAngle, endAngle, false);
        }
      }
      ctx.closePath();
      
      ctx.lineWidth = 3 / scale;
      ctx.strokeStyle = theme === 'light' ? '#52525b' : '#a1a1aa';
      ctx.shadowColor = theme === 'light' ? '#71717a' : '#a1a1aa';
      ctx.shadowBlur = theme === 'light' ? 3 / scale : 5 / scale;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const edgeColors = [
      '#06b6d4',
      '#f97316',
      '#22c55e',
      '#ef4444',
      '#a855f7',
      '#b45309',
      '#3b82f6',
      '#ec4899',
      '#14b8a6',
      '#eab308'
    ];
    
    ctx.lineWidth = 2.5 / scale;
    contacts.forEach(([u, v], i) => {
      ctx.beginPath();
      ctx.strokeStyle = edgeColors[i % edgeColors.length];
      const p1 = centers[u];
      const p2 = centers[v];
      if (p1 && p2) {
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      }
      ctx.stroke();
    });

    const activeRules = useAppStore.getState().rollingRules.filter(r => r.isActive);
    const pivotSet = new Set(activeRules.map(r => r.pivotDiskIdx));
    const rollingSet = new Set(activeRules.map(r => r.rollingDiskIdx));

    centers.forEach(([x, y], idx) => {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, 2 * Math.PI);
      
      const isPivot = pivotSet.has(idx);
      const isRolling = rollingSet.has(idx);
      const isPinned = pinnedDisks.has(idx);
      
      const isSelected = selectedDisks.has(idx);
      
      if (isRolling) ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
      else if (isPivot) ctx.fillStyle = 'rgba(217, 70, 239, 0.15)';
      else if (isSelected) ctx.fillStyle = theme === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)';
      else ctx.fillStyle = theme === 'light' ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
      
      ctx.lineWidth = 2 / scale;
      
      if (isPinned) {
        ctx.strokeStyle = '#ef4444';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8 / scale;
        ctx.stroke();
        
        ctx.beginPath();
        const r = 0.5;
        ctx.moveTo(x - r, y - r);
        ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r);
        ctx.lineTo(x - r, y + r);
        ctx.stroke();
      } else if (isRolling) {
        ctx.strokeStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 10 / scale;
        ctx.stroke();
      } else if (isPivot) {
        ctx.strokeStyle = '#d946ef';
        ctx.shadowColor = '#d946ef';
        ctx.shadowBlur = 10 / scale;
        ctx.stroke();
      } else if (isSelected) {
        ctx.strokeStyle = theme === 'light' ? '#18181b' : '#f4f4f5';
        ctx.shadowColor = theme === 'light' ? '#94a3b8' : '#ffffff';
        ctx.shadowBlur = 8 / scale;
        ctx.stroke();
      } else {
        ctx.strokeStyle = theme === 'light' ? '#71717a' : '#a1a1aa';
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    });

    ctx.restore();

    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    centers.forEach(([x, y], idx) => {
      const sx = cw / 2 + (x - offset.x) * scale;
      const sy = ch / 2 - (y - offset.y) * scale;
      
      const text = idx.toString();
      const metrics = ctx.measureText(text);
      const bgWidth = metrics.width + 10;
      const bgHeight = 18;
      
      ctx.fillStyle = theme === 'light' ? 'rgba(255, 255, 255, 0.92)' : 'rgba(9, 9, 11, 0.85)';
      ctx.beginPath();
      ctx.roundRect(sx - bgWidth/2, sy - bgHeight/2, bgWidth, bgHeight, 6);
      ctx.fill();
      ctx.strokeStyle = theme === 'light' ? '#d4d4d8' : '#3f3f46';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      const isPivot = pivotSet.has(idx);
      const isRolling = rollingSet.has(idx);
      const isPinned = pinnedDisks.has(idx);
      
      if (isPinned) ctx.fillStyle = '#ef4444';
      else if (isRolling) ctx.fillStyle = theme === 'light' ? '#0891b2' : '#22d3ee';
      else if (isPivot) ctx.fillStyle = theme === 'light' ? '#c026d3' : '#e879f9';
      else ctx.fillStyle = theme === 'light' ? '#3f3f46' : '#94a3b8';
      
      ctx.fillText(text, sx, sy);
    });

  }, [workspace, scale, offset, pinnedDisks, showGrid, selectedDisks, theme]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        if (isInitialFitRef.current) {
          fitToView();
          isInitialFitRef.current = false;
        } else {
          render();
        }
      }
    };
    
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [render, fitToView]);

  const screenToWorld = (clientX: number, clientY: number): Point2D => {
    if (!canvasRef.current) return [0, 0];
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cw = rect.width;
    const ch = rect.height;
    
    const wx = offset.x + (sx - cw / 2) / scale;
    const wy = offset.y - (sy - ch / 2) / scale;
    return [wx, wy];
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.max(5, Math.min(500, scale * Math.exp(delta)));
    setScale(newScale);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!workspace) return;
    if (canvasRef.current) canvasRef.current.setPointerCapture(e.pointerId);

    const [wx, wy] = screenToWorld(e.clientX, e.clientY);
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;

    const centers = workspace.centers as Point2D[];
    let clickedIdx: number | null = null;
    for (let i = centers.length - 1; i >= 0; i--) {
      const dx = centers[i][0] - wx;
      const dy = centers[i][1] - wy;
      if (Math.sqrt(dx * dx + dy * dy) <= 1.0) {
        clickedIdx = i;
        break;
      }
    }

    if (e.button === 2) {
      if (clickedIdx !== null) {
        togglePin(clickedIdx);
      }
      return;
    }

    if (clickedIdx !== null) {
      if (e.button === 0) {
        toggleSelectDisk(clickedIdx, e.shiftKey);
        if (!pinnedDisks.has(clickedIdx) && !e.shiftKey) {
          snapshotDisk(clickedIdx);
          draggedDiskRef.current = clickedIdx;
        }
      }
    } else if (e.button === 0) {
      if (!e.shiftKey) {
        clearSelectedDisks();
      }
    } else if (e.button === 1 || (e.shiftKey && e.button === 0)) {
      isPanningRef.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      
      setOffset(prev => ({
        x: prev.x - dx / scale,
        y: prev.y + dy / scale
      }));
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else if (draggedDiskRef.current !== null && workspace) {
      hasDraggedRef.current = true;
      const targetPos = screenToWorld(e.clientX, e.clientY);
      const draggedIdx = draggedDiskRef.current;
      const centers = workspace.centers as Point2D[];
      const oldPos = centers[draggedIdx];
      
      const dxTotal = targetPos[0] - oldPos[0];
      const dyTotal = targetPos[1] - oldPos[1];
      const totalDist = Math.sqrt(dxTotal * dxTotal + dyTotal * dyTotal);
      
      const steps = Math.max(1, Math.ceil(totalDist / 0.5));
      const stepDx = dxTotal / steps;
      const stepDy = dyTotal / steps;
      
      let currentPos = [...oldPos] as Point2D;
      
      for (let s = 0; s < steps; s++) {
        currentPos[0] += stepDx;
        currentPos[1] += stepDy;
        
        for (let iter = 0; iter < 10; iter++) {
          let maxOverlap = 0;
          for (let i = 0; i < centers.length; i++) {
            if (i === draggedIdx) continue;
            
            const dx = currentPos[0] - centers[i][0];
            const dy = currentPos[1] - centers[i][1];
            const d = Math.sqrt(dx * dx + dy * dy);
            
            if (d < CONTACT_DISTANCE && d > 0) {
              const overlap = CONTACT_DISTANCE - d;
              maxOverlap = Math.max(maxOverlap, overlap);
              currentPos[0] += (dx / d) * overlap;
              currentPos[1] += (dy / d) * overlap;
            }
          }
          if (maxOverlap < TOLERANCE) break;
        }
      }
      
      const SNAP_THRESHOLD = 0.075;
      
      const nearbyDisks: { idx: number, dist: number }[] = [];
      for (let i = 0; i < centers.length; i++) {
        if (i === draggedIdx) continue;
        const dx = currentPos[0] - centers[i][0];
        const dy = currentPos[1] - centers[i][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > CONTACT_DISTANCE && d < CONTACT_DISTANCE + SNAP_THRESHOLD) {
          nearbyDisks.push({ idx: i, dist: d });
        }
      }
      
      nearbyDisks.sort((a, b) => a.dist - b.dist);
      
      let snapped = false;

      if (nearbyDisks.length >= 2) {
        const c1 = centers[nearbyDisks[0].idx];
        const c2 = centers[nearbyDisks[1].idx];
        
        const cdx = c2[0] - c1[0];
        const cdy = c2[1] - c1[1];
        const distBetweenCenters = Math.sqrt(cdx * cdx + cdy * cdy);
        
        if (distBetweenCenters > 0 && distBetweenCenters <= CONTACT_DISTANCE * 2) {
          const mx = c1[0] + cdx / 2;
          const my = c1[1] + cdy / 2;
          const h = Math.sqrt(Math.pow(CONTACT_DISTANCE, 2) - (distBetweenCenters * distBetweenCenters) / 4);
          
          const nx = -cdy / distBetweenCenters;
          const ny = cdx / distBetweenCenters;
          
          const i1 = [mx + h * nx, my + h * ny];
          const i2 = [mx - h * nx, my - h * ny];
          
          const d1 = Math.sqrt(Math.pow(currentPos[0] - i1[0], 2) + Math.pow(currentPos[1] - i1[1], 2));
          const d2 = Math.sqrt(Math.pow(currentPos[0] - i2[0], 2) + Math.pow(currentPos[1] - i2[1], 2));
          
          const bestSnap = d1 < d2 ? i1 : i2;
          
          let causesIntersection = false;
          for (let i = 0; i < centers.length; i++) {
            if (i === draggedIdx) continue;
            const odx = bestSnap[0] - centers[i][0];
            const ody = bestSnap[1] - centers[i][1];
            if (Math.sqrt(odx * odx + ody * ody) < CONTACT_DISTANCE - TOLERANCE) {
              causesIntersection = true;
              break;
            }
          }
          
          if (!causesIntersection) {
            currentPos[0] = bestSnap[0];
            currentPos[1] = bestSnap[1];
            snapped = true;
          }
        }
      }
      
      if (!snapped && nearbyDisks.length >= 1) {
        const closest = nearbyDisks[0];
        const c1 = centers[closest.idx];
        
        const dx = currentPos[0] - c1[0];
        const dy = currentPos[1] - c1[1];
        const pullDist = closest.dist - CONTACT_DISTANCE;
        
        const snapX = currentPos[0] - (dx / closest.dist) * pullDist;
        const snapY = currentPos[1] - (dy / closest.dist) * pullDist;
        
        let causesIntersection = false;
        for (let i = 0; i < centers.length; i++) {
          if (i === draggedIdx || i === closest.idx) continue;
          const odx = snapX - centers[i][0];
          const ody = snapY - centers[i][1];
          if (Math.sqrt(odx * odx + ody * ody) < CONTACT_DISTANCE - TOLERANCE) {
            causesIntersection = true;
            break;
          }
        }
        
        if (!causesIntersection) {
          currentPos[0] = snapX;
          currentPos[1] = snapY;
        }
      }
      
      const newCenters = [...centers];
      newCenters[draggedIdx] = currentPos;
      
      updateWorkspaceCenters(newCenters);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isPanningRef.current = false;
    
    if (draggedDiskRef.current !== null && workspace && hasDraggedRef.current) {
      const hull = convexHull(workspace.centers as Point2D[]);
      const p = calculatePerimeter(hull);
      pushPerimeterHistory(p);
    }
    
    draggedDiskRef.current = null;
    hasDraggedRef.current = false;
    if (canvasRef.current) canvasRef.current.releasePointerCapture(e.pointerId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      
      if (e.key === 'f' || e.key === 'F') {
        fitToView();
      }
      if (e.key === 'g' || e.key === 'G') {
        toggleGrid();
      }
      if (e.key === 'r' || e.key === 'R') {
        restoreOriginalWorkspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitToView, toggleGrid, restoreOriginalWorkspace]);

  return (
    <div ref={containerRef} className={`absolute inset-0 select-none transition-colors duration-200 ${
      theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-950'
    }`}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={handleContextMenu}
        className="block cursor-crosshair active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      />
      <div className="absolute top-4 left-4 flex gap-2">
        <button 
          onClick={fitToView}
          className={`backdrop-blur text-xs px-2 py-1 rounded border shadow-sm transition-all duration-200 cursor-pointer font-medium ${
            theme === 'light'
              ? 'bg-white/90 text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm'
              : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
          }`}
          title="Fit to view (F)"
        >
          Fit View (F)
        </button>
        <button 
          onClick={toggleGrid}
          className={`backdrop-blur text-xs px-2 py-1 rounded border shadow-sm transition-all duration-200 cursor-pointer font-medium ${
            showGrid 
              ? (theme === 'light' ? 'bg-zinc-200/90 text-zinc-800 border-zinc-300 font-semibold shadow-inner' : 'bg-zinc-800/90 text-zinc-200 border-zinc-600 hover:bg-zinc-700') 
              : (theme === 'light' ? 'bg-white/80 text-zinc-400 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-600' : 'bg-zinc-900/80 text-zinc-500 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-300')
          }`}
          title="Toggle Grid (G)"
        >
          Grid (G)
        </button>
        <button 
          onClick={restoreOriginalWorkspace}
          className={`backdrop-blur text-xs px-2 py-1 rounded border shadow-sm transition-all duration-200 cursor-pointer font-medium ${
            theme === 'light'
              ? 'bg-white/90 text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 shadow-sm'
              : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
          }`}
          title="Restore original positions (R)"
        >
          Restore (R)
        </button>
      </div>
      <div className="absolute bottom-4 left-4 flex gap-2">
        <div className={`backdrop-blur text-xs px-3 py-2 rounded border shadow-sm pointer-events-none transition-colors duration-200 font-medium ${
          theme === 'light'
            ? 'bg-white/90 text-zinc-500 border-zinc-200 shadow-sm'
            : 'bg-zinc-900/80 text-zinc-400 border-zinc-700'
        }`}>
          Left Drag: Move Disks &middot; Shift+Drag / Middle Click: Pan &middot; Right Click: Pin/Unpin &middot; Scroll: Zoom
        </div>
      </div>
    </div>
  );
}
