# DEV-P04 · AXIOM Industrial Digital Twin

A browser-based industrial motor simulation built with React, TypeScript, Three.js, React Three Fiber, Drei, and Recharts. The original checkout contained only a one-line README; there was no existing frontend, backend, routing, trained model, or portal to integrate. This implementation establishes the portal and its 3D Digital Twin section.

**Software simulation only.** All readings are manually controlled or set by demonstration presets. Diagnostics and maintenance drafts come from configurable deterministic thresholds. They are not validated predictions, confirmed component failures, or manufacturer specifications. No ML, datasets, sensors, external API, cloud database, or downloaded 3D models are required.

## Windows quick start

Download this branch using GitHub's **Code → Download ZIP**, then extract it. Place the extracted project files in `C:\Users\amard\OneDrive\Desktop\devathon` so that `package.json` and `Install-and-Run.cmd` are directly inside that folder.

Double-click **Install-and-Run.cmd**. It checks Node.js, offers to install the official Node.js LTS package using Windows Package Manager if necessary, installs the locked npm dependencies, builds the application, and opens the development server in your browser. Keep the terminal window open while using the simulator. If Windows Package Manager is unavailable, install Node.js LTS from https://nodejs.org and run the launcher again. The launcher has not been tested on Windows in this Linux cloud session; the application build and browser workflow have been validated here.

## Run locally

Use Node.js 22.12+ or a supported newer version and npm. Node.js 24 is used in the cloud environment.

```sh
cd /workspace/devathon
npm ci
npm run dev
```

Vite prints the development address and port. For a fresh clone outside the cloud environment, change into its actual checkout directory instead. The development server binds to all interfaces to support a cloud workspace; expose it only through your environment's supported development access.

```sh
npm test         # threshold, event, independence and restoration tests
npm run build    # strict TypeScript check and production bundle
npm run preview  # serve the production bundle after building
```

The generated `dist/` directory can be served by a static host. Installation needs the npm registry; running the installed application needs no external service. A WebGL-capable browser with hardware acceleration is recommended for the 3D view. If rendering is unavailable, the interface provides a fallback while controls and diagnostics remain usable.

## Demonstration

1. Open **3D Digital Twin** and select **MOTOR-01**.
2. Set RPM to **4000**. The shaft, rotor and fan spin faster; the speed diagnostic is Warning at this boundary.
3. Set temperature to **110 °C** and vibration to **10 mm/s**. The machine becomes Critical, the motor highlights and shakes, and threshold-crossing alerts include inspection suggestions.
4. Generate a maintenance work order. It captures the selected machine's current condition and anomalies as a simulation-derived draft. Use the print view and the browser's **Save as PDF** destination when available.
5. Reset the selected motor to its defaults. Recovery events appear when readings return to normal.
6. Select **MOTOR-02** to verify its independent readings. Changing or resetting one motor does not modify another.
7. Try thermal visualization, cutaway, camera presets, and the four demonstration presets. Manual controls can override presets.

Power, Start/Stop and Pause Animation control the visual operating state. Power off preserves configured readings. Readings remain manual inputs, so switching power off does not erase an existing threshold violation. Animation uses a deliberately scaled rotation speed at high RPM to remain readable on a display; it is a visual representation, not a stroboscopic measurement of physical shaft speed.

## Rules and state

Default limits live in `src/simulation.ts` and can be configured in Simulation Settings:

| Parameter | Normal | Warning | Critical |
| --- | --- | --- | --- |
| Temperature | below 70 °C | 70–90 °C | above 90 °C |
| Vibration | below 4 mm/s | 4–8 mm/s | above 8 mm/s |
| RPM | 0–3000 | above 3000 through 4000 | above 4000 |
| Current | below 12 A | 12–18 A | above 18 A |

Load is independently controlled from 0–100% and is shown as a visual indicator; it does not automatically change another reading or add an undisclosed fault rule. Machine 03 intentionally starts in Warning because several of its default readings exceed warning limits.

Alerts are generated on severity-band transitions, including recovery and transitions caused by edited thresholds. Repeated samples within the same band do not create duplicate alerts. Charts retain approximately the latest 120 seconds of locally generated samples. Machine configurations are stored locally in the current browser; no information is sent to a server. Invalid or unavailable local storage falls back to safe defaults.

## Code organization

- `src/simulation.ts`: machine defaults, parameter definitions, threshold classification, alert transitions, presets and configuration restoration.
- `src/MotorScene.tsx`: procedural motor geometry, materials, studio lighting, orbit camera, component reactions and frame-based animation.
- `src/App.tsx`: portal navigation, independent machine state, controls, charts, alerts, settings and maintenance drafts.
- `src/simulation.test.ts`: deterministic rule boundaries, event metadata/recovery/deduplication, independent state and storage validation.

Only one detailed 3D scene is needed at a time. Rendering animation stays inside React Three Fiber's frame loop rather than rerendering the full dashboard per frame. The motor is constructed from geometry in the repository and uses no external model or texture downloads.

## Browser verification

```sh
npx playwright install chromium
npm run test:e2e
```

The browser suite starts Vite automatically when needed and exercises the demo, threshold configuration, recovery, persistence, responsive navigation, WebGL fallback, and actual canvas movement/pause behavior. In this cloud environment Chromium is already installed, so use:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

`src/useSimulation.ts` owns state transitions, independent preset interpolation, timestamped history, configuration persistence, alerts, and immutable work-order snapshots. Machine configurations and thresholds persist in browser storage. Alerts and generated orders are retained for the current session; download or print orders before reloading. Chart updates are coalesced into 100 ms buckets during interaction and sampled every second at rest, retaining the latest 120 seconds. One 3D viewer is lazy-loaded; Three.js makes its production bundle larger than a typical form application.
