import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { Project, ProcessedProject } from './types';
import { audioService } from './services/audioService';
import { ProjectTile } from './components/ProjectTile';
import { Minimap } from './components/Minimap';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { AdminPanel } from './components/AdminPanel';
import { ProjectDetailPanel } from './components/ProjectDetailPanel';
import { TimelineDrawer } from './components/TimelineDrawer';
import { ScoreViewer } from './components/ScoreViewer';

// Constants for the virtual world size
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const TILE_SIZE = 320; // Large gap radius to ensure separation

function App() {
  // Check if we're accessing a project directly via URL - if so, skip welcome overlay
  const initialHash = window.location.hash;
  const isDirectProjectAccess = initialHash.startsWith('#project/') || initialHash === '#admin';
  
  const [hasStarted, setHasStarted] = useState(isDirectProjectAccess);
  const [isMuted, setIsMuted] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(initialHash === '#admin');
  
  // UI State
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  
  // Data State
  const [rawProjects, setRawProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View State
  const [zoom, setZoom] = useState(1);
  const [currentCoords, setCurrentCoords] = useState({ tech: 50, music: 50 });
  
  // Selection State
  const [selectedProject, setSelectedProject] = useState<ProcessedProject | null>(null);
  const [highlightedProject, setHighlightedProject] = useState<ProcessedProject | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // Score Viewer State
  const [viewingScoreUrl, setViewingScoreUrl] = useState<string | null>(null);

  // Audio Playback State
  const [playingProject, setPlayingProject] = useState<ProcessedProject | null>(null);
  const [lastNavigatedProject, setLastNavigatedProject] = useState<ProcessedProject | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  
  // Refs for Audio
  const audioRef = useRef<HTMLAudioElement>(null);
  const playlistHistory = useRef<Set<string>>(new Set()); // Track history to prevent loops

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
      if (filename.startsWith('http')) return filename;
      const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
      return `${baseUrl}media/${cleanFilename}`.replace('//', '/');
  };

  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      try {
        // "/works.json" in dev or "/field-of-work/works.json" on GitHub Pages
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

      // Handle potential legacy data or missing scores
      const techVal = p.techScore ?? 50;
      const musicVal = p.musicScore ?? (p as any).artScore ?? 50;

      // Tech: 0 (Left) -> 100 (Right)
      const x = margin + (techVal / 100) * usableWidth;
      
      // Music: 100 (Top) -> 0 (Bottom)
      const y = margin + ((100 - musicVal) / 100) * usableHeight;

      return { ...p, musicScore: musicVal, techScore: techVal, x, y, vx: 0, vy: 0 };
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

  /* handleAudioEnded moved to main logic block to access state */

  const handleSeek = (time: number) => {
      if (audioRef.current) {
          audioRef.current.currentTime = time;
      }
  };

  // --- Event Handlers ---

  const updateState = useCallback(() => {
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
    // Music: 100 (Top) -> 0 (Bottom) (ScrollY 0 is Top)
    const musicVal = Math.round((1 - yRatio) * 100);
    
    setCurrentCoords({
        tech: Math.max(0, Math.min(100, techVal)),
        music: Math.max(0, Math.min(100, musicVal))
    });

    if (hasStarted) {
        // Pass normalized ratios (0-1) to audio service
        audioService.updateParams(xRatio, 1 - yRatio);
    }
  }, [hasStarted]);

  const onScroll = useCallback(() => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
          updateState();
          rafRef.current = null;
      });
  }, [updateState]);

  const handleResize = useCallback(() => {
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    updateState();
  }, [updateState]);

  // Drag Logic
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!hasStarted || isAdminOpen || selectedProject || !scrollContainerRef.current) return;
    if ((e.target as HTMLElement).closest('.project-tile')) return;

    setIsDragging(true);
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    dragStart.current = { x: clientX, y: clientY };
    scrollStart.current = { 
        x: scrollContainerRef.current.scrollLeft, 
        y: scrollContainerRef.current.scrollTop 
    };
    // Only set cursor if not touch
    if (!('touches' in e)) {
        document.body.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !hasStarted || isAdminOpen || !scrollContainerRef.current) return;
    // e.preventDefault(); // Removing this might allow scrolling, but we want custom drag. 
    // However, for touch, preventing default might block native behaviors. 
    // Let's keep it for mouse but be careful with touch.
    if (!('touches' in e)) {
        e.preventDefault();
    }
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }
    
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;

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
          // New track selected manually: Reset history
          playlistHistory.current.clear();
          playlistHistory.current.add(project.id);
          
          setPlayingProject(project);
          setIsAudioPlaying(true);
      }
      handleMuteRequest(); 
  };

  // Auto-advance Playlist Logic
  const scrollToProject = useCallback((project: ProcessedProject) => {
      if (!scrollContainerRef.current) return;
      const scaledX = project.x * zoom;
      const scaledY = project.y * zoom;

      scrollContainerRef.current.scrollTo({
          left: scaledX - (window.innerWidth / 2),
          top: scaledY - (window.innerHeight / 2),
          behavior: 'smooth'
      });
  }, [zoom]);

  // Specific handler for Auto-Advance (End of Track)
  const handleAutoAdvance = useCallback(() => {
      if (!playingProject) return;

      // Add current to history
      playlistHistory.current.add(playingProject.id);

      // Define featured track
      const featuredTitle = "Inhibition/Exhibition I";

      // Get all audio projects
      const audioProjects = processedProjects.filter(p => p.audioUrl);

      // Helper: robust title match
      const isTitle = (p: ProcessedProject, title: string) => 
          p.title.trim().toLowerCase() === title.trim().toLowerCase();

      // 1. Identify Featured & Alpha
      const featuredProject = audioProjects.find(p => isTitle(p, featuredTitle));
      const alphaProject = audioProjects.find(p => isTitle(p, "Alpha-bend synchronisation"));

      // 2. Construct "Others" (Newest First, excluding Featured & Alpha)
      const parseDate = (dateStr?: string) => {
          if (!dateStr) return 0;
          const [month, year] = dateStr.split('/').map(Number);
          const fullYear = year < 100 ? 2000 + year : year;
          return new Date(fullYear, month - 1).getTime();
      };

      const others = audioProjects
          .filter(p => !isTitle(p, featuredTitle) && !isTitle(p, "Alpha-bend synchronisation"))
          .sort((a, b) => parseDate(b.date) - parseDate(a.date));

      let nextProject: ProcessedProject | undefined;

      // LOGIC (same as before)
      if (featuredProject && !playlistHistory.current.has(featuredProject.id) && playingProject.id !== featuredProject.id) {
           nextProject = featuredProject;
      } else {
          nextProject = others.find(p => !playlistHistory.current.has(p.id));
          if (!nextProject && alphaProject && !playlistHistory.current.has(alphaProject.id)) {
              nextProject = alphaProject;
          }
      }

      if (nextProject) {
          setPlayingProject(nextProject);
          setLastNavigatedProject(nextProject); // Sync navigation
          setIsAudioPlaying(true);
          handleMuteRequest();
          scrollToProject(nextProject);
      } else {
          console.log("Playlist finished");
          setIsAudioPlaying(false);
          setAudioProgress(0);
          playlistHistory.current.clear();
      }
  }, [playingProject, processedProjects, handleMuteRequest, scrollToProject]);

  const handlePlayNext = useCallback(() => {
    // If audio is playing, use the auto-advance logic (next track with audio)
    if (isAudioPlaying && playingProject) {
        handleAutoAdvance();
        return;
    }

    // Otherwise (not playing), just navigate focus without playing
    // Determine the current reference project for navigation
    // 1. lastNavigatedProject if available (manual navigation)
    // 2. playingProject if available (currently playing but paused)
    // 3. Inhibition/Exhibition I as default fallback if nothing else
    
    const allProjectsByDate = [...processedProjects].sort((a, b) => {
        const parseDate = (dateStr?: string) => {
            if (!dateStr) return 0;
            const [month, year] = dateStr.split('/').map(Number);
            const fullYear = year < 100 ? 2000 + year : year;
            return new Date(fullYear, month - 1).getTime();
        };
        return parseDate(b.date) - parseDate(a.date);
    });

    const currentRef = lastNavigatedProject || playingProject;
    
    let nextProject: ProcessedProject | undefined;
    
    if (currentRef) {
        const currentIndex = allProjectsByDate.findIndex(p => p.id === currentRef.id);
        const nextIndex = (currentIndex + 1) % allProjectsByDate.length;
        nextProject = allProjectsByDate[nextIndex];
    } else {
        // Start from first project (newest)
        nextProject = allProjectsByDate[0];
    }

    if (nextProject) {
        console.log("Navigating to:", nextProject.title);
        
        // Update visual focus
        setLastNavigatedProject(nextProject);
        scrollToProject(nextProject);
        
        // IMPORTANT: DO NOT PLAY AUDIO
        // Just move focus.
    }
  }, [processedProjects, lastNavigatedProject, playingProject, scrollToProject, isAudioPlaying, handleAutoAdvance]);

  const handleAudioEnded = useCallback(() => {
      handleAutoAdvance();
  }, [handleAutoAdvance]);

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

  const handleTimelineHighlight = useCallback((project: ProcessedProject | null) => {
      setHighlightedProject(project);
      
      if (project && scrollContainerRef.current) {
          // Navigate to project
          const scaledX = project.x * zoom;
          const scaledY = project.y * zoom;
          
          const targetLeft = scaledX - (window.innerWidth / 2);
          const targetTop = scaledY - (window.innerHeight / 2);

          scrollContainerRef.current.scrollTo({
              left: targetLeft,
              top: targetTop,
              behavior: 'smooth'
          });
      }
  }, [zoom]);

  // --- Effects ---

  // Refs to keep track of state inside event listeners without triggering re-renders
  const selectedProjectRef = useRef(selectedProject);
  const isAdminRef = useRef(isAdminOpen);
  const hasStartedRef = useRef(hasStarted);
  // Initialize with current hash if it looks like a project link, so we don't clear it before loading
  const pendingHashMatchRef = useRef<string | null>(
    window.location.hash.startsWith('#project/') ? window.location.hash : null
  );
  
  useEffect(() => { 
      selectedProjectRef.current = selectedProject;
      // If a project is selected, we are no longer pending a match
      if (selectedProject) {
          pendingHashMatchRef.current = null;
      }
  }, [selectedProject]);
  useEffect(() => { isAdminRef.current = isAdminOpen; }, [isAdminOpen]);
  useEffect(() => { hasStartedRef.current = hasStarted; }, [hasStarted]);

  // Start audio service when accessing directly via URL
  useEffect(() => {
    if (hasStarted && isDirectProjectAccess) {
      audioService.start().catch(err => {
        console.warn('Failed to start audio service on direct access:', err);
      });
    }
  }, [hasStarted, isDirectProjectAccess]);

  // Helper to slugify title
  const toSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Ensure project is set on direct access once projects are loaded
  // Use a ref to track if we've already processed the initial hash to prevent re-running
  const hasProcessedInitialHashRef = useRef(false);
  const zoomRef = useRef(zoom);
  
  // Keep zoom ref updated
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  
  useEffect(() => {
    // Only process once on initial load when projects become available
    if (hasProcessedInitialHashRef.current || !isDirectProjectAccess || !processedProjects.length) return;
    
    const hash = window.location.hash;
    if (!hash.startsWith('#project/')) {
      hasProcessedInitialHashRef.current = true; // Mark as processed even if no project hash
      return;
    }
    
    const slugOrId = decodeURIComponent(hash.replace('#project/', ''));
    
    // Try matching by slug first (preferred)
    let project = processedProjects.find(p => toSlug(p.title) === slugOrId);
    
    // Fallback to ID match for backward compatibility
    if (!project) {
      project = processedProjects.find(p => p.id === slugOrId);
    }
    
    // Set project if found and not already selected (using ref to avoid dependency issues)
    if (project && selectedProjectRef.current?.id !== project.id) {
      setSelectedProject(project);
      pendingHashMatchRef.current = null; // Clear pending match
      hasProcessedInitialHashRef.current = true; // Mark as processed
      
      // Scroll to project after a short delay to ensure DOM is ready
      setTimeout(() => {
        if (scrollContainerRef.current) {
          // Use zoom from ref to avoid dependency issues
          const currentZoom = zoomRef.current;
          const scaledX = project.x * currentZoom;
          const scaledY = project.y * currentZoom;
          scrollContainerRef.current.scrollTo({
            left: scaledX - (window.innerWidth / 2),
            top: scaledY - (window.innerHeight / 2),
            behavior: 'auto'
          });
          requestAnimationFrame(updateState);
        }
      }, 100);
    } else {
      // No project found, but mark as processed to avoid re-checking
      hasProcessedInitialHashRef.current = true;
    }
  }, [processedProjects.length, isDirectProjectAccess]); // Only depend on length and access flag

  // Routing: Handle Hash Changes (Inbound)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const currentProject = selectedProjectRef.current;
      const currentAdmin = isAdminRef.current;
      
      // 1. Admin Check
      if (hash === '#admin') {
        if (!currentAdmin) {
            setIsAdminOpen(true);
            setSelectedProject(null);
        }
        return;
      } 
      
      // Exit admin if hash changes away from it
      if (currentAdmin && hash !== '#admin') {
        setIsAdminOpen(false);
      }

      // 2. Project Check
      if (hash.startsWith('#project/')) {
        const slugOrId = decodeURIComponent(hash.replace('#project/', ''));
        
        // Try matching by slug first (preferred)
        let project = processedProjects.find(p => toSlug(p.title) === slugOrId);
        
        // Fallback to ID match for backward compatibility
        if (!project) {
             project = processedProjects.find(p => p.id === slugOrId);
        }
        
        // Set project if found
        if (project) {
            // Always set the project when found via hash (ensures it opens on direct access)
            // Only skip if it's already the same project to avoid unnecessary re-renders
            if (currentProject?.id !== project.id) {
                setSelectedProject(project);
                pendingHashMatchRef.current = null; // Clear pending match
            }
            
            // Auto-start if deep linking (and mute)
            if (!hasStartedRef.current) {
                setHasStarted(true);
                setIsMuted(true);
            }
            
            // Always scroll to project when accessing via URL (whether just started or already started)
            // We use a timeout to allow the DOM to settle (removing WelcomeOverlay if needed)
            setTimeout(() => {
                if (scrollContainerRef.current) {
                    const scaledX = project.x * zoom;
                    const scaledY = project.y * zoom;
                    scrollContainerRef.current.scrollTo({
                        left: scaledX - (window.innerWidth / 2),
                        top: scaledY - (window.innerHeight / 2),
                        behavior: 'auto'
                    });
                    // Initialize audio params
                    requestAnimationFrame(updateState);
                }
            }, hasStartedRef.current ? 50 : 100); // Shorter delay if already started
        } else if (hash.startsWith('#project/')) {
            // Hash exists but project not found - might still be loading
            // Log for debugging
            console.warn('Project not found for hash:', hash);
        }
      } else {
        // 3. Clear Project if hash is cleared
        // Only clear if we currently have a project selected
        if (currentProject && !currentAdmin) {
          setSelectedProject(null);
        }
      }
    };

    // Initial check on mount/data load
    if (processedProjects.length > 0) {
        handleHashChange();
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [processedProjects]); // Stable dependency

  // Routing: Sync State to Hash (Outbound)
  useEffect(() => {
    // Don't modify hash while loading - wait for projects to load and match
    if (isLoading) return;
    
    // Don't clear hash if we're still waiting to match a project from the URL
    if (pendingHashMatchRef.current && !selectedProject) return;
    
    if (selectedProject) {
      const slug = toSlug(selectedProject.title);
      const targetHash = `#project/${slug}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', targetHash);
      }
    } else if (isAdminOpen) {
       if (window.location.hash !== '#admin') {
         window.history.pushState(null, '', '#admin');
       }
    } else {
       // Clear hash if state is clean but URL isn't
       // Only clear if we're not waiting for a project match
       const currentHash = window.location.hash;
       if ((currentHash.startsWith('#project/') || currentHash === '#admin')) {
         // Safe to clear - no pending match and projects are loaded
         window.history.pushState(null, '', window.location.pathname + window.location.search);
       }
    }
  }, [selectedProject, isAdminOpen, isLoading]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);
    
    // Attach scroll listener to container instead of window
    const container = scrollContainerRef.current;
    if (container) {
        container.addEventListener('scroll', onScroll, { passive: true });
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (container) {
          container.removeEventListener('scroll', onScroll);
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [hasStarted, zoom, isLoading, handleResize, onScroll]); 

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
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
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
                    Music
                </div>
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 text-neutral-800 font-black tracking-[1em] text-6xl pointer-events-none select-none uppercase whitespace-nowrap">
                    Other things
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
                            isHighlighted={highlightedProject?.id === project.id}
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
          onViewScore={(url) => setViewingScoreUrl(url)}
      />
      
      {/* Global Score Viewer Overlay */}
      {viewingScoreUrl && (
        <ScoreViewer 
          pdfUrl={viewingScoreUrl}
          onClose={() => setViewingScoreUrl(null)}
        />
      )}

            {/* HUD - Placed OUTSIDE the scroll container to ensure fixed positioning works reliably */}
            {hasStarted && (
                <>
                    {/* Timeline Drawer - Rendered globally but positioned relative to Minimap visually */}
                    <TimelineDrawer 
                        isOpen={isTimelineOpen}
                        projects={processedProjects}
                        onSelect={(p) => {
                            handleTimelineHighlight(p);
                        }}
                        onToggle={() => setIsTimelineOpen(!isTimelineOpen)}
                        highlightedProjectId={highlightedProject?.id || null}
                    />

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
                        musicScore={currentCoords.music}
                        isMuted={isMuted}
                        onToggleMute={toggleMute}
                        isPanelOpen={!!selectedProject}
                        isTimelineOpen={isTimelineOpen}
                        onToggleTimeline={() => setIsTimelineOpen(!isTimelineOpen)}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={() => setIsDragging(false)}
                    />
            
            {/* Left Top: Merged Info, Search & Now Playing */}
            <div className={`fixed top-4 left-4 right-auto md:top-6 md:left-6 z-50 flex flex-col gap-3 pointer-events-none transition-opacity duration-300 ${isDragging ? 'opacity-20' : 'opacity-100'}`}>
                <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden shadow-2xl w-fit max-w-[calc(100vw-2rem)] pointer-events-auto">
                    <div className="p-2 border-b border-white/10 flex justify-between items-center gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div>
                                <h2 className="text-white font-semibold text-base tracking-wider leading-none">
                                    <span className="bg-gradient-to-r from-purple-300 to-blue-300 text-transparent bg-clip-text">Field of work</span>
                                </h2>
                                <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">by Gur Shafriri</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Collapse Toggle Button (Magnifying Glass) */}
                            <button 
                                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                                className={`text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors ${!isPanelCollapsed ? 'text-white bg-white/10' : ''}`}
                                aria-label={isPanelCollapsed ? "Show search" : "Hide search"}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                                </svg>
                            </button>

                            {/* Playing Badge (Mini) */}
                            {/* Playing Badge (Mini) */}
                            {playingProject ? (
                                <>
                                    <div 
                                        onClick={() => setSelectedProject(playingProject)}
                                        className="relative w-8 h-8 shrink-0 cursor-pointer group rounded-md overflow-hidden border border-white/20 hover:border-blue-400 transition-colors"
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
                                                <div className="w-1.5 h-1.5 rounded-full bg-white/50" />
                                            )}
                                        </div>
                                    </div>
                                    {/* Next Button */}
                                    <button 
                                        onClick={handlePlayNext}
                                        className="text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
                                        title="Next Project"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => {
                                            const target = lastNavigatedProject || processedProjects.find(p => p.title === "Inhibition/Exhibition I");
                                            
                                            // Determine what to play
                                            if (target) {
                                                // If target has audio, play it
                                                if (target.audioUrl) {
                                                     setPlayingProject(target);
                                                     setIsAudioPlaying(true);
                                                     handleMuteRequest();
                                                     scrollToProject(target);
                                                } else {
                                                    // Fallback to Inhibition if selected has no audio
                                                    const fallback = processedProjects.find(p => p.title === "Inhibition/Exhibition I");
                                                    if (fallback) {
                                                        setPlayingProject(fallback);
                                                        setIsAudioPlaying(true);
                                                        handleMuteRequest();
                                                        scrollToProject(fallback);
                                                    }
                                                }
                                            }
                                        }}
                                        className="w-8 h-8 flex items-center justify-center rounded-md border border-white/20 hover:border-blue-400 hover:bg-white/10 text-white transition-colors"
                                        title={lastNavigatedProject ? `Play ${lastNavigatedProject.title}` : "Start Listening"}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                            <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    {/* Next Button (Initial State) */}
                                    <button 
                                        onClick={handlePlayNext}
                                        className="text-neutral-400 hover:text-white p-1.5 rounded hover:bg-white/10 transition-colors"
                                        title="Next Project"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
                                        </svg>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    
                    <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isPanelCollapsed ? 'max-h-0 opacity-0' : 'max-h-20 opacity-100'}`}>
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