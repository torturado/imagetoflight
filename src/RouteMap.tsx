import L from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import type { LatLng } from './geometry'
import type { LegKind } from './tracing'

type Props = {
  center: LatLng
  points: LatLng[]
  legs: LegKind[]
  onCenterChange: (center: LatLng) => void
}

/** Splits the route into runs of drawn legs and single jump legs for styling. */
function groupLegs(points: LatLng[], legs: LegKind[]) {
  const drawn: LatLng[][] = []
  const jumps: LatLng[][] = []
  let run: LatLng[] = []
  legs.forEach((leg, index) => {
    if (leg === 'jump') {
      if (run.length > 1) drawn.push(run)
      run = []
      jumps.push([points[index], points[index + 1]])
      return
    }
    if (run.length === 0) run.push(points[index])
    run.push(points[index + 1])
  })
  if (run.length > 1) drawn.push(run)
  return { drawn, jumps }
}

export function RouteMap({ center, points, legs, onCenterChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const layersRef = useRef<L.LayerGroup | null>(null)
  const onCenterChangeRef = useRef(onCenterChange)
  const [initialCenter] = useState(center)

  useEffect(() => {
    onCenterChangeRef.current = onCenterChange
  }, [onCenterChange])

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      [initialCenter.lat, initialCenter.lng],
      9,
    )
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    map.on('click', (event) => onCenterChangeRef.current(event.latlng))
    layersRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
    }
  }, [initialCenter])

  useEffect(() => {
    const layers = layersRef.current
    if (!layers) return
    layers.clearLayers()
    if (points.length < 2) {
      L.circleMarker([center.lat, center.lng], { radius: 5, color: '#2456d6' }).addTo(layers)
      return
    }
    const { drawn, jumps } = groupLegs(points, legs)
    L.polyline(drawn, { color: '#2456d6', weight: 3 }).addTo(layers)
    L.polyline(jumps, { color: '#c2410c', weight: 2, dashArray: '6 6' }).addTo(layers)
    L.circleMarker(points[0], { radius: 6, color: '#2456d6', fillOpacity: 1 })
      .bindTooltip('Inicio')
      .addTo(layers)
  }, [center, points, legs])

  return <div ref={containerRef} className="h-full w-full" />
}
