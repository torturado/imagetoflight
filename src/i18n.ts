export const LANGUAGES = { en: 'English', es: 'Español' } as const
export type Language = keyof typeof LANGUAGES

const en = {
  tagline: 'Turn an image into a waypoint route that draws it with the aircraft’s track',
  uploadTitle: 'Upload an image',
  uploadHint: 'A logo or silhouette with strong contrast works best. Drop it here or click to choose it.',
  chooseImage: 'Choose image',
  changeImage: 'Change image',
  showOriginal: 'Show original',
  legendDrawn: 'Drawn line',
  legendJump: 'Visible connector',
  invalidImage: 'That file is not a valid image.',
  tracingTitle: 'Tracing',
  autoAdjust: 'Auto adjust',
  threshold: 'Contrast threshold',
  invert: 'Trace light areas instead of dark ones',
  maxWaypoints: 'Maximum waypoints',
  flightTitle: 'Flight',
  drawingWidth: 'Drawing width',
  rotation: 'Rotation',
  cruiseSpeed: 'Cruise speed',
  turnRadiusNote: (speedKt: number, bankDeg: number, radiusNm: string) =>
    `Turn radius at ${speedKt} kt and ${bankDeg}° of bank: ${radiusNm} NM. Curves are simplified down to half a radius and shapes too small to fly are dropped; the aircraft will round off sharp corners.`,
  routeTitle: 'Route',
  waypoints: 'Waypoints',
  distance: 'Distance',
  time: 'Time',
  visibleConnectors: 'Visible connectors',
  disclaimer: 'For planning only. Check airspace, terrain and NOTAMs before flying.',
  mapHint: 'Click the map to place the drawing',
  routeStart: 'Start',
  defaultRouteName: 'drawing',
}

export type Messages = typeof en

const es: Messages = {
  tagline: 'De una imagen a una ruta de waypoints que la dibuja con el rastro del avión',
  uploadTitle: 'Sube una imagen',
  uploadHint: 'Un logo o una silueta con buen contraste funciona mejor. Arrástrala aquí o haz clic para elegirla.',
  chooseImage: 'Elegir imagen',
  changeImage: 'Cambiar imagen',
  showOriginal: 'Ver original',
  legendDrawn: 'Trazo',
  legendJump: 'Enlace visible',
  invalidImage: 'Ese archivo no es una imagen válida.',
  tracingTitle: 'Trazado',
  autoAdjust: 'Ajuste automático',
  threshold: 'Umbral de contraste',
  invert: 'Trazar las zonas claras en vez de las oscuras',
  maxWaypoints: 'Waypoints máximos',
  flightTitle: 'Vuelo',
  drawingWidth: 'Ancho del dibujo',
  rotation: 'Rotación',
  cruiseSpeed: 'Velocidad de crucero',
  turnRadiusNote: (speedKt, bankDeg, radiusNm) =>
    `Radio de viraje a ${speedKt} kt con ${bankDeg}° de alabeo: ${radiusNm} NM. Las curvas se simplifican hasta medio radio y se descartan las figuras demasiado pequeñas para volarlas; las esquinas cerradas el avión las redondeará.`,
  routeTitle: 'Ruta',
  waypoints: 'Waypoints',
  distance: 'Distancia',
  time: 'Tiempo',
  visibleConnectors: 'Enlaces visibles',
  disclaimer: 'Solo para planificación. Comprueba espacio aéreo, terreno y NOTAM antes de volar.',
  mapHint: 'Haz clic en el mapa para colocar el dibujo',
  routeStart: 'Inicio',
  defaultRouteName: 'dibujo',
}

export const MESSAGES: Record<Language, Messages> = { en, es }

const STORAGE_KEY = 'language'

function isLanguage(value: string | null): value is Language {
  return value !== null && value in LANGUAGES
}

/** The saved choice, else the first browser language the app speaks, else English. */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // Storage can be unavailable (private mode, blocked site data); fall back to the browser.
  }
  return (
    navigator.languages.map((tag) => tag.slice(0, 2).toLowerCase()).find(isLanguage) ?? 'en'
  )
}

export function saveLanguage(language: Language): void {
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Not remembering the choice is harmless.
  }
}
