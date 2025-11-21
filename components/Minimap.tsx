import React, { useRef, useEffect, useState } from 'react';
import { ProcessedProject } from '../types';

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
    onNavigate
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Store offset from viewport center to mouse position to prevent jumping on drag start
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Keep latest props in refs to access them in event listeners without re-binding
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
            // Clear
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Background
            ctx.fillStyle = '#171717'; // neutral-900
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 1. Draw Projects
            projects.forEach(project => {
                const px = (project.x / worldWidth) * canvas.width;
                const py = (project.y / worldHeight) * canvas.height;

                const isTech = project.techScore > project.artScore;
                ctx.fillStyle = isTech ? 'rgba(59, 130, 246, 0.8)' : 'rgba(168, 85, 247, 0.8)';
                
                ctx.beginPath();
                ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                ctx.fill();
            });

            // 2. Draw Labels
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '9px monospace';
            ctx.textAlign = 'center';
            
            ctx.fillText('MORE ART', canvas.width / 2, 12);
            ctx.fillText('LESS ART', canvas.width / 2, canvas.height - 5);

            ctx.save();
            ctx.translate(10, canvas.height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText('LESS TECH', 0, 0);
            ctx.restore();

            ctx.save();
            ctx.translate(canvas.width - 5, canvas.height / 2);
            ctx.rotate(Math.PI / 2);
            ctx.fillText('MORE TECH', 0, 0);
            ctx.restore();

            // 3. Draw Viewport Rectangle
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

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(mapX, mapY, mapW, mapH);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
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

        // Current Viewport on Canvas
        const viewW = (windowWidth / zoom);
        const viewH = (windowHeight / zoom);
        const mapX = ((scrollX / zoom) / worldWidth) * canvas.width;
        const mapY = ((scrollY / zoom) / worldHeight) * canvas.height;
        const mapW = (viewW / worldWidth) * canvas.width;
        const mapH = (viewH / worldHeight) * canvas.height;

        // Check if click is inside current viewport rect
        const isInside = mx >= mapX && mx <= mapX + mapW && my >= mapY && my <= mapY + mapH;

        if (isInside) {
            // Calculate offset from center of rect to mouse
            // This ensures we drag from where we grabbed, rather than snapping center to mouse
            const centerX = mapX + mapW / 2;
            const centerY = mapY + mapH / 2;
            setDragOffset({
                x: mx - centerX,
                y: my - centerY
            });
        } else {
            // Clicked outside: Snap center to mouse immediately
            setDragOffset({ x: 0, y: 0 });
            // Immediate jump
            const worldX = (mx / canvas.width) * worldWidth;
            const worldY = (my / canvas.height) * worldHeight;
            propsRef.current.onNavigate(worldX, worldY);
        }

        setIsDragging(true);
    };

    // Handle Drag Move
    useEffect(() => {
        const handleGlobalMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging || !canvasRef.current) return;
            e.preventDefault(); // Stop scrolling/selection

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

            // Target Canvas Position (where we want the center to be)
            // MousePos - DragOffset
            const targetCx = mx - dragOffset.x;
            const targetCy = my - dragOffset.y;

            // Convert back to World Coordinates
            const worldX = (targetCx / canvas.width) * worldWidth;
            const worldY = (targetCy / canvas.height) * worldHeight;

            propsRef.current.onNavigate(worldX, worldY);
        };

        const handleGlobalUp = () => {
            setIsDragging(false);
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

    return (
        <div className="fixed bottom-6 right-6 w-48 h-48 sm:w-64 sm:h-64 bg-neutral-900/90 border border-white/20 rounded-lg overflow-hidden shadow-2xl backdrop-blur-sm z-50 cursor-crosshair touch-none">
            <canvas 
                ref={canvasRef} 
                width={256} 
                height={256} 
                className="w-full h-full"
                onMouseDown={(e) => {
                    e.preventDefault();
                    handleMouseDown(e.clientX, e.clientY);
                }}
                onTouchStart={(e) => {
                    e.preventDefault(); 
                    handleMouseDown(e.touches[0].clientX, e.touches[0].clientY);
                }}
            />
        </div>
    );
};