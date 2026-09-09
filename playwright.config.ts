import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests.
 *
 * These exist because the unit tests cannot see the things that actually broke
 * during the build: a stale object list making the catalog drop items on top of
 * each other, a `sendBeacon` flush that raised a conflict against the user's own
 * save, panels clipped out of the layout. All of those pass a typecheck happily.
 *
 * They drive the real app against the real database, so they need `.env.local`
 * and a seeded Neon branch — the same setup `npm run dev` needs. Run them with
 * `npm run test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  // The specs share one account and one project list, so they must not race.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  /*
   * The behaviours under test — custom pieces, sync, van corrections — are the
   * same whatever the screen is; only the way you reach them differs. So the
   * bulk of the suite runs once, on a desktop viewport, and the mobile project
   * covers what is genuinely different: the tabbed layout and a touch-sized
   * canvas. Running everything twice would double the runtime for almost no
   * extra signal.
   */
  projects: [
    {
      name: 'desktop',
      testIgnore: 'mobile/**',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 1000 } },
    },
    {
      name: 'mobile',
      testMatch: 'mobile/**/*.spec.ts',
      use: { ...devices['Pixel 7'] },
    },
  ],

  // Boots Vite and the API together, exactly as development does.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
