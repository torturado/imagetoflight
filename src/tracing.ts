import { contours } from 'd3-contour'
import { simplify, type Point } from './geometry'

/** Grayscale raster: 0 is black, 255 is white, transparency composited over white. */
export type GrayImage = { width: number; height: number; values: Float32Array }

export type TraceSettings = {
  /** Pixels darker than this (or lighter, when inverted) are traced. */
  threshold: number
  invert: boolean
  /** Upper bound for the number of waypoints in the final route. */
  maxWaypoints: number
}

/**
 * How a leg is flown: `draw` is part of the picture, `retrace` flies back over a line
 * already drawn (invisible in the final track) and `jump` crosses empty space.
 */
export type LegKind = 'draw' | 'retrace' | 'jump'

export type TracedRoute = {
  /** Points in the unit square, aspect ratio kept and centred. */
  points: Point[]
  /** `legs[i]` describes the leg from `points[i]` to `points[i + 1]`. */
  legs: LegKind[]
}

/** Working resolution: enough for logo lettering, small enough to trace instantly. */
const RASTER_SIDE = 400

export function rasterize(image: HTMLImageElement): GrayImage {
  const scale = Math.min(1, RASTER_SIDE / Math.max(image.naturalWidth, image.naturalHeight))
  const width = Math.max(1, Math.round(image.naturalWidth * scale))
  const height = Math.max(1, Math.round(image.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D no disponible')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
  const { data } = context.getImageData(0, 0, width, height)
  const values = new Float32Array(width * height)
  for (let i = 0; i < values.length; i++) {
    values[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  return { width, height, values }
}

/** Otsu's method: the gray level that best separates the histogram into two classes. */
function otsuThreshold(image: GrayImage): number {
  const histogram = new Array<number>(256).fill(0)
  for (const value of image.values) histogram[Math.round(value)]++
  const total = image.values.length
  const weightedSum = histogram.reduce((sum, count, level) => sum + count * level, 0)
  let backgroundWeight = 0
  let backgroundSum = 0
  let best = { level: 128, variance: -1 }
  for (let level = 0; level < 256; level++) {
    backgroundWeight += histogram[level]
    if (backgroundWeight === 0) continue
    const foregroundWeight = total - backgroundWeight
    if (foregroundWeight === 0) break
    backgroundSum += level * histogram[level]
    const meanDifference =
      backgroundSum / backgroundWeight - (weightedSum - backgroundSum) / foregroundWeight
    const variance = backgroundWeight * foregroundWeight * meanDifference ** 2
    if (variance > best.variance) best = { level, variance }
  }
  return best.level
}

/** A border this uniform is taken to be the background. */
const DECISIVE_BORDER_SHARE = 0.8

/**
 * Picks threshold and polarity for a new image. When the border is clearly one tone it is
 * the background; otherwise (a logo cropped tight against its edges) the less common tone is
 * taken as the ink, which suits logos and silhouettes on a plain ground.
 */
export function autoSettings(image: GrayImage): Pick<TraceSettings, 'threshold' | 'invert'> {
  const threshold = otsuThreshold(image)
  const { width, height, values } = image
  const borderIndexes = [
    ...Array.from({ length: width }, (_, x) => [x, (height - 1) * width + x]).flat(),
    ...Array.from({ length: height }, (_, y) => [y * width, y * width + width - 1]).flat(),
  ]
  const darkBorderShare =
    borderIndexes.filter((index) => values[index] <= threshold).length / borderIndexes.length
  if (darkBorderShare >= DECISIVE_BORDER_SHARE) return { threshold, invert: true }
  if (darkBorderShare <= 1 - DECISIVE_BORDER_SHARE) return { threshold, invert: false }
  const darkShare = values.filter((value) => value <= threshold).length / values.length
  return { threshold, invert: darkShare > 0.5 }
}

/** Closed outlines of the traced region, in unit-square coordinates, without the repeated end point. */
function extractRings(image: GrayImage, settings: TraceSettings): Point[][] {
  // A one-pixel border of background guarantees every outline closes inside the raster.
  const width = image.width + 2
  const height = image.height + 2
  const ink = new Array<number>(width * height).fill(0)
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const value = image.values[y * image.width + x]
      ink[(y + 1) * width + x + 1] = settings.invert ? value : 255 - value
    }
  }
  const level = settings.invert ? settings.threshold : 255 - settings.threshold
  const polygons = contours().size([width, height]).contour(ink, level).coordinates

  const side = Math.max(image.width, image.height)
  const offsetX = (side - image.width) / 2 - 1
  const offsetY = (side - image.height) / 2 - 1
  return polygons
    .flat()
    .map((ring) =>
      ring.slice(0, -1).map(([x, y]) => ({ x: (x + offsetX) / side, y: (y + offsetY) / side })),
    )
}

function simplifyRing(ring: Point[], tolerance: number): Point[] {
  const closed = simplify([...ring, ring[0]], tolerance)
  return closed.slice(0, -1)
}

function squaredDistance(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2
}

/** Closest pair of vertices between two outlines. */
function closestVertices(a: Point[], b: Point[]) {
  let best = { from: 0, to: 0, distance: Infinity }
  a.forEach((p, from) => {
    b.forEach((q, to) => {
      const distance = squaredDistance(p, q)
      if (distance < best.distance) best = { from, to, distance }
    })
  })
  return best
}

type Branch = { child: number; from: number; to: number }

/**
 * Joins closed outlines into one continuous path. Outlines are connected by a minimum
 * spanning tree, so the visible connectors are as short as possible in total. The route walks
 * each outline once; at a vertex where a branch starts it flies out to the child outline,
 * draws it, and flies back along the same connector before carrying on.
 */
function linkRings(rings: Point[][]): TracedRoute {
  const route: TracedRoute = { points: [], legs: [] }
  if (rings.length === 0) return route

  // The outline holding the left-most point is the root, so the route starts on the left.
  const leftMost = rings.map((ring) =>
    ring.reduce((best, p, index) => (p.x < ring[best].x ? index : best), 0),
  )
  const root = rings.reduce(
    (best, ring, index) => (ring[leftMost[index]].x < rings[best][leftMost[best]].x ? index : best),
    0,
  )

  // Prim's algorithm over outline-to-outline distances.
  const branches = rings.map((): Branch[] => [])
  const inTree = new Set([root])
  const nearest = rings.map((ring, index) =>
    index === root ? null : { parent: root, ...closestVertices(rings[root], ring) },
  )
  while (inTree.size < rings.length) {
    let next = -1
    nearest.forEach((link, index) => {
      if (link && !inTree.has(index) && (next === -1 || link.distance < nearest[next]!.distance)) next = index
    })
    const link = nearest[next]!
    branches[link.parent].push({ child: next, from: link.from, to: link.to })
    inTree.add(next)
    nearest.forEach((current, index) => {
      if (!current || inTree.has(index)) return
      const candidate = closestVertices(rings[next], rings[index])
      if (candidate.distance < current.distance) nearest[index] = { parent: next, ...candidate }
    })
  }

  const append = (point: Point, leg: LegKind) => {
    route.points.push(point)
    route.legs.push(leg)
  }

  const visit = (ringIndex: number, entry: number) => {
    const ring = rings[ringIndex]
    for (let step = 0; step <= ring.length; step++) {
      const vertex = (entry + step) % ring.length
      if (step > 0) append(ring[vertex], 'draw')
      if (step === ring.length) break
      for (const branch of branches[ringIndex]) {
        if (branch.from !== vertex) continue
        append(rings[branch.child][branch.to], 'jump')
        visit(branch.child, branch.to)
        append(ring[vertex], 'retrace')
      }
    }
  }

  route.points.push(rings[root][leftMost[root]])
  visit(root, leftMost[root])
  return route
}

/**
 * An outline narrower than this many tolerances would come out as a scribble, so it is
 * dropped instead: a tighter budget sheds small details before it distorts large shapes.
 */
const MIN_RING_SPAN_IN_TOLERANCES = 4

function ringSpan(ring: Point[]): number {
  const xs = ring.map((p) => p.x)
  const ys = ring.map((p) => p.y)
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

function traceWithTolerance(rings: Point[][], tolerance: number): TracedRoute {
  const simplified = rings
    .filter((ring) => ringSpan(ring) >= tolerance * MIN_RING_SPAN_IN_TOLERANCES)
    .map((ring) => simplifyRing(ring, tolerance))
    .filter((ring) => ring.length >= 3)
  return linkRings(simplified)
}

/**
 * Traces the image and loosens simplification until the route fits the waypoint budget.
 * `minTolerance` (in image widths) is the finest detail worth keeping: anything smaller than
 * the aircraft can turn would only add waypoints it cannot fly.
 */
export function traceImage(
  image: GrayImage,
  settings: TraceSettings,
  minTolerance: number,
): TracedRoute {
  const rings = extractRings(image, settings)
  let low = Math.max(minTolerance, 0.0005)
  const finest = traceWithTolerance(rings, low)
  if (finest.points.length <= settings.maxWaypoints) return finest
  // Coarser tolerances also drop more outlines, so doubling always reaches the budget.
  let high = 0.1
  let best = traceWithTolerance(rings, high)
  while (best.points.length > settings.maxWaypoints && high < 1) {
    low = high
    high *= 2
    best = traceWithTolerance(rings, high)
  }
  for (let iteration = 0; iteration < 16; iteration++) {
    const tolerance = (low + high) / 2
    const route = traceWithTolerance(rings, tolerance)
    if (route.points.length <= settings.maxWaypoints) {
      best = route
      high = tolerance
    } else {
      low = tolerance
    }
  }
  return best
}
