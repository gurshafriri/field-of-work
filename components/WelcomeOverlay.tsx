import React from 'react';

interface WelcomeOverlayProps {
    onStart: () => void;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onStart }) => {
    return (
        <div className="fixed top-0 left-0 w-screen h-[100dvh] z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm touch-none">
            <div className="max-w-md text-center space-y-8 p-8 border border-white/10 rounded-sm bg-neutral-900/50">
                <h1 className="text-4xl font-light tracking-tighter text-white-400">
                    Gur Shafriri - <span className="font-semibold bg-gradient-to-r from-purple-200 to-blue-200 text-transparent bg-clip-text">field</span> of work
                </h1>
                <p className="text-neutral-400 leading-relaxed">
                    Explore creative works by Gur Shafriri.<br/>
                    Navigate the field to discover works arranged by <span className="text-blue-300">Technicality</span> and <span className="text-purple-300">Artistic expression</span>.
                </p>
                
                <div className="flex justify-center gap-8 text-xs text-neutral-500 font-mono uppercase">
                    <div className="flex flex-col items-center">
                        <span className="text-xl mb-2">🖱️</span>
                        <span>Scroll to Move</span>
                    </div>
                    <div className="flex flex-col items-center">
                        <span className="text-xl mb-2">🎧</span>
                        <span>Use Headphones</span>
                    </div>
                </div>

                <button
                onClick={onStart}
                className="
                    group relative px-8 py-3 rounded-full
                    bg-neutral-200/15 text-neutral-100
                    font-semibold tracking-widest text-sm
                    border border-white/10
                    transition-all duration-300
                    hover:bg-neutral-200/25
                    hover:shadow-[0_0_26px_2px_rgba(180,150,255,0.35)]
                "
                >
                <span className="relative inline-block">
                    {/* Base text (always visible, no gradient) */}
                    <span className="block text-neutral-100">
                    Enter
                    </span>

                    {/* Gradient text overlay (fades in/out on hover) */}
                    <span
                    className="
                        pointer-events-none
                        absolute inset-0
                        bg-gradient-to-r from-purple-200 via-purple-100 to-blue-200
                        text-transparent bg-clip-text
                        opacity-0 group-hover:opacity-100
                        transition-opacity duration-300
                    "
                    >
                    Enter
                    </span>
                </span>
                </button>
            </div>
        </div>
    );
};