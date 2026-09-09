import { expect, test } from '@playwright/test'
import { createProject, findings, placeItem, settle, shapes } from './helpers'

test.describe('editor', () => {
  test('places catalog items without dropping them on each other', async ({ page }) => {
    // Regression: the catalog read its object list from a stale render, so a
    // second click could not see the first item and put the two in the same
    // place. It typechecked perfectly.
    await createProject(page, 'Placement')

    await placeItem(page, 'Fixed bed (across van)')
    await placeItem(page, 'Galley unit')
    await placeItem(page, 'Compressor fridge')
    await settle(page)

    await expect(shapes(page)).toHaveCount(3)

    const messages = await findings(page)
    expect(messages.filter((message) => message.includes('overlap'))).toEqual([])
  })

  test('puts a transverse bed on the arches at the back, not across the middle', async ({
    page,
  }) => {
    // Anything wider than the gap between the wheel arches cannot sit on the
    // floor in the back half of a van, so it belongs on top of them — which is
    // how the bed ends up somewhere a person would actually draw it.
    const id = await createProject(page, 'Bed placement')
    await placeItem(page, 'Fixed bed (across van)')
    await settle(page)

    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    const { objects } = await page.evaluate(async (projectId) => {
      const response = await fetch(`/api/projects/${projectId}`)
      return response.json() as Promise<{
        objects: Array<{ position: { y: number; z: number }; size: { d: number } }>
      }>
    }, id)

    const bed = objects[0]!
    expect(bed.position.z).toBeGreaterThan(0)
    // In the back half of the van rather than wedged across the middle.
    expect(bed.position.y).toBeGreaterThan(1000)
  })

  test('switches between the three views without losing the scene', async ({ page }) => {
    await createProject(page, 'Views')
    await placeItem(page, 'Galley unit')
    await settle(page)

    for (const view of ['Side', 'Rear', 'Top']) {
      await page.getByRole('radio', { name: view }).click()
      await settle(page)
      await expect(shapes(page)).toHaveCount(1)
    }
  })

  test('ghosts objects above the section cut rather than hiding them', async ({ page }) => {
    await createProject(page, 'Section cut')
    await placeItem(page, 'Overhead locker')
    await settle(page)

    const slider = page.locator('input[type=range]').first()

    // Cut above the locker: it is below the cut, so it draws solid.
    await slider.fill('1900')
    await settle(page)
    const solid = await shapes(page).first().evaluate((node) => node.closest('g')?.getAttribute('opacity'))

    // Cut at the floor: the locker is above it and should fade, not vanish.
    await slider.fill('0')
    await settle(page)
    await expect(shapes(page)).toHaveCount(1)
    const ghosted = await shapes(page).first().evaluate((node) => node.closest('g')?.getAttribute('opacity'))

    expect(ghosted).not.toBe(solid)
    expect(Number(ghosted)).toBeLessThan(1)
  })

  test('undoes a template load in one step', async ({ page }) => {
    // A drag is one undo entry, not one per pointermove — and loading a whole
    // template is likewise a single thing to take back.
    await createProject(page, 'Undo')
    await page.getByRole('button', { name: /Weekender/i }).last().click()
    await settle(page)
    expect(await shapes(page).count()).toBeGreaterThan(3)

    await page.getByRole('button', { name: 'Undo' }).click()
    await settle(page)
    await expect(shapes(page)).toHaveCount(0)
  })
})
