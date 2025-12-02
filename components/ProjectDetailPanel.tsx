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
    onViewScore: (url: string) => void;
}

// Basic Markdown Parser for Bold, Italics, and Links
const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
        // Split by link [text](url), bold **text**, and italic *text*
        // Note: We use \*(?!\*) to ensure we don't match '**' as start of italics
        const parts = line.split(/(\[.*?\]\(.*?\)|\*\*.*?\*\*|\*(?!\*).*?\*)/g);
        
        const content = parts.map((part, i) => {
            if (part.startsWith('[') && part.endsWith(')')) {
                const match = part.match(/^\[(.*?)\]\((.*?)\)$/);
                if (match) {
                    return (
                        <a 
                            key={i} 
                            href={match[2]} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/30 transition-colors"
                        >
                            {match[1]}
                        </a>
                    );
                }
            }
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
    onSeek,
    onViewScore
}) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [localDuration, setLocalDuration] = useState(0);
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);

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

    // Handle ESC key to close image modal
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isImageModalOpen) {
                setIsImageModalOpen(false);
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isImageModalOpen]);

    // Pre-fetch duration for display if audio exists
    useEffect(() => {
        setLocalDuration(0); // Reset on change
        if (!project?.audioUrl) return;

        // 1. If we have a hardcoded duration in the JSON, use it immediately (Best Performance)
        if (project.duration) {
            setLocalDuration(project.duration);
            return;
        }

        // If we are already playing this track, we don't need to fetch
        if (currentPlaying?.id === project.id && audioDuration > 0) {
            return; 
        }

        const baseUrl = import.meta.env?.BASE_URL || '/';
        
        const isAbsolute = project.audioUrl.startsWith('http');
        const cleanFilename = project.audioUrl.startsWith('/') ? project.audioUrl.slice(1) : project.audioUrl;
        
        const src = isAbsolute 
            ? project.audioUrl 
            : `${baseUrl}media/${cleanFilename}`.replace('//', '/');

        // OPTIMIZATION: Do NOT pre-fetch metadata for remote files (save Class A/B Ops)
        // Only pre-fetch for local files where it's cheap.
        if (isAbsolute) {
            // If no duration is provided in JSON, we accept showing 0:00 until played
            // to save costs. If explicit duration is needed, add it to works.json.
            return;
        }

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
        if (filename.startsWith('http')) return filename;
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
                    <div 
                        className="w-full h-full cursor-pointer group relative"
                        onClick={() => setIsImageModalOpen(true)}
                        title="Click to view full size"
                    >
                        <img 
                            src={mediaPath(project.imageUrl)} 
                            alt={project.title} 
                            className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {/* Expand icon hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                            <div className="bg-black/60 backdrop-blur-sm rounded-full p-3 border border-white/20">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-8 h-8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                </svg>
                            </div>
                        </div>
                    </div>
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
                    <div className="flex gap-2">
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
                            <button 
                                onClick={() => onViewScore(mediaPath(project.scoreUrl!))}
                                className="relative group w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all border border-white/5 hover:scale-110 flex items-center justify-center cursor-pointer"
                                title="View Full Score"
                            >
                                <div className="relative w-6 h-6 flex-shrink-0">
                                    {/* PDF Icon (Red) */}
                                    <svg viewBox="0 0 309.267 309.267" className="w-full h-full shadow-sm" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>
                                        <g>
                                            <path style={{ fill: "#E2574C" }} d="M38.658,0h164.23l87.049,86.711v203.227c0,10.679-8.659,19.329-19.329,19.329H38.658c-10.67,0-19.329-8.65-19.329-19.329V19.329C19.329,8.65,27.989,0,38.658,0z"/>
                                            <path style={{ fill: "#B53629" }} d="M289.658,86.981h-67.372c-10.67,0-19.329-8.659-19.329-19.329V0.193L289.658,86.981z"/>
                                            <path style={{ fill: "#FFFFFF" }} d="M217.434,146.544c3.238,0,4.823-2.822,4.823-5.557c0-2.832-1.653-5.567-4.823-5.567h-18.44c-3.605,0-5.615,2.986-5.615,6.282v45.317c0,4.04,2.3,6.282,5.412,6.282c3.093,0,5.403-2.242,5.403-6.282v-12.438h11.153c3.46,0,5.19-2.832,5.19-5.644c0-2.754-1.73-5.49-5.19-5.49h-11.153v-16.903C204.194,146.544,217.434,146.544,217.434,146.544z M155.107,135.42h-13.492c-3.663,0-6.263,2.513-6.263,6.243v45.395c0,4.629,3.74,6.079,6.417,6.079h14.159c16.758,0,27.824-11.027,27.824-28.047C183.743,147.095,173.325,135.42,155.107,135.42z M155.755,181.946h-8.225v-35.334h7.413c11.221,0,16.101,7.529,16.101,17.918C171.044,174.253,166.25,181.946,155.755,181.946z M106.33,135.42H92.964c-3.779,0-5.886,2.493-5.886,6.282v45.317c0,4.04,2.416,6.282,5.663,6.282s5.663-2.242,5.663-6.282v-13.231h8.379c10.341,0,18.875-7.326,18.875-19.107C125.659,143.152,117.425,135.42,106.33,135.42z M106.108,163.158h-7.703v-17.097h7.703c4.755,0,7.78,3.711,7.78,8.553C113.878,159.447,110.863,163.158,106.108,163.158z"/>
                                        </g>
                                    </svg>
                                    
                                    {/* Music Note Overlay (Bottom Right) */}
                                    <div className="absolute -bottom-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow-md border border-neutral-200">
                                        <svg viewBox="0 0 24 24" fill="none" className="w-3 h-3">
                                            <path d="M9 19C9 20.6569 7.65685 22 6 22C4.34315 22 3 20.6569 3 19C3 17.3431 4.34315 16 6 16C7.65685 16 9 17.3431 9 19Z" stroke="#1C274C" strokeWidth="1.5"/>
                                            <path d="M21 17C21 18.6569 19.6569 20 18 20C16.3431 20 15 18.6569 15 17C15 15.3431 16.3431 14 18 14C19.6569 14 21 15.3431 21 17Z" stroke="#1C274C" strokeWidth="1.5"/>
                                            <path d="M9 19V8" stroke="#1C274C" strokeWidth="1.5"/>
                                            <path d="M20.25 11.5C20.25 11.9142 20.5858 12.25 21 12.25C21.4142 12.25 21.75 11.9142 21.75 11.5H20.25ZM21.75 11.5V6H20.25V11.5H21.75Z" fill="#1C274C"/>
                                            <path d="M15.7351 3.75466L11.7351 5.08799C10.4151 5.52801 9.75503 5.74801 9.37752 6.27179C9 6.79556 9 7.49128 9 8.88273V11.9997L21 7.99969V7.54939C21 5.01693 21 3.7507 20.1694 3.15206C19.3388 2.55341 18.1376 2.95383 15.7351 3.75466Z" stroke="#1C274C" strokeWidth="1.5" strokeLinecap="round"/>
                                        </svg>
                                    </div>
                                </div>
                            </button>
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

            {/* Full-Size Image Modal */}
            {isImageModalOpen && project.imageUrl && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
                    onClick={() => setIsImageModalOpen(false)}
                >
                    {/* Close button */}
                    <button 
                        onClick={() => setIsImageModalOpen(false)}
                        className="absolute top-4 right-4 z-50 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all hover:scale-110"
                        title="Close (ESC)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Image container */}
                    <div 
                        className="relative max-w-[95vw] max-h-[95vh] flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img 
                            src={mediaPath(project.imageUrl)} 
                            alt={project.title} 
                            className="max-w-full max-h-[95vh] object-contain shadow-2xl rounded-lg"
                        />
                    </div>

                    {/* Click anywhere hint */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-neutral-400 text-sm font-light">
                        Click anywhere or press ESC to close
                    </div>
                </div>
            )}
        </div>
    );
};