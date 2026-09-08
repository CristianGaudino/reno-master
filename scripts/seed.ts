/**
 * Seed the shared van preset library.
 *
 * Idempotent: re-running updates existing rows rather than duplicating them, so
 * correcting a dimension in `lib/vans.ts` and re-seeding is the intended
 * workflow as real measurements come in.
 *
 * Obstacles are replaced wholesale per model rather than upserted, because their
 * generated ids are positional — removing a wheel well from a spec should remove
 * it from the database too.
 */

import '../server/env'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { vanModels, vanObstacles } from '@/lib/db/schema'
import { SEED_VAN_MODELS } from '@/lib/vans'

async function seed() {
  console.log(`Seeding ${SEED_VAN_MODELS.length} van models...`)

  for (const model of SEED_VAN_MODELS) {
    const values = {
      id: model.id,
      make: model.make,
      model: model.model,
      variant: model.variant,
      wheelbaseLabel: model.wheelbaseLabel,
      roofLabel: model.roofLabel,
      interiorW: model.interior.w,
      interiorD: model.interior.d,
      interiorH: model.interior.h,
      taper: model.taper,
      payload: model.payload,
      gvwr: model.gvwr,
      frontAxleY: model.frontAxleY,
      rearAxleY: model.rearAxleY,
      kerbFrontAxle: model.kerbFrontAxle,
      kerbRearAxle: model.kerbRearAxle,
      confidence: model.confidence,
      sourceNote: model.sourceNote,
    }

    await db()
      .insert(vanModels)
      .values(values)
      .onConflictDoUpdate({ target: vanModels.id, set: values })

    await db().delete(vanObstacles).where(eq(vanObstacles.vanModelId, model.id))

    if (model.obstacles.length > 0) {
      await db()
        .insert(vanObstacles)
        .values(
          model.obstacles.map((obstacle) => ({
            id: obstacle.id,
            vanModelId: model.id,
            kind: obstacle.kind,
            name: obstacle.name,
            posX: obstacle.position.x,
            posY: obstacle.position.y,
            posZ: obstacle.position.z,
            sizeW: obstacle.size.w,
            sizeD: obstacle.size.d,
            sizeH: obstacle.size.h,
            articulation: obstacle.articulation,
            confidence: obstacle.confidence,
          })),
        )
    }

    console.log(
      `  ${model.make} ${model.model} ${model.wheelbaseLabel} ${model.roofLabel} — ${model.obstacles.length} obstacles`,
    )
  }

  console.log('\nDone. Every dimension is tagged "approximate" — measure your own van before cutting.')
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
