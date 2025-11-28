import React, { useMemo } from 'react';
import { ProcessedProject } from '../types';

interface TimelineDrawerProps {
    isOpen: boolean;
    projects: ProcessedProject[];
    onSelect: (project: ProcessedProject) => void;
    onToggle: () => void;
    highlightedProjectId: string | null;
}

export const TimelineDrawer: React.FC<TimelineDrawerProps> = ({ 
    isOpen, 
    projects, 
    onSelect, 
    onToggle,
    highlightedProjectId 
}) => {
    // Sort projects reverse chronologically
    const sortedProjects = useMemo(() => {
        const parseDate = (dateStr?: string) => {
            if (!dateStr) return 0;
            const [month, year] = dateStr.split('/').map(Number);
            const fullYear = year < 100 ? 2000 + year : year;
            return new Date(fullYear, month - 1).getTime();
        };

        return [...projects].sort((a, b) => parseDate(b.date) - parseDate(a.date));
    }, [projects]);

    const formatDisplayDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const [month, year] = dateStr.split('/').map(Number);
        if (!month || !year) return dateStr;
        
        const monthNames = [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];
        
        const fullYear = year < 100 ? 2000 + year : year;
        return `${monthNames[month - 1]}. ${fullYear}`;
    };

    return (
        <div 
            className={`fixed bottom-6 z-50 transition-transform duration-300 ease-out right-[calc(1.5rem+12rem+0.75rem)] sm:right-[calc(1.5rem+16rem+0.75rem)]
                ${isOpen 
                    ? 'translate-x-0 opacity-80' 
                    : 'translate-x-[calc(10rem-1.5rem)] sm:translate-x-[calc(12rem-1.5rem)] bg-transparent'
                }
            `}
        >
            {/* Main drawer container with integrated pull tab */}
            <div 
                className={`h-48 sm:h-64  backdrop-blur-sm flex overflow-hidden w-40 sm:w-48 border rounded-lg transition-[border-color,shadow, background-color] duration-300
                    ${isOpen 
                        ? 'bg-neutral-950/90 border border-white/20 rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.8)]' 
                        : 'border-transparent shadow-none bg-transparent'
                    }
                `}
            >
                {/* Vertical pull tab strip - floating when closed, connected when open */}
                <div 
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                    }}
                    className={`w-6 flex flex-col items-center justify-between py-2 bg-black/20 cursor-pointer hover:bg-white/5 shrink-0 border-white/20 transition-[border,shadow,border-radius] duration-300
                        ${isOpen 
                            ? 'border-r rounded-l-lg' 
                            : 'border rounded-lg shadow-[0_0_40px_rgba(0,0,0,0.8)] opacity-75'
                        }
                    `}
                >
                    {/* Rotated "Timeline" text - bottom to top */}
                    <div className="flex-1 flex items-left justify-left pb-1">
                        <span 
                            className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
                            style={{ 
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)'
                            }}
                        >
                            Timeline
                        </span>
                    </div>
                    
                    {/* Date icon at bottom */}
                    <div className="shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-neutral-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                    </div>
                </div>

                {/* Main drawer content - slides in/out */}
                <div 
                    className={`flex-1 flex flex-col transition-all duration-300
                        ${isOpen 
                            ? 'opacity-80 border-t border-b border-r border-white/20 rounded-r-lg' 
                            : 'opacity-0 pointer-events-none'
                        }
                    `}
                >
                    {/* Scrollable project list */}
                    <div className="overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1">
                        {sortedProjects.map((project) => {
                            const isSelected = highlightedProjectId === project.id;
                            
                            return (
                                <button
                                    key={project.id}
                                    onClick={() => onSelect(project)}
                                    className={`w-full text-left px-3 py-2 rounded transition-colors flex flex-col gap-0.5 group
                                        ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}
                                    `}
                                >
                                    <div className="flex justify-between items-center w-full">
                                        <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-400'}`}>
                                            {formatDisplayDate(project.date)}
                                        </span>
                                        {isSelected && <div className="w-1 h-1 rounded-full bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.8)]" />}
                                    </div>
                                    <span className={`text-xs truncate w-full ${isSelected ? 'text-neutral-300' : 'text-neutral-400 group-hover:text-neutral-300'}`}>
                                        {project.title}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

