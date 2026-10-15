import { defineConfig } from '@playwright/test'

const isWindows = process.platform === 'win32'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    launchOptions: isWindows ? { channel: 'msedge' } : undefined,
    trace: 'retain-on-failure',
  },
  globalSetup: './e2e/global-setup.ts',
})
