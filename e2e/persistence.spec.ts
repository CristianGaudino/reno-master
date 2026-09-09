import { expect, test } from '@playwright/test'
import { createProject, fetchProject, placeItem, settle, shapes } from './helpers'

/**
 * The local-first sync story.
 *
 * Every bug this file covers was invisible to the unit tests and to the type
 * checker, and each one either lost work or accused the user of a conflict they
 * had not caused.
 */
test.describe('persistence', () => {
  test('commits to the server on demand and reloads from it', async ({ page }) => {
    const id = await createProject(page, 'Sync round trip')

    await placeItem(page, 'Galley unit')
    await placeItem(page, 'Compressor fridge')
    await settle(page)

    // Nothing should have reached the server yet: the five-minute timer has not
    // fired, which is the whole point of the local-first design.
    const before = await fetchProject(page, id)
    expect(before.objects).toHaveLength(0)

    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    const after = await fetchProject(page, id)
    expect(after.objects).toHaveLength(2)
    expect(after.project.revision).toBe(1)

    await page.reload()
    await settle(page)
    await expect(shapes(page)).toHaveCount(2)
  })

  test('recovers unsynced work after the tab is closed', async ({ page, context }) => {
    // IndexedDB is the real write path, so work survives even though it never
    // reached Neon.
    const id = await createProject(page, 'Crash recovery')
    await placeItem(page, 'Galley unit')
    await settle(page)

    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    // A second item that is deliberately never synced by hand.
    await placeItem(page, 'Water pump')
    await settle(page)

    await page.close({ runBeforeUnload: false })

    const reopened = await context.newPage()
    await reopened.goto(`/projects/${id}`)
    await expect(reopened.locator('svg.editor-canvas')).toBeVisible()
    await reopened.waitForTimeout(1500)

    await expect(reopened.locator('svg.editor-canvas polygon')).toHaveCount(2)
  })

  test('does not raise a conflict against the user own parting save', async ({
    page,
    context,
  }) => {
    // Closing a tab flushes through sendBeacon, which cannot report success. The
    // sync carries a pre-committed id the server records, so on reopening the
    // client can tell its own write from somebody else's. Without it, the most
    // ordinary thing a user does — close the tab, come back — accused them of
    // editing in two places at once.
    const id = await createProject(page, 'Beacon reconciliation')
    await placeItem(page, 'Galley unit')
    await settle(page)

    await page.close({ runBeforeUnload: false })

    const reopened = await context.newPage()
    await reopened.goto(`/projects/${id}`)
    await expect(reopened.locator('svg.editor-canvas')).toBeVisible()
    await reopened.waitForTimeout(2000)

    await expect(reopened.getByText('This project was changed somewhere else')).toHaveCount(0)
  })

  test('reports a genuine conflict rather than silently overwriting', async ({
    page,
    context,
  }) => {
    const id = await createProject(page, 'Real conflict')
    await placeItem(page, 'Galley unit')
    await settle(page)
    await page.getByRole('button', { name: 'Save now' }).click()
    await expect(page.getByText(/synced just now/)).toBeVisible({ timeout: 15_000 })

    // Someone else writes to the project, moving the revision on.
    await page.evaluate(async (projectId) => {
      await fetch(`/api/projects/${projectId}/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          baseRevision: 1,
          syncId: crypto.randomUUID(),
          upserts: [],
          deletes: [],
          patch: { name: 'Edited elsewhere' },
        }),
      })
    }, id)

    // This tab still believes it is on revision 1 and now has work to push.
    await placeItem(page, 'Compressor fridge')
    await settle(page)
    await page.getByRole('button', { name: 'Save now' }).click()

    await expect(page.getByText('This project was changed somewhere else')).toBeVisible({
      timeout: 15_000,
    })

    // Neither side has been thrown away — the user gets to choose.
    await expect(page.getByRole('button', { name: 'Keep mine' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Load theirs' })).toBeVisible()
    await expect(context.pages().length).toBeGreaterThan(0)
  })
})
