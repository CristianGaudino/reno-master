import { expect, test } from '@playwright/test'
import { createProject, placeItem, settle, shapes } from '../helpers'

/**
 * The phone layout.
 *
 * Spec section 9: usable on a laptop and a phone without separate codepaths. The
 * panels move into tabs below the canvas rather than being reimplemented, so
 * what is worth checking here is that everything is still reachable and that the
 * canvas responds to touch.
 */
test.describe('mobile layout', () => {
  test('reaches every panel through the tab bar', async ({ page }) => {
    await createProject(page, 'Mobile panels')
    await placeItem(page, 'Galley unit')
    await settle(page)

    // Only the selected tab's panel exists at this width. The side rails are not
    // rendered and hidden — they are not rendered at all — so each heading must
    // appear exactly once, never twice.
    await expect(page.getByRole('heading', { name: 'Properties' })).toHaveCount(0)

    for (const [tab, heading] of [
      ['templates', 'Templates'],
      ['items', /Items/],
      ['properties', 'Properties'],
      ['checks', /Checks/],
      ['catalog', 'Catalog'],
    ] as const) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByRole('heading', { name: heading })).toHaveCount(1)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
  })

  test('keeps the canvas usable and the section cut to hand', async ({ page }) => {
    await createProject(page, 'Mobile canvas')
    await placeItem(page, 'Fixed bed (across van)')
    await settle(page)

    await expect(shapes(page)).toHaveCount(1)

    // The section slider stays on screen rather than being buried in a tab.
    const slider = page.locator('input[type=range]').first()
    await expect(slider).toBeVisible()
    await slider.fill('1500')
    await settle(page)
    await expect(shapes(page)).toHaveCount(1)
  })

  test('switches views on a phone', async ({ page }) => {
    await createProject(page, 'Mobile views')
    await placeItem(page, 'Galley unit')
    await settle(page)

    await page.getByRole('radio', { name: 'Side' }).click()
    await settle(page)
    await expect(shapes(page)).toHaveCount(1)
  })
})
