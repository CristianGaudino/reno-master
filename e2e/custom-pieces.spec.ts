import { expect, test } from '@playwright/test'
import { createProject, panel, placeItem, settle } from './helpers'

/**
 * Editing a catalog item into your own piece.
 *
 * The rule the app follows: a piece is custom the moment it stops matching what
 * it came from, it belongs to the project whether or not it is ever saved, and
 * manufactured goods are locked until you say otherwise.
 */
test.describe('custom pieces', () => {
  test('marks a resized catalog item as custom and names its origin', async ({ page }) => {
    await createProject(page, 'Custom piece')
    await placeItem(page, 'Galley unit')
    await settle(page)

    const properties = panel(page, 'Properties')

    // Not custom to begin with.
    await expect(properties.getByText('Custom piece')).toHaveCount(0)

    const width = page.getByLabel('Width')
    await width.fill('520')
    await width.press('Enter')
    await settle(page)

    await expect(properties.getByText(/based on Galley unit/)).toBeVisible()
    // And it is flagged in the project's own item list too.
    await expect(panel(page, 'Items').getByText('custom', { exact: true })).toBeVisible()
  })

  test('stops being custom when resized back to standard', async ({ page }) => {
    // Custom is derived from a comparison rather than stored as a flag, so
    // undoing the change should undo the label too.
    await createProject(page, 'Back to standard')
    await placeItem(page, 'Galley unit')
    await settle(page)

    const width = page.getByLabel('Width')
    await width.fill('520')
    await width.press('Enter')
    await settle(page)

    const properties = panel(page, 'Properties')
    await expect(properties.getByText(/based on Galley unit/)).toBeVisible()

    await width.fill('600')
    await width.press('Enter')
    await settle(page)
    await expect(properties.getByText(/based on Galley unit/)).toHaveCount(0)
  })

  test('locks a manufactured item until it is deliberately unlocked', async ({ page }) => {
    await createProject(page, 'Locked appliance')
    await placeItem(page, 'Compressor fridge')
    await settle(page)

    await expect(page.getByLabel('Width')).toBeDisabled()
    await expect(page.getByText(/manufactured item/)).toBeVisible()

    await page.getByRole('button', { name: 'Use different dimensions' }).click()
    await settle(page)

    await expect(page.getByLabel('Width')).toBeEnabled()
  })

  test('rescales a water tank mass with its volume', async ({ page }) => {
    // Water is usually the heaviest thing in a build, so a resized tank that
    // kept its old mass would quietly put the payload figures out.
    await createProject(page, 'Tank mass')
    await placeItem(page, 'Fresh water tank (60L)')
    await settle(page)

    const before = await page.getByLabel(/^Mass/).inputValue()

    const width = page.getByLabel('Width')
    await width.fill('1300')
    await width.press('Enter')
    await settle(page)

    const after = await page.getByLabel(/^Mass/).inputValue()
    expect(Number(after)).toBeGreaterThan(Number(before) * 1.5)
  })

  test('keeps an unsaved custom piece in the project', async ({ page }) => {
    // Saving to the personal catalog is optional; the project keeps the piece
    // regardless, and it has to survive a round trip to the server.
    const id = await createProject(page, 'Unsaved custom')
    await placeItem(page, 'Galley unit')
    await settle(page)

    const width = page.getByLabel('Width')
    await width.fill('480')
    await width.press('Enter')
    await settle(page)

    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    const { objects } = await page.evaluate(async (projectId) => {
      const response = await fetch(`/api/projects/${projectId}`)
      return response.json() as Promise<{
        objects: Array<{ size: { w: number }; catalogSlug: string | null }>
      }>
    }, id)

    expect(objects[0]?.size.w).toBe(480)
    // The origin is kept, so the piece can still say what it was based on.
    expect(objects[0]?.catalogSlug).toBe('galley-unit')
  })

  test('saves a custom piece for reuse and places it again', async ({ page }) => {
    await createProject(page, 'Save to my pieces')
    await placeItem(page, 'Overhead locker')
    await settle(page)

    const width = page.getByLabel('Width')
    await width.fill('420')
    await width.press('Enter')
    await settle(page)

    await page.getByRole('button', { name: 'Save to my pieces' }).click()
    await expect(page.getByRole('button', { name: 'Saved to your pieces' })).toBeVisible({
      timeout: 15_000,
    })

    // It now appears under "Your pieces" in the catalog, ready to place again.
    const catalog = panel(page, 'Catalog')
    await expect(catalog.getByText('Your pieces')).toBeVisible()

    const saved = catalog.locator('li').filter({ hasText: '420' })
    await expect(saved.first()).toBeVisible()

    // Remove it again, so the suite leaves the account as it found it — the
    // personal catalog outlives a test run and would otherwise accumulate a copy
    // on every pass.
    const before = await catalog.getByRole('button', { name: /Overhead locker/ }).count()
    await saved.first().getByRole('button', { name: '✕' }).click()
    await expect(catalog.getByRole('button', { name: /Overhead locker/ })).toHaveCount(
      before - 1,
    )
  })
})
