import React from 'react';
import { ProcessedProject } from '../types';

interface ProjectDetailPanelProps {
    project: ProcessedProject | null;
    onClose: () => void;
}

export const ProjectDetailPanel: React.FC<ProjectDetailPanelProps> = ({ project, onClose }) => {
    if (!project) return null;

    // specific handling for base url to ensure media loads in subdirectories
    const baseUrl = import.meta.env?.BASE_URL || '/';
        
    const mediaPath = (filename: string) => {
        if (!filename) return '';
        const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
        return `${baseUrl}media/${cleanFilename}`.replace('//', '/');
    };

    // Helper to ensure YouTube/Drive links are embeddable if manually pasted
    const getEmbedUrl = (url: string) => {
        if (!url) return null;
        
        // Handle YouTube Watch URLs
        if (url.includes('youtube.com/watch?v=')) {
            return url.replace('watch?v=', 'embed/');
        }
        // Handle YouTube Short URLs
        if (url.includes('youtu.be/')) {
            return url.replace('youtu.be/', 'youtube.com/embed/');
        }
        // Handle Google Drive View URLs
        if (url.includes('drive.google.com') && url.includes('/view')) {
            return url.replace('/view', '/preview');
        }
        
        return url;
    };

    const embedUrl = getEmbedUrl(project.videoUrl || '');

    return (
        <div className="fixed inset-y-0 right-0 z-[60] w-full md:w-[500px] bg-neutral-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl transform transition-transform duration-300 overflow-y-auto">
            
            {/* Close Button */}
            <button 
                onClick={onClose}
                className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/10 transition-all hover:scale-110"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Hero Media Section: Video > Image > Placeholder */}
            <div className="w-full aspect-video bg-black relative border-b border-white/10">
                {embedUrl ? (
                    <iframe 
                        src={embedUrl} 
                        className="w-full h-full" 
                        title={project.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowFullScreen
                    ></iframe>
                ) : project.imageUrl ? (
                    <img 
                        src={mediaPath(project.imageUrl)} 
                        alt={project.title} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            // Fallback if image fails
                            (e.target as HTMLImageElement).style.display = 'none';
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-700 bg-neutral-900">
                        <div className="flex flex-col items-center gap-2">
                             <span className="text-4xl opacity-20">❖</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Container */}
            <div className="p-8 space-y-8">
                
                {/* Header */}
                <div className="space-y-3">
                    <h2 className="text-3xl font-light text-white tracking-tight">{project.title}</h2>
                    <div className="flex flex-wrap gap-2">
                        {project.tags.map((tag, i) => (
                             <span 
                                key={i} 
                                className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-white/10 text-blue-200 border border-white/5"
                             >
                                {tag}
                             </span>
                        ))}
                    </div>
                </div>

                {/* Audio Player */}
                {project.audioUrl && (
                    <div className="bg-neutral-800/40 rounded-xl p-4 border border-white/10">
                        <div className="text-[10px] text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span>Audio Recording</span>
                        </div>
                        <audio controls className="w-full h-8 opacity-80 hover:opacity-100 transition-opacity" controlsList="nodownload">
                            <source src={mediaPath(project.audioUrl)} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                )}

                {/* Description */}
                <div className="prose prose-invert prose-sm max-w-none text-neutral-300 leading-relaxed">
                     {project.description.split('\n').map((line, i) => (
                        <p key={i} className={line.trim() === '' ? 'h-4' : ''}>{line}</p>
                    ))}
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-white/10 flex flex-wrap gap-3">
                    {/* Link */}
                    {project.link && (
                        <a 
                            href={project.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/5"
                        >
                            <span>Visit Project</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                            </svg>
                        </a>
                    )}

                    {/* Full Score PDF */}
                    {project.scoreUrl && (
                        <div className="relative group">
                            <a 
                                href={mediaPath(project.scoreUrl)} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-12 h-12 bg-blue-900/30 hover:bg-blue-800/50 text-blue-300 border border-blue-500/30 rounded-lg transition-all"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                            </a>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-bold text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                Full Score
                            </div>
                        </div>
                    )}
                </div>

                 {/* Scores */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-neutral-800/20 rounded p-3 border border-white/5">
                        <div className="text-[10px] uppercase tracking-widest text-blue-400 mb-1">Technology</div>
                        <div className="text-xl font-mono text-white">{project.techScore}/100</div>
                    </div>
                    <div className="bg-neutral-800/20 rounded p-3 text-right border border-white/5">
                        <div className="text-[10px] uppercase tracking-widest text-purple-400 mb-1">Artistry</div>
                        <div className="text-xl font-mono text-white">{project.artScore}/100</div>
                    </div>
                </div>

            </div>
        </div>
    );
};