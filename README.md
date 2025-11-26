# Gur's works portfolio: The Creative Field

A spatial, audio-visual portfolio experiment that maps creative works onto a 2D plane defined by **Technicality** (X-axis) and **Artistic Expression** (Y-axis).

<img width="1888" height="986" alt="image" src="https://github.com/user-attachments/assets/df0f0a4a-5720-4cc2-b3a5-1a39d77774ec" />

## Concept

This project reimagines the traditional portfolio list as an interactive "field" of creativity. Works are not just listed; they inhabit a specific coordinate in the Art/Tech spectrum.

-   **X-Axis (Technology)**: Ranges from purely acoustic/analogue (Left) to highly digital/algorithmic (Right).
-   **Y-Axis (Art)**: Ranges from functional tools (Bottom) to pure artistic expression (Top).

As you navigate this field, the custom audio engine procedurally generates a soundscape that reflects your current position—becoming more synthetic and glitchy as you move towards "Tech", and more harmonic or flowing as you move towards "Art".

## Key Features

### 🌌 Spatial Interface
-   **Infinite Canvas**: Users explore a 3000x3000px virtual world.
-   **Physics-Based Layout**: A custom force-directed algorithm distributes project nodes to prevent overlaps while respecting their specific coordinate scores.
-   **Smooth Navigation**: Drag-to-pan and button-controlled zoom functionality.

### 🔊 Procedural Audio Engine
Built directly on the **Web Audio API**, the engine synthesizes sound in real-time based on viewport coordinates:
-   **Left (Low Tech)**: Warm, analogue oscillators and drone textures.
-   **Right (High Tech)**: Digital filters, delays, and high-frequency modulation.
-   **Y-Axis Modulation**: Controls pitch harmony and LFO speeds.

### 📊 Reactive HUD
-   **Audio Visualizer**: A real-time oscilloscope that morphs its shape based on the audio parameters (Smooth sine waves for Art vs. Jagged/Noise for Tech).
-   **Minimap**: A live overview of the entire field and viewport location.
-   **Coordinate Scanner**: Displays the exact Art/Tech score of the current center point.

### 🛠️ Local Content Management
Includes a hidden "Admin Mode" to manage portfolio content without a database.
-   Add, Edit, and Delete projects via a GUI.
-   Export data to JSON to persist changes in the codebase.

## Tech Stack

-   **Framework**: [React](https://react.dev/) (TypeScript)
-   **Build Tool**: [Vite](https://vitejs.dev/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Audio**: Native Web Audio API (No external libraries)
-   **Graphics**: HTML5 Canvas (Minimap & Visualizer)

## Getting Started

### Prerequisites
-   Node.js (v18 or higher)
-   npm

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/gurshafriri/gurs-creative-field.git
    cd gurs-creative-field
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

4.  Open `http://localhost:5173` to view the app.

## Administration (Adding Projects)

Since this is a static site, content is managed via a JSON file (`public/works.json`). The app includes a helper utility to generate this file.

1.  **Enter Admin Mode**: Append `#admin` to your URL (e.g., `http://localhost:5173/#admin`).
2.  **Manage Content**: Use the sidebar to add new projects or edit existing ones.
    -   *Tech Score (0-100)*: Determines X position.
    -   *Art Score (0-100)*: Determines Y position.
    -   *Media*: Reference files located in `public/media/`.
3.  **Save**: Click **"Save to JSON"**. This will download a `works.json` file.
4.  **Persist**: Move the downloaded file to `public/works.json`, overwriting the old one.
5.  **Commit**: Push the changes to GitHub.

## Deployment

The project is configured for **GitHub Pages**.

1.  Ensure `vite.config.ts` has the correct `base` url (e.g., `/repo-name/`).
2.  Push changes to the `main` branch.
3.  The GitHub Action (`.github/workflows/deploy.yml`) will automatically build and deploy the site.