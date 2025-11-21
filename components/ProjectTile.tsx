import React from 'react';
import { ProcessedProject } from '../types';

interface ProjectTileProps {
    project: ProcessedProject;
    onClick: (project: ProcessedProject) => void;
}

export const ProjectTile: React.FC<ProjectTileProps> = ({ project, onClick }) => {
    return (
        <div 
            className="absolute rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl hover:scale-105 hover:border-blue-400/50 hover:z-50 transition-all duration-300 cursor-pointer group overflow-hidden flex flex-col"
            style={{
                left: `${project.x}%`,
                top: `${project.y}%`,
                width: '240px',
                height: '240px',
                transform: 'translate(-50%, -50%)'
            }}
            onClick={(e) => {
                e.stopPropagation();
                onClick(project);
            }}
        >
             {/* Background Image */}
             {project.imageUrl ? (
                <div className="absolute inset-0 z-0">
                    <div 
                        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                        style={{ backgroundImage: `url(/media/${project.imageUrl})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-transparent" />
                </div>
            ) : (
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
            )}
            
            {/* Content */}
            <div className="relative z-10 flex flex-col justify-between h-full p-5">
                
                <div className="flex flex-wrap gap-1.5">
                    {project.tags.slice(0, 2).map((tag, i) => (
                         <span 
                            key={i} 
                            className="text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-black/40 text-white/80 border border-white/10 backdrop-blur-sm"
                         >
                            {tag}
                         </span>
                    ))}
                </div>

                <div>
                    <h3 className="text-lg font-medium text-white leading-tight group-hover:text-blue-200 transition-colors drop-shadow-lg">
                        {project.title}
                    </h3>
                    
                    {/* Mini indicators for media availability */}
                    <div className="flex gap-2 mt-2 text-white/40">
                        {project.videoUrl && <span title="Video">▶️</span>}
                        {project.audioUrl && <span title="Audio">🔊</span>}
                        {project.scoreUrl && <span title="Score">🎼</span>}
                    </div>
                </div>
                
                {/* Bars */}
                <div className="w-full flex gap-2 items-end opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="flex-1 flex flex-col gap-1">
                        <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" style={{ width: `${project.techScore}%` }}></div>
                        </div>
                        <div className="h-1 bg-gray-700/50 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" style={{ width: `${project.artScore}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};