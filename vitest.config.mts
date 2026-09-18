import { defineConfig } from 'vitest/config'

/** Unit tests cover the pure core (src/core) and the course content; UI is checked in the running app. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
