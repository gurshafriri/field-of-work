import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Replace 'YOUR_REPO_NAME' with your actual GitHub repository name.
  // Example: if your repo is https://github.com/gur/portfolio, use '/portfolio/'
  base: '/gurs-creative-field/',
})