import React from 'react';
import { ProcessedProject } from '../types';

interface ProjectTileProps {
    project: ProcessedProject;
    onClick: (url: string) => void;
}

export const ProjectTile: React.FC<ProjectTileProps> = ({ project, onClick }) => {
    return (
        <div 
            className="absolute p-6 rounded-2xl border border-white/10 bg-neutral-900/60 backdrop-blur-md shadow-2xl hover:scale-110 hover:border-white/40 hover:bg-neutral-800/80 hover:z-50 transition-all duration-300 cursor-pointer group flex flex-col items-start justify-between overflow-hidden"
            style={{
                left: `${project.x}%`,
                top: `${project.y}%`,
                width: '240px',
                height: '240px',
                transform: 'translate(-50%, -50%)'
            }}
            onClick={() => onClick(project.link)}
        >
             {/* Background Image if available */}
             {project.imageUrl && (
                <div 
                    className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity bg-cover bg-center z-0"
                    style={{ backgroundImage: `url(/media/${project.imageUrl})` }}
                />
            )}
            
            <div className="w-full z-10">
                <div className="flex flex-wrap gap-2 mb-3">
                    {project.tags.slice(0, 3).map((tag, i) => (
                         <span 
                            key={i} 
                            className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full bg-white/5 text-white/70 border border-white/5 backdrop-blur-md"
                         >
                            {tag}
                         </span>
                    ))}
                </div>
                <h3 className="text-xl font-medium text-white group-hover:text-blue-200 transition-colors drop-shadow-md">
                    {project.title}
                </h3>
            </div>
            
            <div className="w-full flex justify-between items-end opacity-40 group-hover:opacity-100 transition-opacity text-xs font-mono z-10">
                <div className="flex flex-col">
                    <span className="drop-shadow-md">TECH: {project.techScore}</span>
                    <div className="w-12 h-1 bg-gray-700 mt-1 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{ width: `${project.techScore}%` }}></div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className="drop-shadow-md">ART: {project.artScore}</span>
                    <div className="w-12 h-1 bg-gray-700 mt-1 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]" style={{ width: `${project.artScore}%` }}></div>
                    </div>
                </div>
            </div>
        </div>
    );
};