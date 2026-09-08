/**
 * Run the rules over the current scene.
 *
 * Memoised on the things rules actually read, so it re-runs when an object
 * moves but not when the selection or the view changes. That keeps live
 * evaluation during a drag affordable.
 */

import { useMemo } from 'react'
import type { RuleReport } from '../lib/definitions'
import { ALL_RULES, buildContext, evaluateScene } from '../lib/rules'
import { useEditorStore } from '../store/editorStore'

const EMPTY: RuleReport = { findings: [], errorCount: 0, warningCount: 0, skipped: [] }

export function useFindings(): RuleReport {
  const van = useEditorStore((state) => state.van)
  const objects = useEditorStore((state) => state.objects)
  const settings = useEditorStore((state) => state.settings)

  return useMemo(() => {
    if (!van) return EMPTY
    return evaluateScene(buildContext(van, objects, settings), ALL_RULES)
  }, [van, objects, settings])
}
