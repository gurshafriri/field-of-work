import React, { useRef, useEffect } from 'react';
import { ProcessedProject } from '../types';

interface MinimapProps {
    scrollX: number; // pixels
    scrollY: number; // pixels
    worldWidth: number;
    worldHeight: number;
    windowWidth: number;
    windowHeight: number;
    projects: ProcessedProject[];
}

export const Minimap: React.FC<MinimapProps> = ({ 
    scrollX, 
    scrollY, 
    worldWidth, 
    worldHeight, 
    windowWidth, 
    windowHeight,
    projects 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const render = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Background
            ctx.fillStyle = 'rgba(10, 10, 10, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 1. Draw Projects
            projects.forEach(project => {
                // project.x and project.y are percentages (0-100)
                const px = (project.x / 100) * canvas.width;
                const py = (project.y / 100) * canvas.height;

                // Color based on score dominance
                const isTech = project.techScore > project.artScore;
                ctx.fillStyle = isTech ? 'rgba(59, 130, 246, 0.8)' : 'rgba(168, 85, 247, 0.8)';
                
                ctx.beginPath();
                ctx.arc(px, py, 2.5, 0, Math.PI * 2);
                ctx.fill();
            });

            // 2. Draw Viewport Rectangle
            // Calculate relative position and size
            const vx = (scrollX / worldWidth) * canvas.width;
            const vy = (scrollY / worldHeight) * canvas.height;
            const vw = (windowWidth / worldWidth) * canvas.width;
            const vh = (windowHeight / worldHeight) * canvas.height;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(vx, vy, vw, vh);

            // Fill viewport slightly to highlight active area
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.fillRect(vx, vy, vw, vh);
        };

        const animationId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationId);

    }, [scrollX, scrollY, worldWidth, worldHeight, windowWidth, windowHeight, projects]);

    return (
        <div className="fixed bottom-6 right-6 w-48 h-48 sm:w-64 sm:h-64 bg-neutral-900/90 border border-white/20 rounded-lg overflow-hidden shadow-2xl backdrop-blur-sm z-50 pointer-events-none">
            <canvas 
                ref={canvasRef} 
                width={256} 
                height={256} 
                className="w-full h-full"
            />
            <div className="absolute top-2 left-3 text-[10px] text-white/50 font-mono">
                MAP
            </div>
        </div>
    );
};