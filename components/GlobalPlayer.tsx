import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { ProcessedProject } from '../types';

interface GlobalAudioControllerProps {
    project: ProcessedProject;
    isPlaying: boolean;
    volume?: number;
    onTimeUpdate: (progress: number, currentTime: number, duration: number) => void;
    onEnded: () => void;
}

export interface GlobalAudioHandle {
    seek: (time: number) => void;
}

export const GlobalPlayer = forwardRef<GlobalAudioHandle, GlobalAudioControllerProps>(
    ({ project, isPlaying, onTimeUpdate, onEnded }, ref) => {
        const audioRef = useRef<HTMLAudioElement>(null);
        
        const baseUrl = import.meta.env?.BASE_URL || '/';
        
        const isAbsolute = project.audioUrl?.startsWith('http');
        const cleanPath = project.audioUrl?.startsWith('/') ? project.audioUrl.slice(1) : project.audioUrl;
        
        const audioSrc = (isAbsolute 
            ? project.audioUrl 
            : `${baseUrl}media/${cleanPath}`.replace('//', '/')) || '';

        // Expose seek method to parent
        useImperativeHandle(ref, () => ({
            seek: (time: number) => {
                if (audioRef.current) {
                    audioRef.current.currentTime = time;
                }
            }
        }));

        // Handle Source Change
        useEffect(() => {
            if (audioRef.current) {
                // Determine if we are just remounting the same track or switching
                const currentSrc = audioRef.current.getAttribute('src');
                if (currentSrc !== audioSrc) {
                    audioRef.current.src = audioSrc;
                    audioRef.current.load();
                }
                
                if (isPlaying) {
                    audioRef.current.play().catch(e => console.warn("Autoplay blocked", e));
                }
            }
        }, [audioSrc]);

        // Handle Play/Pause State
        useEffect(() => {
            if (!audioRef.current) return;
            if (isPlaying) {
                audioRef.current.play().catch(e => console.error("Play failed", e));
            } else {
                audioRef.current.pause();
            }
        }, [isPlaying]);

        const handleTimeUpdate = () => {
            if (audioRef.current) {
                const duration = audioRef.current.duration || 1;
                const progress = (audioRef.current.currentTime / duration) * 100;
                onTimeUpdate(progress, audioRef.current.currentTime, duration);
            }
        };

        return (
            <audio 
                ref={audioRef}
                className="hidden"
                onTimeUpdate={handleTimeUpdate}
                onEnded={onEnded}
            />
        );
    }
);

GlobalPlayer.displayName = 'GlobalAudioController';