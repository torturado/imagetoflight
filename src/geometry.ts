/** Point in drawing space, normalized to a unit square with y pointing down. */
export type Point = { x: number; y: number }
export type Stroke = Point[]
export type LatLng = { lat: number; lng: number }

export type Placement = {
  center: LatLng
  /** Width of the drawing square on the ground, in nautical miles. */
  sizeNm: number
  /** Clockwise rotation of the drawing, in degrees. */
  rotationDeg: number
}

const METERS_PER_NM = 1852
const METERS_PER_DEGREE_LAT = 111_320
const EARTH_RADIUS_M = 6_371_000

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Ramer–Douglas–Peucker simplification; tolerance is in drawing units. */
export function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points
  let maxDistance = 0
  let index = 0
  const last = points.length - 1
  for (let i = 1; i < last; i++) {
    const distance = distanceToSegment(points[i], points[0], points[last])
    if (distance > maxDistance) {
      maxDistance = distance
      index = i
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[last]]
  const left = simplify(points.slice(0, index + 1), tolerance)
  const right = simplify(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

/** Wraps a longitude into [-180, 180) so routes across the antimeridian stay valid. */
function normalizeLongitude(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180
}

/** Projects a drawing point onto the ground using a local flat-earth approximation. */
export function toLatLng(point: Point, placement: Placement): LatLng {
  const { center, sizeNm, rotationDeg } = placement
  const sizeM = sizeNm * METERS_PER_NM
  const east = (point.x - 0.5) * sizeM
  const north = -(point.y - 0.5) * sizeM
  const angle = (rotationDeg * Math.PI) / 180
  const rotatedEast = east * Math.cos(angle) + north * Math.sin(angle)
  const rotatedNorth = -east * Math.sin(angle) + north * Math.cos(angle)
  return {
    lat: center.lat + rotatedNorth / METERS_PER_DEGREE_LAT,
    lng: normalizeLongitude(
      center.lng + rotatedEast / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180)),
    ),
  }
}

export function distanceNm(a: LatLng, b: LatLng): number {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLng = (b.lng - a.lng) * toRad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2
  return (2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))) / METERS_PER_NM
}

/** Turn radius in nautical miles for a coordinated turn at the given bank angle. */
export function turnRadiusNm(speedKt: number, bankDeg: number): number {
  const speedMs = (speedKt * METERS_PER_NM) / 3600
  return speedMs ** 2 / (9.81 * Math.tan((bankDeg * Math.PI) / 180)) / METERS_PER_NM
}
