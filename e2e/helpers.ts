import { expect, type Page } from '@playwright/test'

export const SPRINTER = 'Mercedes-Benz Sprinter 144" WB High roof'

/** Create a project and land in the editor with the canvas ready. */
export async function createProject(
  page: Page,
  name: string,
  van: string = SPRINTER,
): Promise<string> {
  await page.goto('/projects')
  await page.getByLabel('Name').fill(name)
  await page.locator('select').first().selectOption({ label: van })
  await page.getByRole('button', { name: 'Create' }).click()

  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await page.locator('svg.editor-canvas').waitFor()
  await settle(page)

  return page.url().split('/').pop()!
}

/**
 * Wait for the editor to stop moving.
 *
 * The canvas fits itself to the viewport after the van model arrives, so an
 * assertion fired too early reads a viewBox that is about to change.
 */
export async function settle(page: Page): Promise<void> {
  await expect(page.locator('svg.editor-canvas')).toBeVisible()
  await page.waitForTimeout(600)
}

/** Place a catalog item by name. */
export async function placeItem(page: Page, name: string | RegExp): Promise<void> {
  const pattern = typeof name === 'string' ? new RegExp(escapeRegExp(name), 'i') : name
  await page.getByRole('button', { name: pattern }).first().click()
  await page.waitForTimeout(250)
}

/** Objects currently drawn on the canvas. */
export function shapes(page: Page) {
  return page.locator('svg.editor-canvas polygon')
}

/** Finding headlines in the checks panel. */
export async function findings(page: Page): Promise<string[]> {
  return page.locator('ul li p.font-medium').allTextContents()
}

/** Read the project straight from the API, to check what actually persisted. */
export async function fetchProject(page: Page, id: string) {
  return page.evaluate(async (projectId) => {
    const response = await fetch(`/api/projects/${projectId}`)
    return response.json() as Promise<{
      project: { revision: number; lastSyncId: string | null }
      objects: Array<{ id: string; name: string }>
    }>
  }, id)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Scope a locator to one panel.
 *
 * Several panels legitimately mention the same thing — a custom piece names its
 * origin both in the inspector and in the items list — so assertions have to say
 * which one they mean rather than relying on there being only one.
 */
export function panel(page: Page, title: string) {
  // Not an exact match: some panel headings carry a count or a total alongside
  // the name, which is a legitimate thing for them to do.
  return page.locator('section.panel').filter({
    has: page.getByRole('heading', { name: title }),
  })
}
