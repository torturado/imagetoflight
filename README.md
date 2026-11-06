# Image to Flight

**English** · [Español](README.es.md)

Turn any image into a flight route whose GPS track draws that image.

Upload a logo or silhouette, place it on the map and export the waypoints as GPX, KML or CSV. It makes the same kind of drawing the Cessna N1810R flew over Arkansas with the GTA VI logo.

![The app with the GTA VI logo turned into a route over Arkansas](docs/app.png)

<p align="center">
  <img src="docs/flight.gif" width="420" alt="The aircraft track drawing the exported route, waypoint by waypoint">
</p>

## Examples

Top row: the original image. Bottom row: the generated route. The drawn line is blue; the dashed orange lines are the connectors between shapes.

![A logo, a silhouette and lettering next to their routes](docs/examples.png)

## How it works

1. **Outlines.** The image is converted to grayscale and split into ink and background with a contrast threshold (Otsu's method). The app detects on its own whether the ink is dark on light or light on dark. The outlines are then extracted with marching squares.
2. **Flyable simplification.** Outlines are simplified with Ramer–Douglas–Peucker until they fit the waypoint limit. The finest detail kept is half the turn radius at the chosen speed. Shapes too small to fly are dropped before large ones get distorted.
3. **One continuous line.** Shapes are joined with a minimum spanning tree. The aircraft flies out along the shortest connector, draws the shape and flies back along the same connector. That keeps the extra lines in the track to a minimum, and no outline is flown twice.
4. **Placement.** Click the map to centre the drawing, then set its width in nautical miles, its rotation and the cruise speed. The app shows the distance, the flight time and how many miles of connectors will stay visible.

The interface is available in English and Spanish. It follows your browser language, and you can switch it from the header.

## Export formats

| Format | Use it for |
|---|---|
| **GPX** | A route with waypoints `D001`, `D002`… for ForeFlight, Garmin Pilot, SkyDemon and similar apps |
| **KML** | One continuous line for Google Earth or as a map layer in an EFB |
| **CSV** | `name,lat,lon`, for your own processing |

Many avionics units cap a flight plan at about 100 waypoints. For a detailed drawing it is usually easier to load the KML as a map layer and fly it by eye, and keep the GPX for units that accept long routes.

## Tips

- Logos, silhouettes and lettering with strong contrast work best. Photos need the threshold adjusted by hand.
- About 300 waypoints are enough for a logo with lettering to read. Below 200 the letters start to break up.
- A larger drawing holds more detail, but the distance grows just as fast: the GTA VI logo 40 NM wide is about 780 NM, roughly 6.5 hours at 120 kt.

## Development

Requires Node 22 or later and pnpm.

```bash
pnpm install
pnpm dev       # http://localhost:5173
pnpm build     # type check + production build in dist/
pnpm lint
```

Built with React, Vite, Tailwind, [Leaflet](https://leafletjs.com) and [d3-contour](https://github.com/d3/d3-contour). Everything runs in the browser; your image is never uploaded to a server.

## Disclaimer

This is a planning tool, not a navigation tool. Before flying any route, check airspace, terrain, NOTAMs and fuel.

Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors. The Grand Theft Auto VI logo is a trademark of Rockstar Games and appears here only as an example.
