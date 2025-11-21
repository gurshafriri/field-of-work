export interface Project {
    id: string;
    title: string;
    description: string;
    artScore: number; // 0-100
    techScore: number; // 0-100
    imageUrl?: string;
    link: string;
    tags: string[];
    audioUrl?: string; // Filename in /media
    videoUrl?: string; // Embed URL (YouTube/Vimeo/Drive)
    scoreUrl?: string; // PDF filename in /media
}

// Derived state for the visualizer
export interface ProcessedProject extends Project {
    x: number; // 0-100% position for CSS
    y: number; // 0-100% position for CSS
}

export interface AudioState {
    isPlaying: boolean;
    x: number; // 0-1 normalized
    y: number; // 0-1 normalized
}

export interface NotionPage {
    id: string;
    url: string;
    properties: {
        "Art score"?: { number: number | null; [key: string]: any };
        "Type"?: { multi_select: { name: string; [key: string]: any }[]; [key: string]: any };
        "Tech score"?: { number: number | null; [key: string]: any };
        "Tags "?: { multi_select: { name: string; [key: string]: any }[]; [key: string]: any };
        "Name": { title: { plain_text: string; [key: string]: any }[]; [key: string]: any };
        [key: string]: any;
    };
}