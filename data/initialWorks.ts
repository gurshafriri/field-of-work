import { Project } from "../types";
import { RAW_NOTION_DATA } from "../constants";

// Migration helper to convert old Notion data to new clean format
// We only run this if we don't have a works.json (simulated here)
export const INITIAL_PROJECTS: Project[] = RAW_NOTION_DATA.results.map((page) => {
    const techScore = page.properties['Tech score']?.number || 50;
    const artScore = page.properties['Art score']?.number || 50;
    const title = page.properties.Name.title.map((t) => t.plain_text).join('') || 'Untitled';
    const type = page.properties.Type?.multi_select?.[0]?.name || '';
    const tags = page.properties['Tags ']?.multi_select?.map(t => t.name) || [];

    // Add type to tags if not present
    if (type && !tags.includes(type)) {
        tags.unshift(type);
    }

    return {
        id: page.id,
        title,
        description: `A project about **${title}**. (Edit this description in the Admin panel)`,
        techScore,
        artScore,
        imageUrl: '', // Placeholder
        link: page.url,
        tags: tags,
        audioUrl: '',
        videoUrl: '',
        scoreUrl: ''
    };
});