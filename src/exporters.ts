import type { LatLng } from './geometry'

/** Short names fit the identifier limits of most avionics and EFB apps. */
function waypointName(index: number): string {
  return `D${String(index + 1).padStart(3, '0')}`
}

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (char) => `&#${char.charCodeAt(0)};`)
}

function coordinate(value: number): string {
  return value.toFixed(6)
}

export function toGpx(route: LatLng[], routeName: string): string {
  const name = escapeXml(routeName)
  const points = route
    .map(
      (p, i) =>
        `    <rtept lat="${coordinate(p.lat)}" lon="${coordinate(p.lng)}"><name>${waypointName(i)}</name></rtept>`,
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Dibujos de vuelo" xmlns="http://www.topografix.com/GPX/1/1">
  <rte>
    <name>${name}</name>
${points}
  </rte>
</gpx>
`
}

export function toKml(route: LatLng[], routeName: string): string {
  const name = escapeXml(routeName)
  const coordinates = route.map((p) => `${coordinate(p.lng)},${coordinate(p.lat)},0`).join(' ')
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <Placemark>
      <name>${name}</name>
      <LineString><tessellate>1</tessellate><coordinates>${coordinates}</coordinates></LineString>
    </Placemark>
  </Document>
</kml>
`
}

export function toCsv(route: LatLng[]): string {
  const rows = route.map((p, i) => `${waypointName(i)},${coordinate(p.lat)},${coordinate(p.lng)}`)
  return ['name,lat,lon', ...rows].join('\n') + '\n'
}

export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
