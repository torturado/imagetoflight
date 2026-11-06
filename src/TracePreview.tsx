import { useEffect, useRef, useState } from 'react'
import type { TracedRoute } from './tracing'

type Props = {
  image: HTMLImageElement
  route: TracedRoute
  showImage: boolean
}

const ROUTE_COLOR = '#2456d6'
const JUMP_COLOR = '#c2410c'

/** Draws the traced route over a faint copy of the source image, in the unit square. */
export function TracePreview({ image, route, showImage }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pixelSize, setPixelSize] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => {
      setPixelSize(Math.round(entry.contentRect.width * window.devicePixelRatio))
    })
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context || pixelSize === 0) return
    canvas.width = pixelSize
    canvas.height = pixelSize
    const size = pixelSize
    const ratio = window.devicePixelRatio
    context.clearRect(0, 0, size, size)

    if (showImage) {
      const scale = size / Math.max(image.naturalWidth, image.naturalHeight)
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      context.globalAlpha = 0.25
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height)
      context.globalAlpha = 1
    }

    context.lineJoin = 'round'
    context.lineCap = 'round'
    route.legs.forEach((leg, index) => {
      if (leg === 'retrace') return
      const from = route.points[index]
      const to = route.points[index + 1]
      context.strokeStyle = leg === 'jump' ? JUMP_COLOR : ROUTE_COLOR
      context.lineWidth = (leg === 'jump' ? 1.5 : 2) * ratio
      context.setLineDash(leg === 'jump' ? [4 * ratio, 4 * ratio] : [])
      context.beginPath()
      context.moveTo(from.x * size, from.y * size)
      context.lineTo(to.x * size, to.y * size)
      context.stroke()
    })
    context.setLineDash([])

    const start = route.points[0]
    if (start) {
      context.fillStyle = ROUTE_COLOR
      context.beginPath()
      context.arc(start.x * size, start.y * size, 5 * ratio, 0, Math.PI * 2)
      context.fill()
    }
  }, [image, route, showImage, pixelSize])

  return <canvas ref={canvasRef} className="aspect-square w-full" />
}
