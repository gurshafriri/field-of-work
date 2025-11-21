import React, { useEffect, useState, useRef, useMemo } from 'react';
import { INITIAL_PROJECTS } from './data/initialWorks';
import { Project, ProcessedProject } from './types';
import { audioService } from './services/audioService';
import { ProjectTile } from './components/ProjectTile';
import { Minimap } from './components/Minimap';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { AdminPanel } from './components/AdminPanel';
import { ProjectDetailPanel } from './components/ProjectDetailPanel';

// Constants for the virtual world size
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

function App() {
  const [hasStarted, setHasStarted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(window.location.hash === '#admin');
  
  // Data State
  const [rawProjects, setRawProjects] = useState<Project[]>(INITIAL_PROJECTS);
  
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

  // Process Projects into Visual World Coordinates
  const processedProjects = useMemo<ProcessedProject[]>(() => {
    return rawProjects.map((p) => {
      // Map scores (0-100) to coordinates
      // Tech: 0 (Left) -> 100 (Right)
      const x = 5 + (p.techScore * 0.9); 
      
      // Art: 100 (Top/High Art) -> 0 (Bottom/Low Art)
      // Inverted: Art 100 = 5%, Art 0 = 95%
      const y = 5 + ((100 - p.artScore) * 0.9);

      return {
        ...p,
        x, 
        y
      };
    });
  }, [rawProjects]);

  // --- Event Handlers ---

  const updateState = () => {
    const winScrollX = window.scrollX;
    const winScrollY = window.scrollY;
    
    setScrollPos({ x: winScrollX, y: winScrollY });

    // Calculate relative position (0.0 - 1.0) for Audio Engine
    const maxScrollX = WORLD_WIDTH - window.innerWidth;
    const maxScrollY = WORLD_HEIGHT - window.innerHeight;
    
    const xRatio = maxScrollX > 0 ? winScrollX / maxScrollX : 0;
    const yRatio = maxScrollY > 0 ? winScrollY / maxScrollY : 0;
    
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
    // Don't drag if clicking on a tile (handled by tile click, but propagation stopped there anyway)
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

  // --- Effects ---

  useEffect(() => {
    // Check hash on load
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
  }, [hasStarted]);

  const startExperience = async () => {
    await audioService.start();
    setHasStarted(true);
    
    // Center initial view
    window.scrollTo(
        (WORLD_WIDTH - window.innerWidth) / 2, 
        (WORLD_HEIGHT - window.innerHeight) / 2
    );
    
    // Force an initial update
    requestAnimationFrame(updateState);
  };

  const handleProjectClick = (project: ProcessedProject) => {
    if (!isDragging) {
        setSelectedProject(project);
    }
  };

  // Calculate HUD Values
  const maxScrollX = Math.max(1, WORLD_WIDTH - windowSize.w);
  const maxScrollY = Math.max(1, WORLD_HEIGHT - windowSize.h);
  
  // Tech is simply 0 -> 100 Left to Right
  const currentTech = Math.round((scrollPos.x / maxScrollX) * 100);
  
  // Art is 100 -> 0 Top to Bottom
  const currentArt = Math.round(100 - ((scrollPos.y / maxScrollY) * 100));

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
      className="relative bg-[#0a0a0a]"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ 
          width: `${WORLD_WIDTH}px`, 
          height: `${WORLD_HEIGHT}px`,
          cursor: isDragging ? 'grabbing' : 'grab',
          overscrollBehavior: 'none'
      }}
    >
      
      {!hasStarted && <WelcomeOverlay onStart={startExperience} />}

      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{
            backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '100px 100px'
            }}
      />
      
      {/* Axis Labels */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none select-none uppercase">
          High Artistry
      </div>
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none select-none uppercase">
          Low Artistry
      </div>
      <div className="absolute left-10 top-1/2 -translate-y-1/2 -rotate-90 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none origin-center whitespace-nowrap select-none uppercase">
          Low Tech
      </div>
      <div className="absolute right-10 top-1/2 -translate-y-1/2 rotate-90 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none origin-center whitespace-nowrap select-none uppercase">
          High Tech
      </div>

      {/* Project Nodes */}
      {processedProjects.map((project) => (
          <ProjectTile 
              key={project.id} 
              project={project} 
              onClick={handleProjectClick} 
          />
      ))}
      
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
                projects={processedProjects}
            />
            
            {/* Mute Button */}
            <div className="fixed bottom-6 right-56 sm:right-72 z-50">
                 <button 
                    onClick={toggleMute}
                    className="w-12 h-12 flex items-center justify-center bg-neutral-900/90 border border-white/20 rounded-full text-white/70 hover:text-white hover:bg-neutral-800 transition-all"
                    title={isMuted ? "Unmute Sound" : "Mute Sound"}
                 >
                    {isMuted ? (
                         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                         </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                    )}
                 </button>
            </div>
            
            {/* Legend & Scanner */}
            <div className="fixed top-6 left-6 pointer-events-none z-40 select-none bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10 min-w-[240px]">
                <h2 className="text-white-100 font-semibold text-lg tracking-wider"><span className="font-semibold bg-gradient-to-r from-purple-200 to-blue-200 text-transparent bg-clip-text">Creative field</span> by Gur</h2>
            </div>
          </>
      )}
        <div className="fixed bottom-6 left-6 z-40 bg-black/50 p-4 rounded-xl backdrop-blur-sm border border-white/10 min-w-[240px] font-mono text-sm group">
             <div className="flex justify-between text-blue-400 mb-1 select-none pointer-events-none">
                <span>Technology</span>
                <span className="font-bold">{currentTech.toString().padStart(3, '0')}</span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden pointer-events-none">
                <div className="h-full bg-blue-500 transition-all duration-200 ease-linear" style={{ width: `${currentTech}%` }}></div>
            </div>

            <div className="flex justify-between text-purple-400 mt-3 mb-1 select-none pointer-events-none">
                <span>Music and Art</span>
                <span className="font-bold">{currentArt.toString().padStart(3, '0')}</span>
            </div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden pointer-events-none">
                <div className="h-full bg-purple-500 transition-all duration-200 ease-linear" style={{ width: `${currentArt}%` }}></div>
            </div>
            <div className="mt-4 text-[10px] text-neutral-500 uppercase tracking-widest select-none pointer-events-none">
                Drag or Scroll to Navigate
            </div>
            
            {/* Hidden Admin Toggle (Visible on Hover) */}
            <button 
                onClick={() => setIsAdminOpen(true)}
                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity text-[10px] text-neutral-400 border border-white/20 px-1 rounded"
            >
                EDIT
            </button>
        </div>
    </div>
  );
}

export default App;