import React, { useEffect, useRef, useState } from 'react';
import { ProcessedProject } from '../types';

interface ProjectDetailPanelProps {
    project: ProcessedProject | null;
    currentPlaying: ProcessedProject | null;
    isPlaying?: boolean;
    audioProgress?: number;
    audioDuration?: number;
    audioCurrentTime?: number;
    onClose: () => void;
    onMuteRequest: () => void;
    onPlayAudio: (p: ProcessedProject) => void;
    onTogglePlay?: (play: boolean) => void;
    onSeek?: (time: number) => void;
}

// Basic Markdown Parser for Bold and Italics
const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
        // Split by bold syntax **text**
        const parts = line.split(/(\*\*.*?\*\*|\*.*?\*)/g);
        
        const content = parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={i} className="italic text-neutral-300">{part.slice(1, -1)}</em>;
            }
            return part;
        });

        return (
            <p key={lineIdx} className={`leading-relaxed ${line.trim() === '' ? 'h-4' : 'mb-2'}`}>
                {content}
            </p>
        );
    });
};

// Helper for MM:SS format
const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const ProjectDetailPanel: React.FC<ProjectDetailPanelProps> = ({ 
    project, 
    currentPlaying, 
    isPlaying,
    audioProgress = 0,
    audioDuration = 0,
    audioCurrentTime = 0,
    onClose, 
    onMuteRequest, 
    onPlayAudio,
    onTogglePlay,
    onSeek
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [localDuration, setLocalDuration] = useState(0);

    // Monitor for when the iframe grabs focus
    useEffect(() => {
        if (!project) return;

        const handleWindowBlur = () => {
            if (document.activeElement === iframeRef.current) {
                onMuteRequest();
            }
        };

        window.addEventListener('blur', handleWindowBlur);
        return () => window.removeEventListener('blur', handleWindowBlur);
    }, [project, onMuteRequest]);

    // Pre-fetch duration for display if audio exists
    useEffect(() => {
        setLocalDuration(0); // Reset on change
        if (!project?.audioUrl) return;

        // If we are already playing this track, we don't need to fetch
        if (currentPlaying?.id === project.id && audioDuration > 0) {
            return; 
        }

        const baseUrl = import.meta.env?.BASE_URL || '/';
        const cleanFilename = project.audioUrl.startsWith('/') ? project.audioUrl.slice(1) : project.audioUrl;
        const src = `${baseUrl}media/${cleanFilename}`.replace('//', '/');

        const audio = new Audio(src);
        audio.preload = 'metadata';
        
        const onLoadedMetadata = () => {
             if (isFinite(audio.duration)) {
                setLocalDuration(audio.duration);
             }
        };

        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        return () => {
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.src = ''; // Cleanup
        };
    }, [project?.audioUrl, project?.id]); // Re-run when project changes

    if (!project) return null;

    const baseUrl = import.meta.env?.BASE_URL || '/';
        
    const mediaPath = (filename: string) => {
        if (!filename) return '';
        const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
        return `${baseUrl}media/${cleanFilename}`.replace('//', '/');
    };

    // Helper to ensure YouTube/Drive links are embeddable
    const getEmbedUrl = (url: string) => {
        if (!url) return null;
        if (url.includes('youtube.com/watch?v=')) return url.replace('watch?v=', 'embed/');
        if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'youtube.com/embed/');
        if (url.includes('drive.google.com') && url.includes('/view')) return url.replace('/view', '/preview');
        return url;
    };

    const embedUrl = getEmbedUrl(project.videoUrl || '');

    // Icon Helpers
    const getLinkIcon = (url: string) => {
        if (url.includes('github.com')) {
            return (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
            );
        }
        if (url.includes('bandcamp.com')) {
            return (
                 <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M22 6l-6.05 12h-13.5l6.05-12h13.5z" />
                </svg>
            );
        }
        // Default Globe with Arrow
        return (
            <div className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S12 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S12 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3 -mt-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                </svg>
            </div>
        );
    };

    const isCurrentTrack = currentPlaying?.id === project.id;
    // If it's the current track, use the App's definitive duration, otherwise use local metadata
    const durationToDisplay = (isCurrentTrack && audioDuration > 0) ? audioDuration : localDuration;

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

            {/* Hero Media Section */}
            <div className="w-full aspect-video bg-black relative border-b border-white/10">
                {embedUrl ? (
                    <iframe 
                        ref={iframeRef}
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
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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
            <div className="p-8 space-y-8 pb-32">
                
                {/* Header */}
                <div className="space-y-3">
                    <div className="flex justify-between items-start">
                        <h2 className="text-3xl font-light text-white tracking-tight">{project.title}</h2>
                        {project.date && (
                            <span className="text-xs font-mono text-neutral-500 mt-2 border border-white/10 px-2 py-1 rounded">{project.date}</span>
                        )}
                    </div>
                    
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

                {/* Audio Player Controls */}
                {project.audioUrl && (
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center gap-4">
                        
                        {/* Play/Pause Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isCurrentTrack && onTogglePlay) {
                                    onTogglePlay(!isPlaying);
                                } else {
                                    onPlayAudio(project);
                                }
                            }}
                            className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 transition-all duration-300
                                ${isCurrentTrack && isPlaying
                                    ? 'bg-neutral-100 text-black shadow-lg shadow-white/10'
                                    : 'bg-white/10 text-white hover:bg-white/20'
                                }
                            `}
                        >
                             {isCurrentTrack && isPlaying ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-3 h-3">
                                    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 ml-0.5">
                                    <path fillRule="evenodd" d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>

                        {/* Progress Bar & Info */}
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-neutral-500 font-medium mb-3">
                                 <span>Audio recording</span>
                                 <span className="font-mono text-neutral-400">
                                    {isCurrentTrack ? formatTime(audioCurrentTime) : "0:00"} / {formatTime(durationToDisplay)}
                                </span>
                            </div>
                            
                            <div className="relative h-1 w-full bg-neutral-800 rounded-full group">
                                {/* Fill */}
                                <div 
                                    className="absolute top-0 left-0 h-full bg-white/80 rounded-full transition-all duration-100 ease-linear"
                                    style={{ width: `${isCurrentTrack ? (audioProgress || 0) : 0}%` }}
                                />
                                
                                {/* Interactive Input */}
                                <input 
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={isCurrentTrack ? (audioProgress || 0) : 0}
                                    onChange={(e) => {
                                        if (isCurrentTrack && onSeek && audioDuration) {
                                            const percent = parseFloat(e.target.value);
                                            const time = (percent / 100) * audioDuration;
                                            onSeek(time);
                                        }
                                    }}
                                    disabled={!isCurrentTrack}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                
                                {/* Hover Effect - Hitbox expansion */}
                                <div className="absolute inset-0 -top-2 -bottom-2" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Description (Markdown Supported) */}
                <div className="prose prose-invert prose-sm max-w-none text-neutral-300">
                     {renderMarkdown(project.description)}
                </div>

                {/* Actions & Scores Row */}
                <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-6">
                    
                    {/* Icons Area */}
                    <div className="flex gap-4">
                         {/* External Link */}
                        {project.link && (
                            <a 
                                href={project.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/5 hover:scale-110"
                                title="Visit Project"
                            >
                                {getLinkIcon(project.link)}
                            </a>
                        )}

                        {/* Full Score PDF */}
                        {project.scoreUrl && (
                            <a 
                                href={mediaPath(project.scoreUrl)} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="relative group p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/5 hover:scale-110 flex items-center justify-center"
                                title="Full Score"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m9 13.5 3 3m0 0 3-3m-3 3v-6" opacity="0.5" />
                                </svg>
                                {/* Musical Note Overlay */}
                                <div className="absolute -bottom-1 -right-1 bg-neutral-900 rounded-full p-0.5 border border-white/20">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-blue-300">
                                        <path fillRule="evenodd" d="M19.952 1.651a.75.75 0 0 1 .298.599V16.303a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V6.994l-9 2.572v9.737a3 3 0 0 1-2.176 2.884l-1.32.377a2.553 2.553 0 1 1-1.403-4.909l2.311-.66a1.5 1.5 0 0 0 1.088-1.442V9.017 5.25a.75.75 0 0 1 .544-.721l10.5-3a.75.75 0 0 1 .658.122Z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            </a>
                        )}
                    </div>

                    {/* Minimal Scores */}
                    <div className="flex-1 flex flex-col gap-2 max-w-[180px]">
                         <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-neutral-500 w-8 text-right">TECH</span>
                            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500/80" style={{ width: `${project.techScore}%` }}></div>
                            </div>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-neutral-500 w-8 text-right">MUSIC</span>
                            <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500/80" style={{ width: `${project.musicScore}%` }}></div>
                            </div>
                         </div>
                    </div>

                </div>

            </div>
        </div>
    );
};