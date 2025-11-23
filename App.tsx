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

  // Audio Playback State
  const [playingProject, setPlayingProject] = useState<ProcessedProject | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  // Refs for Audio
  const audioRef = useRef<HTMLAudioElement>(null);

  // Window/Scroll State
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  
  // Scroll Container Ref (Replaces window scroll)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Drag State
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ x: 0, y: 0 });
  
  // RAF Ref for scroll optimization
  const rafRef = useRef<number | null>(null);

  const baseUrl = import.meta.env?.BASE_URL || '/';
  const mediaPath = (filename?: string) => {
      if (!filename) return '';
      const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
      return `${baseUrl}media/${cleanFilename}`.replace('//', '/');
  };

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
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
    if (searchQuery && visibleProjects.length > 0 && scrollContainerRef.current) {
        const target = visibleProjects[0];
        const scaledX = target.x * zoom;
        const scaledY = target.y * zoom;
        
        scrollContainerRef.current.scrollTo({
            left: scaledX - (window.innerWidth / 2),
            top: scaledY - (window.innerHeight / 2),
            behavior: 'smooth'
        });
    }
  }, [searchQuery, visibleProjects, zoom]);

  // --- Audio Logic ---

  // Handle Play/Pause
  useEffect(() => {
      if (!audioRef.current || !playingProject) return;
      
      const src = mediaPath(playingProject.audioUrl);
      
      // Load source if changed
      if (audioRef.current.getAttribute('src') !== src) {
          audioRef.current.src = src;
          audioRef.current.load();
      }

      if (isAudioPlaying) {
          audioRef.current.play().catch(e => {
              console.warn("Autoplay blocked or failed", e);
              setIsAudioPlaying(false);
          });
      } else {
          audioRef.current.pause();
      }

  }, [playingProject, isAudioPlaying]);

  const handleAudioTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const audio = e.currentTarget;
      setAudioCurrentTime(audio.currentTime);
      setAudioDuration(audio.duration || 0);
      setAudioProgress((audio.currentTime / (audio.duration || 1)) * 100);
  };

  const handleAudioMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
      setAudioDuration(e.currentTarget.duration || 0);
  };

  const handleAudioEnded = () => {
      setIsAudioPlaying(false);
      setAudioProgress(0);
  };

  const handleSeek = (time: number) => {
      if (audioRef.current) {
          audioRef.current.currentTime = time;
      }
  };

  // --- Event Handlers ---

  const updateState = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const winScrollX = container.scrollLeft;
    const winScrollY = container.scrollTop;
    
    setScrollPos({ x: winScrollX, y: winScrollY });

    // Calculate Scroll Ratio (0 to 1) based on available scroll area
    // This ensures that regardless of zoom, 0% scroll is Left/Top and 100% scroll is Right/Bottom
    const maxScrollX = container.scrollWidth - container.clientWidth;
    const maxScrollY = container.scrollHeight - container.clientHeight;
    
    // Avoid divide by zero if content fits the screen exactly
    const xRatio = maxScrollX > 0 ? winScrollX / maxScrollX : 0.5;
    const yRatio = maxScrollY > 0 ? winScrollY / maxScrollY : 0.5;

    // Tech: 0 (Left) -> 100 (Right)
    const techVal = Math.round(xRatio * 100);
    // Art: 100 (Top) -> 0 (Bottom) (ScrollY 0 is Top)
    const artVal = Math.round((1 - yRatio) * 100);
    
    setCurrentCoords({
        tech: Math.max(0, Math.min(100, techVal)),
        art: Math.max(0, Math.min(100, artVal))
    });

    if (hasStarted) {
        // Pass normalized ratios (0-1) to audio service
        audioService.updateParams(xRatio, 1 - yRatio);
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
    if (!hasStarted || isAdminOpen || selectedProject || !scrollContainerRef.current) return;
    if ((e.target as HTMLElement).closest('.project-tile')) return;

    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    scrollStart.current = { 
        x: scrollContainerRef.current.scrollLeft, 
        y: scrollContainerRef.current.scrollTop 
    };
    document.body.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !hasStarted || isAdminOpen || !scrollContainerRef.current) return;
    e.preventDefault();
    
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    scrollContainerRef.current.scrollTo(
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

  const handleMuteRequest = useCallback(() => {
      // Mute the ambient audio when a track starts
      if (!isMuted) {
          setIsMuted(true);
          audioService.toggleMute(true);
      }
  }, [isMuted]);

  // Audio Handlers for Project
  const handlePlayAudio = (project: ProcessedProject) => {
      if (playingProject?.id === project.id) {
          // If clicking same project, just toggle play
          setIsAudioPlaying(true);
      } else {
          setPlayingProject(project);
          setIsAudioPlaying(true);
      }
      handleMuteRequest(); 
  };

  const handleTogglePlay = (shouldPlay: boolean) => {
      setIsAudioPlaying(shouldPlay);
  };

  const handleAdminUpdate = (updatedProjects: Project[]) => {
      setRawProjects(updatedProjects);
  };

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
      if (!scrollContainerRef.current) return;
      // x, y are target center coordinates in World Pixels
      const scaledX = x * zoom;
      const scaledY = y * zoom;

      const targetScrollX = scaledX - (window.innerWidth / 2);
      const targetScrollY = scaledY - (window.innerHeight / 2);

      scrollContainerRef.current.scrollTo({
          left: targetScrollX,
          top: targetScrollY,
          behavior: 'auto'
      });
  }, [zoom]);

  // --- Effects ---

  useEffect(() => {
    const handleHashChange = () => setIsAdminOpen(window.location.hash === '#admin');
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('resize', handleResize);
    
    // Attach scroll listener to container instead of window
    const container = scrollContainerRef.current;
    if (container) {
        container.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('resize', handleResize);
      if (container) {
          container.removeEventListener('scroll', onScroll);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasStarted, zoom]); 

  const startExperience = async () => {
    await audioService.start();
    setHasStarted(true);
    
    // Defer scroll to next frame to ensure DOM layout is ready
    requestAnimationFrame(() => {
        if (!scrollContainerRef.current) return;
        
        // Center initial view (scaled)
        const startX = (WORLD_WIDTH * zoom - window.innerWidth) / 2;
        const startY = (WORLD_HEIGHT * zoom - window.innerHeight) / 2;
        
        scrollContainerRef.current.scrollTo(startX, startY);
        requestAnimationFrame(updateState);
    });
  };

  const handleZoom = (delta: number) => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const newZoom = Math.min(1.5, Math.max(0.4, zoom + delta));
      
      const centerX = container.scrollLeft + (window.innerWidth / 2);
      const centerY = container.scrollTop + (window.innerHeight / 2);
      
      const worldX = centerX / zoom;
      const worldY = centerY / zoom;
      
      setZoom(newZoom);

      requestAnimationFrame(() => {
          const newCenterX = worldX * newZoom;
          const newCenterY = worldY * newZoom;
          container.scrollTo(
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
    <div className="w-full h-full bg-[#0a0a0a] relative overflow-hidden">
      
      {!hasStarted && <WelcomeOverlay onStart={startExperience} />}

      {/* Hidden Audio Element */}
      <audio 
          ref={audioRef}
          className="hidden"
          onTimeUpdate={handleAudioTimeUpdate}
          onLoadedMetadata={handleAudioMetadata}
          onEnded={handleAudioEnded}
      />

      {/* World Container - Scaled */}
      <div 
        ref={scrollContainerRef}
        className={`w-full h-full overflow-auto ${hasStarted ? '' : 'overflow-hidden'}`}
      >
        <div
            className="relative origin-top-left"
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
        </div>
      </div>
      
      {/* Details Sidepanel */}
      <ProjectDetailPanel 
          project={selectedProject} 
          currentPlaying={playingProject}
          isPlaying={isAudioPlaying}
          audioProgress={audioProgress}
          audioDuration={audioDuration}
          audioCurrentTime={audioCurrentTime}
          onClose={() => setSelectedProject(null)} 
          onMuteRequest={handleMuteRequest}
          onPlayAudio={handlePlayAudio}
          onTogglePlay={handleTogglePlay}
          onSeek={handleSeek}
      />

      {/* HUD - Placed OUTSIDE the scroll container to ensure fixed positioning works reliably */}
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
                techScore={currentCoords.tech}
                artScore={currentCoords.art}
                isMuted={isMuted}
                onToggleMute={toggleMute}
                isPanelOpen={!!selectedProject}
            />
            
            {/* Left Top: Merged Info, Search & Now Playing */}
            <div className="fixed top-4 left-4 right-4 md:top-6 md:left-6 md:right-auto z-50 flex flex-col gap-3 pointer-events-none">
                <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden shadow-2xl w-full md:w-[280px] pointer-events-auto">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center gap-2">
                        <div>
                            <h2 className="text-white font-semibold text-lg tracking-wider leading-none">
                                <span className="bg-gradient-to-r from-purple-300 to-blue-300 text-transparent bg-clip-text">Field of work</span>
                            </h2>
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-1">by Gur Shafriri</p>
                        </div>

                        {/* Playing Badge (Mini) */}
                        {playingProject && (
                            <div 
                                onClick={() => setSelectedProject(playingProject)}
                                className="relative w-10 h-10 shrink-0 cursor-pointer group rounded-md overflow-hidden border border-white/20 hover:border-blue-400 transition-colors"
                                title={`Playing: ${playingProject.title}`}
                            >
                                {/* Background Image */}
                                {playingProject.imageUrl ? (
                                    <img 
                                        src={mediaPath(playingProject.imageUrl)} 
                                        alt={playingProject.title}
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                                    />
                                ) : (
                                    <div className="w-full h-full bg-neutral-800" />
                                )}
                                
                                {/* Animation Overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    {isAudioPlaying ? (
                                        <div className="flex gap-0.5 items-center">
                                            <div className="w-0.5 h-2 bg-white animate-[bounce_1s_infinite]" />
                                            <div className="w-0.5 h-3 bg-white animate-[bounce_1.2s_infinite]" />
                                            <div className="w-0.5 h-2 bg-white animate-[bounce_0.8s_infinite]" />
                                        </div>
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-white/50" />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-2 bg-white/5 space-y-2">
                        {/* Search Bar */}
                        <div className="flex items-center bg-black/50 rounded-sm border border-white/5">
                             <div className="pl-2 text-neutral-500">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                            </div>
                            <input 
                                type="text" 
                                placeholder="Search works and tags..." 
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

                {/* Zoom Controls */}
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md border border-white/10 rounded-sm p-1 shadow-lg self-start pointer-events-auto">
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
            </div>

             {/* Admin Toggle */}
            <div className="fixed bottom-6 left-0 w-4 h-4 z-[100] pointer-events-auto">
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