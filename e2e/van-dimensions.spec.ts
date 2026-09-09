import { expect, test } from '@playwright/test'
import { createProject, panel, placeItem, settle } from './helpers'

/**
 * Correcting the van for one project.
 *
 * The preset data is a starting point; this is the mechanism that makes that
 * honest rather than merely disclaimed. Corrections must stay on the project and
 * must actually change what the rules measure against.
 */
test.describe('van dimensions', () => {
  test('corrects the interior and keeps it on this project', async ({ page }) => {
    const id = await createProject(page, 'Van corrections')

    await page.getByRole('button', { name: /Sprinter/ }).click()
    await expect(page.getByRole('heading', { name: /Van dimensions/ })).toBeVisible()

    // Scoped to the dialog: the inspector has its own Width field for whatever
    // object is selected, and both are legitimately on the page at once.
    const width = page.getByRole('dialog').getByLabel('Width')
    await width.fill('1740')
    await width.press('Enter')

    // The preset value is offered as a way back, rather than being lost.
    await expect(page.getByText(/Preset: 1787 mm/)).toBeVisible()

    await page.getByRole('button', { name: 'Done' }).click()
    await settle(page)

    // The toolbar says the van has been edited.
    await expect(page.getByText('edited')).toBeVisible()

    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    const { project } = await page.evaluate(async (projectId) => {
      const response = await fetch(`/api/projects/${projectId}`)
      return response.json() as Promise<{
        project: { overrides: { interior?: { w?: number } } }
      }>
    }, id)

    expect(project.overrides.interior?.w).toBe(1740)

    // A second project on the same van is untouched by that correction.
    await createProject(page, 'Untouched')
    await expect(page.getByText('edited')).toHaveCount(0)
  })

  test('a corrected width changes what the rules measure against', async ({ page }) => {
    // The point of the editor: it has to feed the checks, not just the label.
    await createProject(page, 'Corrections drive rules')
    await placeItem(page, 'Fixed bed (across van)')
    await settle(page)

    await expect(panel(page, 'Checks').getByText(/extends past/)).toHaveCount(0)

    // Narrow the van until the 1700mm bed cannot possibly fit.
    await page.getByRole('button', { name: /Sprinter/ }).click()
    const width = page.getByRole('dialog').getByLabel('Width')
    await width.fill('1400')
    await width.press('Enter')
    await page.getByRole('button', { name: 'Done' }).click()
    await settle(page)

    await expect(panel(page, 'Checks').getByText(/extends past/)).toBeVisible()
  })

  test('puts a dimension back to the preset', async ({ page }) => {
    await createProject(page, 'Reset a dimension')

    await page.getByRole('button', { name: /Sprinter/ }).click()
    const width = page.getByRole('dialog').getByLabel('Width')
    await width.fill('1600')
    await width.press('Enter')
    await expect(page.getByText(/Preset: 1787 mm/)).toBeVisible()

    await page.getByRole('button', { name: 'reset', exact: true }).click()
    await expect(page.getByText(/Preset: 1787 mm/)).toHaveCount(0)
    await expect(page.getByRole('dialog').getByLabel('Width')).toHaveValue('1787')
  })
})
