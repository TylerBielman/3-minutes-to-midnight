import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    // The game, and the round designer for the Rounds trial (docs/DECISIONS.md U44).
    rollupOptions: { input: { main: 'index.html', designer: 'designer.html' } },
  },
});
