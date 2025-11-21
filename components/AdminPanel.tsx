import React, { useState } from 'react';
import { Project } from '../types';

interface AdminPanelProps {
    projects: Project[];
    onUpdate: (projects: Project[]) => void;
    onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ projects, onUpdate, onClose }) => {
    const [localProjects, setLocalProjects] = useState<Project[]>(projects);
    const [selectedId, setSelectedId] = useState<string | null>(projects[0]?.id || null);

    const selectedProject = localProjects.find(p => p.id === selectedId);

    const handleFieldChange = (field: keyof Project, value: any) => {
        if (!selectedId) return;
        setLocalProjects(prev => prev.map(p => 
            p.id === selectedId ? { ...p, [field]: value } : p
        ));
    };

    const handleTagsChange = (value: string) => {
        const tags = value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        handleFieldChange('tags', tags);
    };

    const createNew = () => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            title: 'New Project',
            description: '',
            artScore: 50,
            techScore: 50,
            tags: [],
            link: '',
        };
        setLocalProjects([newProject, ...localProjects]);
        setSelectedId(newProject.id);
    };

    const deleteCurrent = () => {
        if (!selectedId || !confirm('Are you sure you want to delete this project?')) return;
        const newStart = localProjects.filter(p => p.id !== selectedId);
        setLocalProjects(newStart);
        setSelectedId(newStart[0]?.id || null);
    };

    const saveToFile = () => {
        const dataStr = JSON.stringify(localProjects, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = 'works.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        // Update app state
        onUpdate(localProjects);
        alert('1. "works.json" downloaded.\n2. Move this file to "src/data/works.json" to persist changes.');
    };

    return (
        <div className="fixed inset-0 z-[200] bg-neutral-900 text-white flex overflow-hidden font-sans">
            {/* Sidebar List */}
            <div className="w-64 border-r border-white/10 flex flex-col bg-neutral-900">
                <div className="p-4 border-b border-white/10 bg-neutral-800">
                    <h2 className="font-bold text-lg tracking-wide">Content Manager</h2>
                    <p className="text-xs text-neutral-400 mt-1">Local CMS</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {localProjects.map(p => (
                        <button
                            key={p.id}
                            onClick={() => setSelectedId(p.id)}
                            className={`w-full text-left px-3 py-2 rounded text-sm truncate transition-colors ${
                                selectedId === p.id ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:bg-white/5'
                            }`}
                        >
                            {p.title || 'Untitled'}
                        </button>
                    ))}
                </div>
                <div className="p-4 border-t border-white/10">
                    <button 
                        onClick={createNew}
                        className="w-full py-2 bg-green-600 hover:bg-green-500 rounded text-xs font-bold uppercase tracking-wider mb-2"
                    >
                        + Create New
                    </button>
                    <button 
                        onClick={onClose}
                        className="w-full py-2 bg-neutral-700 hover:bg-neutral-600 rounded text-xs font-bold uppercase tracking-wider"
                    >
                        Exit
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-neutral-900/50">
                {selectedProject ? (
                    <div className="flex-1 overflow-y-auto p-8 max-w-3xl mx-auto w-full">
                        <div className="flex justify-between items-center mb-8">
                            <h1 className="text-2xl font-light">Edit Project</h1>
                            <div className="flex gap-3">
                                <button 
                                    onClick={deleteCurrent}
                                    className="px-4 py-2 rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm"
                                >
                                    Delete
                                </button>
                                <button 
                                    onClick={saveToFile}
                                    className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 text-sm"
                                >
                                    Save to JSON
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            {/* Title */}
                            <div className="space-y-2">
                                <label className="block text-xs uppercase tracking-widest text-neutral-500">Title</label>
                                <input 
                                    type="text" 
                                    value={selectedProject.title}
                                    onChange={(e) => handleFieldChange('title', e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Scores */}
                            <div className="grid grid-cols-2 gap-8 p-6 bg-neutral-800/50 rounded-xl border border-white/5">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs uppercase tracking-widest text-blue-400">Tech Score</label>
                                        <span className="font-mono text-blue-400">{selectedProject.techScore}</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="100"
                                        value={selectedProject.techScore}
                                        onChange={(e) => handleFieldChange('techScore', parseInt(e.target.value))}
                                        className="w-full accent-blue-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs uppercase tracking-widest text-purple-400">Art Score</label>
                                        <span className="font-mono text-purple-400">{selectedProject.artScore}</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="100"
                                        value={selectedProject.artScore}
                                        onChange={(e) => handleFieldChange('artScore', parseInt(e.target.value))}
                                        className="w-full accent-purple-500"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div className="space-y-2">
                                <label className="block text-xs uppercase tracking-widest text-neutral-500">Markdown Description</label>
                                <textarea 
                                    value={selectedProject.description}
                                    onChange={(e) => handleFieldChange('description', e.target.value)}
                                    rows={6}
                                    className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors font-mono text-sm"
                                />
                            </div>

                            {/* Tags */}
                            <div className="space-y-2">
                                <label className="block text-xs uppercase tracking-widest text-neutral-500">Tags (comma separated)</label>
                                <input 
                                    type="text" 
                                    value={selectedProject.tags.join(', ')}
                                    onChange={(e) => handleTagsChange(e.target.value)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                />
                            </div>

                            {/* Media & Links */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-xs uppercase tracking-widest text-neutral-500">Link URL (External)</label>
                                    <input 
                                        type="text" 
                                        value={selectedProject.link}
                                        onChange={(e) => handleFieldChange('link', e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs uppercase tracking-widest text-neutral-500">Image Filename (in /public/media/)</label>
                                    <input 
                                        type="text" 
                                        placeholder="example.jpg"
                                        value={selectedProject.imageUrl || ''}
                                        onChange={(e) => handleFieldChange('imageUrl', e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs uppercase tracking-widest text-neutral-500">Video Embed Link (YouTube/Drive)</label>
                                    <input 
                                        type="text" 
                                        placeholder="https://www.youtube.com/embed/..."
                                        value={selectedProject.videoUrl || ''}
                                        onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs uppercase tracking-widest text-neutral-500">Audio Filename (in /media/)</label>
                                    <input 
                                        type="text" 
                                        placeholder="track.mp3"
                                        value={selectedProject.audioUrl || ''}
                                        onChange={(e) => handleFieldChange('audioUrl', e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-xs uppercase tracking-widest text-neutral-500">Score Filename (PDF in /media/)</label>
                                    <input 
                                        type="text" 
                                        placeholder="score.pdf"
                                        value={selectedProject.scoreUrl || ''}
                                        onChange={(e) => handleFieldChange('scoreUrl', e.target.value)}
                                        className="w-full bg-neutral-800 border border-white/10 rounded p-3 focus:border-blue-500 focus:outline-none transition-colors"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-neutral-500">
                        Select a project to edit
                    </div>
                )}
            </div>
        </div>
    );
};