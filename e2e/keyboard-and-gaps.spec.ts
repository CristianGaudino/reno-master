import { expect, test } from '@playwright/test'
import { createProject, panel, placeItem, settle, shapes } from './helpers'

test.describe('keyboard editing', () => {
  test('nudges the selection by the grid and steps through objects', async ({ page }) => {
    // Dragging is fine for roughing out a layout and hopeless for the last five
    // millimetres, so arrow keys move by the snap grid.
    const id = await createProject(page, 'Keyboard nudge')
    await placeItem(page, 'Galley unit')
    await settle(page)

    const across = page.getByLabel('Across')
    const startX = Number(await across.inputValue())

    await page.locator('svg.editor-canvas').focus()
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
    await settle(page)

    // Default grid is 10mm, so three presses is 30mm.
    await expect(across).toHaveValue(String(startX + 30))

    // Alt gives single millimetres for the last little bit.
    await page.keyboard.press('Alt+ArrowRight')
    await settle(page)
    await expect(across).toHaveValue(String(startX + 31))

    // Shift crosses the van quickly.
    await page.keyboard.press('Shift+ArrowLeft')
    await settle(page)
    await expect(across).toHaveValue(String(startX + 31 - 100))

    // And it persists like any other edit.
    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    const { objects } = await page.evaluate(async (projectId) => {
      const response = await fetch(`/api/projects/${projectId}`)
      return response.json() as Promise<{ objects: Array<{ position: { x: number } }> }>
    }, id)
    expect(objects[0]?.position.x).toBe(startX + 31 - 100)
  })

  test('selects objects with Tab when there is no pointer', async ({ page }) => {
    await createProject(page, 'Keyboard select')
    await placeItem(page, 'Galley unit')
    await placeItem(page, 'Fresh water tank (60L)')
    await settle(page)

    await page.locator('svg.editor-canvas').focus()
    await page.keyboard.press('Escape')
    await settle(page)
    await expect(panel(page, 'Properties').getByText('Nothing selected')).toBeVisible()

    await page.keyboard.press('Tab')
    await settle(page)
    await expect(panel(page, 'Properties').getByText('Nothing selected')).toHaveCount(0)

    // The canvas announces what is selected for anyone not looking at it.
    await expect(page.locator('.sr-only')).toContainText(/Selected /)
  })
})

test.describe('remaining spec gaps', () => {
  test('adds a piece that is not in the catalog', async ({ page }) => {
    await createProject(page, 'Bespoke piece')

    await page.getByRole('button', { name: '+ New piece' }).click()
    await expect(page.getByRole('heading', { name: 'New piece' })).toBeVisible()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Name').fill('Dog crate')
    await dialog.getByLabel('Width').fill('700')
    await dialog.getByLabel('Width').press('Enter')
    await page.getByRole('button', { name: 'Add to van' }).click()
    await settle(page)

    await expect(shapes(page)).toHaveCount(1)
    // It has no catalog ancestor, so it is the user's own piece from the start.
    await expect(panel(page, 'Properties').getByText(/built from scratch/)).toBeVisible()
    await expect(panel(page, 'Items').getByText('Dog crate')).toBeVisible()
  })

  test('totals the cost of what is in the van', async ({ page }) => {
    await createProject(page, 'Cost total')

    const weight = panel(page, 'Weight')
    await expect(weight.getByText('Rough cost')).toHaveCount(0)

    await placeItem(page, 'Compressor fridge')
    await settle(page)

    await expect(weight.getByText('Rough cost')).toBeVisible()
    await expect(weight.getByText(/£/)).toBeVisible()
  })

  test('changes the van after the project was created', async ({ page }) => {
    await createProject(page, 'Swap the van')
    await placeItem(page, 'Fixed bed (across van)')
    await settle(page)

    await page.getByRole('button', { name: /Sprinter/ }).click()
    await page.getByRole('dialog').getByLabel('Model').selectOption({ label: 'Ford Transit Custom L2 Low roof' })
    await page.getByRole('button', { name: 'Done' }).click()
    await settle(page)

    // The layout stays put and the header follows the new van.
    await expect(page.getByRole('button', { name: /Transit Custom/ })).toBeVisible()
    await expect(shapes(page)).toHaveCount(1)
  })
})
