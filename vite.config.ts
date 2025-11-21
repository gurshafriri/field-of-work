/// <reference types="node" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'YOUR_REPO_NAME' with your actual GitHub repository name.
  // If deploying to the root of a domain, use '/'
  // If deploying to github pages user.github.io/repo/, use '/repo/'
  base: '/gurs-creative-field/', 
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})