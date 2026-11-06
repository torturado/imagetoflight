import { useDeferredValue, useMemo, useState } from 'react'
import { downloadFile, toCsv, toGpx, toKml } from './exporters'
import { distanceNm, toLatLng, turnRadiusNm, type LatLng, type Placement } from './geometry'
import { RouteMap } from './RouteMap'
import { TracePreview } from './TracePreview'
import { autoSettings, rasterize, traceImage, type GrayImage, type TraceSettings } from './tracing'

const BANK_ANGLE_DEG = 30
/** Simplification tolerance as a share of the turn radius: half a radius keeps curves round. */
const DETAIL_PER_TURN_RADIUS = 0.5

type Source = { image: HTMLImageElement; gray: GrayImage; name: string }

const buttonClass =
  'inline-flex items-center justify-center rounded-md border border-ink/25 px-3 py-2 text-sm font-medium text-ink transition hover:-translate-y-px hover:border-ink/60 hover:bg-panel active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'
const primaryButtonClass =
  'inline-flex items-center justify-center rounded-md bg-route px-3 py-2 text-sm font-medium text-white transition hover:-translate-y-px hover:bg-[#1c46b3] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40'

function Slider(props: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
}) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-baseline justify-between text-sm">
        <span>{props.label}</span>
        <span className="font-mono text-[13px] text-muted">
          {props.value}&nbsp;{props.unit}
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        className="accent-route"
      />
    </label>
  )
}

function Panel(props: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-line px-5 py-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-medium text-muted">{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  )
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('No se pudo leer la imagen'))
    image.src = URL.createObjectURL(file)
  })
}

export default function App() {
  const [source, setSource] = useState<Source | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showImage, setShowImage] = useState(true)
  const [settings, setSettings] = useState<TraceSettings>({
    threshold: 128,
    invert: false,
    maxWaypoints: 300,
  })
  const [speedKt, setSpeedKt] = useState(120)
  const [placement, setPlacement] = useState<Placement>({
    center: { lat: 36.25, lng: -93.9 },
    sizeNm: 40,
    rotationDeg: 0,
  })

  const updateSettings = (change: Partial<TraceSettings>) =>
    setSettings((current) => ({ ...current, ...change }))

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const image = await loadImage(file)
      const gray = rasterize(image)
      setSource({ image, gray, name: file.name.replace(/\.[^.]+$/, '') })
      updateSettings(autoSettings(gray))
      setError(null)
    } catch {
      setError('Ese archivo no es una imagen válida.')
    }
  }

  const turnRadius = turnRadiusNm(speedKt, BANK_ANGLE_DEG)
  // Details finer than the turn radius cannot be flown, so they set the tracing floor.
  const minTolerance = useDeferredValue((turnRadius * DETAIL_PER_TURN_RADIUS) / placement.sizeNm)
  const deferredSettings = useDeferredValue(settings)
  const traced = useMemo(
    () =>
      source ? traceImage(source.gray, deferredSettings, minTolerance) : { points: [], legs: [] },
    [source, deferredSettings, minTolerance],
  )

  const route = useMemo<LatLng[]>(
    () => traced.points.map((point) => toLatLng(point, placement)),
    [traced, placement],
  )

  const stats = useMemo(() => {
    let totalNm = 0
    let jumpNm = 0
    traced.legs.forEach((leg, index) => {
      const length = distanceNm(route[index], route[index + 1])
      totalNm += length
      if (leg === 'jump') jumpNm += length
    })
    return { totalNm, jumpNm, minutes: (totalNm / speedKt) * 60 }
  }, [traced, route, speedKt])

  const routeName = source?.name ?? 'dibujo'
  const exports = [
    { label: 'GPX', build: () => toGpx(route, routeName), extension: 'gpx', mime: 'application/gpx+xml' },
    { label: 'KML', build: () => toKml(route, routeName), extension: 'kml', mime: 'application/vnd.google-earth.kml+xml' },
    { label: 'CSV', build: () => toCsv(route), extension: 'csv', mime: 'text/csv' },
  ]

  const fileInput = (
    <input
      type="file"
      accept="image/*"
      className="sr-only"
      onChange={(event) => {
        void handleFile(event.target.files?.[0])
        event.target.value = ''
      }}
    />
  )

  return (
    <div className="flex min-h-dvh flex-col font-sans lg:h-dvh">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
        <h1 className="text-[17px] font-medium tracking-tight">Dibujos de vuelo</h1>
        <p className="hidden text-sm text-muted sm:block">
          De una imagen a una ruta de waypoints que dibuja con el rastro del avión
        </p>
      </header>

      <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[400px_1fr]">
        <aside
          className="border-line lg:overflow-y-auto lg:border-r"
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setIsDragging(false)
            void handleFile(event.dataTransfer.files[0])
          }}
        >
          <div className="px-5 py-5">
            {source ? (
              <div className="grid gap-3">
                <div className="overflow-hidden rounded-lg border border-line bg-white">
                  <TracePreview image={source.image} route={traced} showImage={showImage} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`${buttonClass} cursor-pointer`}>
                    Cambiar imagen
                    {fileInput}
                  </label>
                  <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showImage}
                      onChange={(event) => setShowImage(event.target.checked)}
                      className="accent-route"
                    />
                    Ver original
                  </label>
                </div>
                <p className="flex gap-4 text-[13px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-5 bg-route" /> Trazo
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0 w-5 border-t-2 border-dashed border-jump" /> Enlace visible
                  </span>
                </p>
              </div>
            ) : (
              <label
                className={`grid aspect-square cursor-pointer place-content-center gap-3 rounded-lg border-2 border-dashed px-8 text-center transition ${
                  isDragging ? 'border-route bg-white' : 'border-ink/25 hover:border-ink/50 hover:bg-panel'
                }`}
              >
                <span className="text-xl font-medium tracking-tight">Sube una imagen</span>
                <span className="text-[15px] leading-relaxed text-muted">
                  Un logo o una silueta con buen contraste funciona mejor. Arrástrala aquí o
                  haz clic para elegirla.
                </span>
                <span className={`${primaryButtonClass} mx-auto mt-2`}>Elegir imagen</span>
                {fileInput}
              </label>
            )}
            {error && <p className="mt-3 text-sm text-jump">{error}</p>}
          </div>

          <Panel
            title="Trazado"
            action={
              <button
                className="text-[13px] font-medium text-route underline-offset-4 hover:underline disabled:opacity-40"
                disabled={!source}
                onClick={() => source && updateSettings(autoSettings(source.gray))}
              >
                Ajuste automático
              </button>
            }
          >
            <Slider
              label="Umbral de contraste"
              value={settings.threshold}
              min={1}
              max={254}
              step={1}
              unit=""
              onChange={(threshold) => updateSettings({ threshold })}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.invert}
                onChange={(event) => updateSettings({ invert: event.target.checked })}
                className="accent-route"
              />
              Trazar las zonas claras en vez de las oscuras
            </label>
            <Slider
              label="Waypoints máximos"
              value={settings.maxWaypoints}
              min={50}
              max={1000}
              step={10}
              unit=""
              onChange={(maxWaypoints) => updateSettings({ maxWaypoints })}
            />
          </Panel>

          <Panel title="Vuelo">
            <Slider
              label="Ancho del dibujo"
              value={placement.sizeNm}
              min={2}
              max={150}
              step={1}
              unit="NM"
              onChange={(sizeNm) => setPlacement((p) => ({ ...p, sizeNm }))}
            />
            <Slider
              label="Rotación"
              value={placement.rotationDeg}
              min={-180}
              max={180}
              step={5}
              unit="°"
              onChange={(rotationDeg) => setPlacement((p) => ({ ...p, rotationDeg }))}
            />
            <Slider
              label="Velocidad de crucero"
              value={speedKt}
              min={60}
              max={250}
              step={5}
              unit="kt"
              onChange={setSpeedKt}
            />
            <p className="text-[13px] leading-relaxed text-muted">
              Radio de viraje a {speedKt} kt con {BANK_ANGLE_DEG}° de alabeo:{' '}
              {turnRadius.toFixed(2)} NM. Las curvas se simplifican hasta medio radio y se descartan
              las figuras demasiado pequeñas para volarlas; las esquinas cerradas el avión las
              redondeará.
            </p>
          </Panel>

          <Panel title="Ruta">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {[
                ['Waypoints', String(route.length)],
                ['Distancia', `${stats.totalNm.toFixed(1)} NM`],
                ['Tiempo', `${Math.floor(stats.minutes / 60)} h ${Math.round(stats.minutes % 60)} min`],
                ['Enlaces visibles', `${stats.jumpNm.toFixed(1)} NM`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[13px] text-muted">{label}</dt>
                  <dd className="font-mono text-lg">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="grid grid-cols-3 gap-2">
              {exports.map((format) => (
                <button
                  key={format.label}
                  className={format.label === 'GPX' ? primaryButtonClass : buttonClass}
                  disabled={route.length < 2}
                  onClick={() =>
                    downloadFile(format.build(), `${routeName}.${format.extension}`, format.mime)
                  }
                >
                  {format.label}
                </button>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-muted">
              Solo para planificación. Comprueba espacio aéreo, terreno y NOTAM antes de volar.
            </p>
          </Panel>
        </aside>

        <main className="relative h-[70vh] lg:h-auto">
          <RouteMap
            center={placement.center}
            points={route}
            legs={traced.legs}
            onCenterChange={(center) => setPlacement((p) => ({ ...p, center }))}
          />
          <p className="pointer-events-none absolute top-3 left-3 z-[1000] rounded-md bg-paper/90 px-3 py-1.5 text-[13px] text-ink shadow-sm">
            Haz clic en el mapa para colocar el dibujo
          </p>
        </main>
      </div>
    </div>
  )
}
