import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Project, ProcessedProject } from './types';
import { audioService } from './services/audioService';
import { ProjectTile } from './components/ProjectTile';
import { Minimap } from './components/Minimap';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { AdminPanel } from './components/AdminPanel';
import { ProjectDetailPanel } from './components/ProjectDetailPanel';

// Constants for the virtual world size
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const TILE_SIZE = 320; // Large gap radius to ensure separation

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(window.location.hash === '#admin');
  
  // Data State
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View State
  const [zoom, setZoom] = useState(1);
  const [currentCoords, setCurrentCoords] = useState({ tech: 50, art: 50 });
  
  // Selection State
  const [selectedProject, setSelectedProject] = useState<ProcessedProject | null>(null);

  // Window/Scroll State
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  
  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ x: 0, y: 0 });
  
  // RAF Ref for scroll optimization
  const rafRef = useRef<number | null>(null);

useEffect(() => {
  let isCancelled = false;

  const loadData = async () => {
    try {
      // Vite guarantees BASE_URL is a string path prefix
      const baseUrl = import.meta.env.BASE_URL;

      // "/works.json" in dev or "/gurs-creative-field/works.json" on GitHub Pages
      const fullUrl = `${baseUrl}works.json`;

      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!isCancelled) {
        setRawProjects(data);
      }
    } catch (e) {
      console.error('Could not load projects data:', e);

      // Fallback – relative fetch from current path (e.g. when running in a sandbox)
      try {
        const response = await fetch('works.json');
        if (response.ok) {
          const data = await response.json();
          if (!isCancelled) {
            setRawProjects(data);
          }
        }
      } catch (fallbackError) {
        console.error(fallbackError);
      }
    } finally {
      if (!isCancelled) {
        setIsLoading(false);
      }
    }
  };

  loadData();

  // Proper cleanup function (no JSX returned from the effect)
  return () => {
    isCancelled = true;
  };
}, []);

  // Process Projects: Coordinates + Collision Detection
  const processedProjects = useMemo<ProcessedProject[]>(() => {
    if (!rawProjects.length) return [];

    // 1. Initial Position Mapping (Percentage to Pixels)
    let nodes = rawProjects.map((p) => {
      const margin = 400; // Larger margin to keep away from edges
      const usableWidth = WORLD_WIDTH - (margin * 2);
      const usableHeight = WORLD_HEIGHT - (margin * 2);

      // Tech: 0 (Left) -> 100 (Right)
      const x = margin + (p.techScore / 100) * usableWidth;
      
      // Art: 100 (Top) -> 0 (Bottom)
      const y = margin + ((100 - p.artScore) / 100) * usableHeight;

      return { ...p, x, y, vx: 0, vy: 0 };
    });

    // 2. Collision Resolution (Iterative Repel)
    const iterations = 120; // High iterations for stability
    
    for (let i = 0; i < iterations; i++) {
        for (let a = 0; a < nodes.length; a++) {
            for (let b = a + 1; b < nodes.length; b++) {
                const nodeA = nodes[a];
                const nodeB = nodes[b];

                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const distSq = dx * dx + dy * dy;
                const minDist = TILE_SIZE; 

                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq) || 0.1;
                    const overlap = minDist - dist;
                    
                    // Normalize vector
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Stronger separation force
                    const force = overlap * 0.8; 

                    nodeA.x += nx * force;
                    nodeA.y += ny * force;
                    nodeB.x -= nx * force;
                    nodeB.y -= ny * force;
                }
            }
        }
        
        // Boundary Constraints
        nodes.forEach(node => {
            node.x = Math.max(200, Math.min(WORLD_WIDTH - 200, node.x));
            node.y = Math.max(200, Math.min(WORLD_HEIGHT - 200, node.y));
        });
    }

    return nodes.map(n => ({
        ...n,
        x: n.x,
        y: n.y
    }));
  }, [rawProjects]);

  // Filter based on search
  const visibleProjects = useMemo(() => {
      if (!searchQuery) return processedProjects;
      const q = searchQuery.toLowerCase();
      return processedProjects.filter(p => 
          p.title.toLowerCase().includes(q) || 
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.description.toLowerCase().includes(q)
      );
  }, [processedProjects, searchQuery]);

  // Auto-scroll to results when search changes
  useEffect(() => {
    if (searchQuery && visibleProjects.length > 0) {
        const target = visibleProjects[0];
        const scaledX = target.x * zoom;
        const scaledY = target.y * zoom;
        
        window.scrollTo({
            left: scaledX - (window.innerWidth / 2),
            top: scaledY - (window.innerHeight / 2),
            behavior: 'smooth'
        });
    }
  }, [searchQuery, visibleProjects, zoom]);

  // --- Event Handlers ---

  const updateState = () => {
    const winScrollX = window.scrollX;
    const winScrollY = window.scrollY;
    
    setScrollPos({ x: winScrollX, y: winScrollY });

    // Center point in World Coordinates
    const centerX = (winScrollX + (windowSize.w / 2)) / zoom;
    const centerY = (winScrollY + (windowSize.h / 2)) / zoom;

    const xRatio = Math.max(0, Math.min(1, centerX / WORLD_WIDTH));
    const yRatio = Math.max(0, Math.min(1, centerY / WORLD_HEIGHT));
    
    // Update HUD State
    const margin = 400;
    const usable = WORLD_WIDTH - margin * 2;
    
    const techVal = Math.round(((centerX - margin) / usable) * 100);
    const artVal = Math.round(100 - ((centerY - margin) / usable) * 100);
    
    setCurrentCoords({
        tech: Math.max(0, Math.min(100, techVal)),
        art: Math.max(0, Math.min(100, artVal))
    });

    if (hasStarted) {
        audioService.updateParams(xRatio, yRatio);
    }
  };

  const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
          updateState();
          rafRef.current = null;
      });
  };

  const handleResize = () => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    updateState();
  };

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!hasStarted || isAdminOpen || selectedProject) return;
    if ((e.target as HTMLElement).closest('.project-tile')) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    scrollStart.current = { x: window.scrollX, y: window.scrollY };
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !hasStarted || isAdminOpen) return;
    e.preventDefault();
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    window.scrollTo(
      scrollStart.current.x - dx,
      scrollStart.current.y - dy
    );
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
  };
  
  const toggleMute = (e: React.MouseEvent) => {
      e.stopPropagation();
      const newState = !isMuted;
      setIsMuted(newState);
      audioService.toggleMute(newState);
  };

  const handleAdminUpdate = (updatedProjects: Project[]) => {
      setRawProjects(updatedProjects);
  };

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
      // x, y are target center coordinates in World Pixels
      const scaledX = x * zoom;
      const scaledY = y * zoom;

      const targetScrollX = scaledX - (window.innerWidth / 2);
      const targetScrollY = scaledY - (window.innerHeight / 2);

      window.scrollTo({
          left: targetScrollX,
          top: targetScrollY,
          behavior: 'auto'
      });
  }, [zoom]);

  // --- Effects ---

  useEffect(() => {
    const handleHashChange = () => setIsAdminOpen(window.location.hash === '#admin');
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasStarted, zoom]); 

  const startExperience = async () => {
    await audioService.start();
    setHasStarted(true);
    
    // Center initial view (scaled)
    const startX = (WORLD_WIDTH * zoom - window.innerWidth) / 2;
    const startY = (WORLD_HEIGHT * zoom - window.innerHeight) / 2;

    window.scrollTo(startX, startY);
    
    requestAnimationFrame(updateState);
  };

  const handleZoom = (delta: number) => {
      const newZoom = Math.min(1.5, Math.max(0.4, zoom + delta));
      
      const centerX = window.scrollX + (window.innerWidth / 2);
      const centerY = window.scrollY + (window.innerHeight / 2);
      
      const worldX = centerX / zoom;
      const worldY = centerY / zoom;
      
      setZoom(newZoom);

      requestAnimationFrame(() => {
          const newCenterX = worldX * newZoom;
          const newCenterY = worldY * newZoom;
          window.scrollTo(
              newCenterX - (window.innerWidth / 2),
              newCenterY - (window.innerHeight / 2)
          );
      });
  };

  if (isLoading) {
      return <div className="w-full h-screen bg-[#0a0a0a] flex items-center justify-center text-white/50 font-mono">Loading assets...</div>;
  }

  if (isAdminOpen) {
      return (
          <AdminPanel 
            projects={rawProjects} 
            onUpdate={handleAdminUpdate} 
            onClose={() => {
                window.location.hash = '';
                setIsAdminOpen(false);
            }} 
          />
      );
  }

  return (
    <div 
      className="relative bg-[#0a0a0a] overflow-hidden"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ 
          width: `${WORLD_WIDTH * zoom}px`, 
          height: `${WORLD_HEIGHT * zoom}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
      }}
    >
      
      {!hasStarted && <WelcomeOverlay onStart={startExperience} />}

      {/* World Container - Scaled */}
      <div 
        style={{
            width: `${WORLD_WIDTH}px`,
            height: `${WORLD_HEIGHT}px`,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
        }}
        className="relative"
      >
        {/* Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
                backgroundSize: '100px 100px'
                }}
        />
        
        {/* Axis Labels (In World) */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none select-none uppercase whitespace-nowrap">
            More Art
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none select-none uppercase whitespace-nowrap">
            Less Art
        </div>
        <div className="absolute left-[-300px] top-1/2 -translate-y-1/2 -rotate-90 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none origin-center whitespace-nowrap select-none uppercase">
            Less Tech
        </div>
        <div className="absolute right-[-300px] top-1/2 -translate-y-1/2 rotate-90 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none origin-center whitespace-nowrap select-none uppercase">
            More Tech
        </div>

        {/* Project Nodes */}
        {visibleProjects.map((project) => (
            <div key={project.id} style={{ position: 'absolute', left: project.x, top: project.y }} className="project-tile">
                <ProjectTile 
                    project={project} 
                    onClick={(p) => {
                        if (!isDragging) setSelectedProject(p);
                    }} 
                />
            </div>
        ))}
      </div>
      
      {/* Details Sidepanel */}
      <ProjectDetailPanel 
          project={selectedProject} 
          onClose={() => setSelectedProject(null)} 
      />

      {/* HUD */}
      {hasStarted && (
          <>
            <Minimap 
                scrollX={scrollPos.x}
                scrollY={scrollPos.y}
                worldWidth={WORLD_WIDTH}
                worldHeight={WORLD_HEIGHT}
                windowWidth={windowSize.w}
                windowHeight={windowSize.h}
                zoom={zoom}
                projects={visibleProjects}
                onNavigate={handleMinimapNavigate}
            />
            
            {/* Left Top: Merged Info & Search */}
            <div className="fixed top-6 left-6 z-50 flex flex-col">
                <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl w-[280px]">
                    <div className="p-4 border-b border-white/10">
                        <h2 className="text-white font-semibold text-lg tracking-wider leading-none">
                            <span className="bg-gradient-to-r from-purple-300 to-blue-300 text-transparent bg-clip-text">Creative field</span>
                        </h2>
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">by Gur Shafriri</p>
                    </div>
                    
                    <div className="p-2 bg-white/5">
                        <div className="flex items-center bg-black/50 rounded-lg border border-white/5">
                             <div className="pl-2 text-neutral-500">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Search works..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none text-white text-xs p-2 pl-2 w-full focus:outline-none placeholder:text-neutral-600 font-mono"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="pr-2 text-neutral-500 hover:text-white">
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Left Indicators */}
            <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-4">
                {/* Coordinate Scanner */}
                <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-lg space-y-2 w-[140px]">
                     <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-blue-400 uppercase">Tech</span>
                        <span className="text-white">{currentCoords.tech}</span>
                     </div>
                     <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${currentCoords.tech}%` }} />
                     </div>
                     
                     <div className="flex justify-between items-center text-xs font-mono pt-1">
                        <span className="text-purple-400 uppercase">Art</span>
                        <span className="text-white">{currentCoords.art}</span>
                     </div>
                     <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${currentCoords.art}%` }} />
                     </div>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-lg self-start">
                     <button 
                        onClick={() => handleZoom(-0.1)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                        </svg>
                     </button>
                     <span className="text-xs font-mono w-8 text-center text-neutral-500">{Math.round(zoom * 100)}%</span>
                     <button 
                        onClick={() => handleZoom(0.1)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                     </button>
                </div>

                {/* Audio Toggle */}
                 <button 
                    onClick={toggleMute}
                    className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg p-3 shadow-lg hover:bg-white/10 transition-colors self-start w-[140px]"
                 >
                     {isMuted ? (
                         <>
                             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-red-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                            </svg>
                             <span className="text-xs font-mono text-neutral-400">Unmute</span>
                         </>
                     ) : (
                         <>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                            </svg>
                            <span className="text-xs font-mono text-neutral-400">Sound On</span>
                         </>
                     )}
                 </button>
            </div>

             {/* Admin Toggle */}
            <div className="fixed bottom-6 left-0 w-4 h-4 z-[100]">
                 <button 
                    onClick={() => {
                         window.location.hash = 'admin';
                    }}
                    className="w-full h-full opacity-0 hover:opacity-50 bg-red-500 cursor-default"
                    title="Admin"
                />
            </div>
          </>
      )}
    </div>
  );
}

export default App;