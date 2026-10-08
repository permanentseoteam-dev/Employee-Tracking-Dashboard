import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/release/**",
        "**/dist/**",
        "**/employee-agent/**",
        "**/agent/**",
        "**/stitch_design_system/**",
        "**/supabase/**",
        "**/docs/**",
        "**/scripts/**",
        "**/*.exe",
        "**/*.pdb",
        "**/*.zip",
        "**/*.png",
        "**/*.ico",
        "**/.git/**",
        "**/code.html",
      ],
    },
  },
});
