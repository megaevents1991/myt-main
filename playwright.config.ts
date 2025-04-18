import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  webServer: {
    command: 'npm run build && npm start',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    headless: true,
  },
})