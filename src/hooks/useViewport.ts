/**
 * Pan and zoom for the editor canvas.
 *
 * The SVG viewBox is sized to exactly match the container's pixel aspect ratio,
 * so there is no letterboxing to compensate for and screen-to-model conversion
 * is a plain scale and offset. That matters more than it sounds: every drag,
 * hit-test and snap goes through this conversion, and an approximation here
 * shows up as objects landing a few millimetres from where you dropped them.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FIT_PADDING_MM, MAX_ZOOM, MIN_ZOOM, ZOOM_STEP } from '../lib/config'
import type { Point2, Rect2 } from '../lib/definitions'

export interface Viewport {
  /** Screen pixels per millimetre. */
  scale: number
  /** Model coordinate at the container's top-left corner. */
  origin: Point2
}

export interface UseViewportResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  size: { width: number; height: number }
  viewport: Viewport
  viewBox: string
  toModel(event: { clientX: number; clientY: number }): Point2
  modelLengthOf(pixels: number): number
  zoomBy(factor: number, focus?: Point2): void
  panBy(dxPixels: number, dyPixels: number): void
  fitTo(bounds: Rect2): void
  /** Attach to the SVG: handles wheel zoom and middle/space drag panning. */
  bind: {
    onWheel(event: React.WheelEvent): void
    onPointerDown(event: React.PointerEvent): boolean
  }
}

export function useViewport(): UseViewportResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const [viewport, setViewport] = useState<Viewport>({ scale: 0.2, origin: { x: 0, y: 0 } })

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize({ width: Math.max(1, width), height: Math.max(1, height) })
    })

    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const { scale, origin } = viewport

  const toModel = useCallback(
    (event: { clientX: number; clientY: number }): Point2 => {
      const element = containerRef.current
      if (!element) return { x: origin.x, y: origin.y }

      const rect = element.getBoundingClientRect()
      return {
        x: origin.x + (event.clientX - rect.left) / scale,
        y: origin.y + (event.clientY - rect.top) / scale,
      }
    },
    [scale, origin],
  )

  const modelLengthOf = useCallback((pixels: number) => pixels / scale, [scale])

  /**
   * Zoom about a fixed point, so the model coordinate under the cursor stays put.
   * Zooming about the centre instead makes precise work maddening.
   */
  const zoomBy = useCallback((factor: number, focus?: Point2) => {
    setViewport((current) => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor))
      if (scale === current.scale) return current

      const anchor = focus ?? {
        x: current.origin.x + size.width / current.scale / 2,
        y: current.origin.y + size.height / current.scale / 2,
      }

      return {
        scale,
        origin: {
          x: anchor.x - (anchor.x - current.origin.x) * (current.scale / scale),
          y: anchor.y - (anchor.y - current.origin.y) * (current.scale / scale),
        },
      }
    })
  }, [size.width, size.height])

  const panBy = useCallback((dxPixels: number, dyPixels: number) => {
    setViewport((current) => ({
      scale: current.scale,
      origin: {
        x: current.origin.x - dxPixels / current.scale,
        y: current.origin.y - dyPixels / current.scale,
      },
    }))
  }, [])

  const fitTo = useCallback(
    (bounds: Rect2) => {
      const width = bounds.w + FIT_PADDING_MM * 2
      const height = bounds.h + FIT_PADDING_MM * 2
      if (width <= 0 || height <= 0) return

      const scale = Math.min(size.width / width, size.height / height)
      const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))

      setViewport({
        scale: clamped,
        origin: {
          x: bounds.x + bounds.w / 2 - size.width / clamped / 2,
          y: bounds.y + bounds.h / 2 - size.height / clamped / 2,
        },
      })
    },
    [size.width, size.height],
  )

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      // Trackpad pinch arrives as a wheel event with ctrlKey set; a plain wheel
      // is a scroll, which in a spatial editor should also zoom rather than
      // scroll a page that does not move.
      const focus = toModel(event)
      const factor = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      zoomBy(factor, focus)
    },
    [toModel, zoomBy],
  )

  /**
   * Begin a pan on middle-click or space-drag. Returns true when it took the
   * gesture, so the caller knows not to start a selection.
   */
  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      const isPan = event.button === 1 || (event.button === 0 && event.shiftKey)
      if (!isPan) return false

      event.preventDefault()
      const target = event.currentTarget as SVGElement
      target.setPointerCapture(event.pointerId)

      let lastX = event.clientX
      let lastY = event.clientY

      const move = (moveEvent: PointerEvent) => {
        panBy(moveEvent.clientX - lastX, moveEvent.clientY - lastY)
        lastX = moveEvent.clientX
        lastY = moveEvent.clientY
      }

      const up = () => {
        target.removeEventListener('pointermove', move)
        target.removeEventListener('pointerup', up)
        target.removeEventListener('pointercancel', up)
      }

      target.addEventListener('pointermove', move)
      target.addEventListener('pointerup', up)
      target.addEventListener('pointercancel', up)
      return true
    },
    [panBy],
  )

  // Keyboard zoom, matching what people expect from any drawing tool.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      if (event.key === '=' || event.key === '+') {
        event.preventDefault()
        zoomBy(ZOOM_STEP)
      } else if (event.key === '-') {
        event.preventDefault()
        zoomBy(1 / ZOOM_STEP)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [zoomBy])

  const viewBox = `${viewport.origin.x} ${viewport.origin.y} ${size.width / viewport.scale} ${
    size.height / viewport.scale
  }`

  return {
    containerRef,
    size,
    viewport,
    viewBox,
    toModel,
    modelLengthOf,
    zoomBy,
    panBy,
    fitTo,
    bind: { onWheel, onPointerDown },
  }
}
