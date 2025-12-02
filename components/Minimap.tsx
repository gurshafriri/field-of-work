import React, { useRef, useEffect, useState } from 'react';
import { ProcessedProject } from '../types';
import { AudioVisualizer } from './AudioVisualizer';

interface MinimapProps {
    scrollX: number;
    scrollY: number;
    worldWidth: number;
    worldHeight: number;
    windowWidth: number;
    windowHeight: number;
    zoom: number;
    projects: ProcessedProject[];
    onNavigate: (x: number, y: number) => void;
    // Integrated HUD props
    techScore: number;
    musicScore: number;
    isMuted: boolean;
    onToggleMute: (e: React.MouseEvent) => void;
    isPanelOpen: boolean;
    isTimelineOpen?: boolean;
    onToggleTimeline?: () => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({ 
    scrollX, 
    scrollY, 
    worldWidth, 
    worldHeight, 
    windowWidth, 
    windowHeight,
    zoom,
    projects,
    onNavigate,
    techScore,
    musicScore,
    isMuted,
    onToggleMute,
    isPanelOpen,
    isTimelineOpen,
    onToggleTimeline,
    onDragStart,
    onDragEnd
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Store offset from viewport center to mouse position
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const propsRef = useRef({ worldWidth, worldHeight, windowWidth, windowHeight, zoom, onNavigate, scrollX, scrollY });
    useEffect(() => {
        propsRef.current = { worldWidth, worldHeight, windowWidth, windowHeight, zoom, onNavigate, scrollX, scrollY };
    }, [worldWidth, worldHeight, windowWidth, windowHeight, zoom, onNavigate, scrollX, scrollY]);

    // Draw Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            // Clear (Transparent background to let Visualizer show through)
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 0. Draw Grid (To match the main field)
            const gridSize = 100; // Matches App.tsx
            const gridSpacingX = (gridSize / worldWidth) * canvas.width;
            const gridSpacingY = (gridSize / worldHeight) * canvas.height;
            
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;

            // Vertical lines
            for (let x = 0; x <= canvas.width; x += gridSpacingX) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
            }
            // Horizontal lines
            for (let y = 0; y <= canvas.height; y += gridSpacingY) {
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.width, y);
            }
            ctx.stroke();

            // 1. Draw Projects
            projects.forEach(project => {
                const px = (project.x / worldWidth) * canvas.width;
                const py = (project.y / worldHeight) * canvas.height;

                const isTech = project.techScore > project.musicScore;
                ctx.fillStyle = isTech ? 'rgba(96, 165, 250, 0.8)' : 'rgba(192, 132, 252, 0.8)'; 
                
                ctx.beginPath();
                ctx.arc(px, py, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });

            // 2. Draw Viewport Rectangle
            const { zoom, windowWidth, windowHeight, scrollX, scrollY } = propsRef.current;
            
            // Calculate viewport in World Coordinates
            const viewX = (scrollX / zoom);
            const viewY = (scrollY / zoom);
            const viewW = (windowWidth / zoom);
            const viewH = (windowHeight / zoom);

            // Map to Canvas Coordinates
            const mapX = (viewX / worldWidth) * canvas.width;
            const mapY = (viewY / worldHeight) * canvas.height;
            const mapW = (viewW / worldWidth) * canvas.width;
            const mapH = (viewH / worldHeight) * canvas.height;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.strokeRect(mapX, mapY, mapW, mapH);
            
            // Semi-transparent fill for viewport
            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.fillRect(mapX, mapY, mapW, mapH);
        };

        const animationId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationId);

    }, [scrollX, scrollY, worldWidth, worldHeight, windowWidth, windowHeight, zoom, projects]);

    // Handle Drag Start
    const handleMouseDown = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        const { zoom, windowWidth, windowHeight, scrollX, scrollY, worldWidth, worldHeight } = propsRef.current;

        const viewW = (windowWidth / zoom);
        const viewH = (windowHeight / zoom);
        const mapX = ((scrollX / zoom) / worldWidth) * canvas.width;
        const mapY = ((scrollY / zoom) / worldHeight) * canvas.height;
        const mapW = (viewW / worldWidth) * canvas.width;
        const mapH = (viewH / worldHeight) * canvas.height;

        const isInside = mx >= mapX && mx <= mapX + mapW && my >= mapY && my <= mapY + mapH;

        if (isInside) {
            const centerX = mapX + mapW / 2;
            const centerY = mapY + mapH / 2;
            setDragOffset({
                x: mx - centerX,
                y: my - centerY
            });
        } else {
            setDragOffset({ x: 0, y: 0 });
            const worldX = (mx / canvas.width) * worldWidth;
            const worldY = (my / canvas.height) * worldHeight;
            propsRef.current.onNavigate(worldX, worldY);
        }

        setIsDragging(true);
        onDragStart?.();
    };

    // Handle Drag Move
    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging || !canvasRef.current) return;
            e.preventDefault();

            let clientX, clientY;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = (e as MouseEvent).clientX;
                clientY = (e as MouseEvent).clientY;
            }

            const canvas = canvasRef.current;
            const rect = canvas.getBoundingClientRect();
            const mx = clientX - rect.left;
            const my = clientY - rect.top;
            
            const { worldWidth, worldHeight } = propsRef.current;

            const targetCx = mx - dragOffset.x;
            const targetCy = my - dragOffset.y;

            const worldX = (targetCx / canvas.width) * worldWidth;
            const worldY = (targetCy / canvas.height) * worldHeight;

            propsRef.current.onNavigate(worldX, worldY);
        };

        const handleGlobalUp = () => {
            setIsDragging(false);
            onDragEnd?.();
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleGlobalMove, { passive: false });
            window.addEventListener('mouseup', handleGlobalUp);
            window.addEventListener('touchmove', handleGlobalMove, { passive: false });
            window.addEventListener('touchend', handleGlobalUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMove);
            window.removeEventListener('mouseup', handleGlobalUp);
            window.removeEventListener('touchmove', handleGlobalMove);
            window.removeEventListener('touchend', handleGlobalUp);
        };
    }, [isDragging, dragOffset]);

    // Layout Shift Calculation
    // If panel is open (width 500px) and window > 768 (md), shift left by ~510px
    const shouldShift = isPanelOpen && windowWidth > 768;
    const shiftStyle = shouldShift ? { transform: 'translateX(-510px)' } : {};

    return (
        <div 
            className="fixed bottom-6 right-6 z-50 select-none transition-transform duration-300 ease-in-out"
            style={shiftStyle}
        >
            {/* Container */}
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 bg-neutral-950/90 border border-white/20 shadow-[0_0_40px_rgba(0,0,0,0.8)] rounded-lg backdrop-blur-sm">
                
                {/* Layer 0: Audio Visualizer (Centered, constrained height) */}
                <div className="absolute top-1/2 left-0 w-full h-16 -translate-y-1/2 opacity-40 pointer-events-none">
                     <AudioVisualizer 
                        isActive={!isMuted} 
                        techScore={techScore} 
                        musicScore={musicScore} 
                    />
                </div>

                {/* Layer 1: Canvas Map */}
                <canvas 
                    ref={canvasRef} 
                    width={256} 
                    height={256} 
                    className="absolute inset-0 w-full h-full cursor-crosshair touch-none z-10"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        handleMouseDown(e.clientX, e.clientY);
                    }}
                    onTouchStart={(e) => {
                        e.preventDefault(); 
                        handleMouseDown(e.touches[0].clientX, e.touches[0].clientY);
                    }}
                />

                {/* Layer 2: Coordinate Scanners (Thin Bars) */}
                
                {/* Tech: Bottom Bar */}
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-neutral-800 overflow-hidden z-20">
                    <div 
                        className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,1)]"
                        style={{ width: `${techScore}%` }}
                    />
                </div>
                {/* Tech Label (Floating above bar) */}
                <div className="absolute bottom-1.5 left-1 z-20 flex items-center gap-1 pointer-events-none">
                    <span className="text-[10px] font-bold text-neutral-500 tracking-widest">TECH</span>
                    <span className="text-[10px] font-mono text-blue-300 min-w-[20px]">{Math.round(techScore)}</span>
                </div>

                {/* Music: Right Bar */}
                <div className="absolute top-0 right-0 h-full w-0.5 bg-neutral-800 overflow-hidden z-20">
                     <div 
                        className="w-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,1)] absolute bottom-0"
                        style={{ height: `${musicScore}%` }}
                    />
                </div>
                {/* Music Label (Floating left of bar) */}
                <div className="absolute top-1 right-2 z-20 flex items-center gap-1 pointer-events-none">
                    <span className="text-[10px] font-mono text-purple-300 min-w-[20px] text-right">{Math.round(musicScore)}</span>
                    <span className="text-[10px] font-bold text-neutral-500 tracking-widest">MUSIC</span>
                </div>

                {/* Audio Toggle (Bottom Right, inside container to keep unit cohesive, but accessible) */}
                <div className="absolute bottom-2 right-3 z-30 flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleMute(e);
                        }}
                        className="p-2 group opacity-50 hover:opacity-100 transition-opacity"
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-neutral-400 group-hover:text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75 19.5 12m0 0 2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6 4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                            </svg>
                        ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-400 group-hover:text-green-300 shadow-[0_0_10px_rgba(74,222,128,0.5)]">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
                        </svg>
                        )}
                    </button>
                </div>
            </div>

        </div>
    );
};