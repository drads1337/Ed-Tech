# Ed-Tech 3D Training Demo

Interactive 3D prototype for an ed-tech training experience. The app uses React, Vite, Three.js, and React Three Fiber to display scenario-based 3D scenes with selectable cases, posed GLB characters, camera presets, and visual environment effects.

The repository also includes backend MVP notes for turning training material into AI-generated roleplay scenarios, assignments, employee attempts, scores, and admin dashboard data.

## Features

- React + Vite frontend.
- Three.js scene rendering through `@react-three/fiber`.
- GLB asset loading for character, standing, and desk/table scenes.
- Case-specific pose configuration in `src/casePoses.js`.
- Camera and environment presets for chaise, standing, and desk scenarios.
- Pose validation script for checking bone names and transform values against the GLB models.
- Backend MVP planning document in `docs/backend-instructions.md`.

## Tech Stack

- React 19
- Vite 8
- Three.js
- `@react-three/fiber`
- `@react-three/drei`
- Lucide React
- OGL

## Getting Started

### Prerequisites

- Node.js 20 or newer is recommended.
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Vite starts the app on a local development server and exposes it on the local network because the script uses `--host 0.0.0.0`.

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Available Scripts

```bash
npm run dev
```

Starts the Vite development server.

```bash
npm run build
```

Builds the frontend for production.

```bash
npm run preview
```

Serves the production build locally.

```bash
npm run check:pose
```

Validates the built-in pose configurations against the GLB model files.

## Project Structure

```text
.
├── docs/
│   └── backend-instructions.md
├── scripts/
│   ├── check-pose-config.mjs
│   └── measure-pose.mjs
├── src/
│   ├── App.jsx
│   ├── Aurora.jsx
│   ├── DarkVeil.jsx
│   ├── casePoses.js
│   ├── main.jsx
│   └── styles.css
├── bearded.glb
├── ordinary.glb
├── table.glb
├── index.html
├── package.json
└── vite.config.js
```

## 3D Assets

The app currently uses these GLB files:

- `ordinary.glb` for the chaise case.
- `bearded.glb` for the standing case.
- `table.glb` for the desk case.

Pose data is stored in `src/casePoses.js`. If a model is replaced or its skeleton changes, run:

```bash
npm run check:pose
```

This checks that configured bone rotations reference bones that exist in the selected model and that pose transforms contain valid numeric values.

## Backend MVP Direction

Backend planning lives in `docs/backend-instructions.md`. The intended MVP loop is:

```text
material -> scenario -> assignment -> employee attempt -> score -> admin dashboard
```

The backend should focus first on demo users, training material input, AI scenario generation, roleplay continuation, attempt evaluation, and dashboard data. Full authentication, payments, and a complete LMS are intentionally out of scope for the first version.

## Notes

- The frontend is currently a client-side Vite app.
- There is no backend service implemented in this repository yet.
- Large GLB assets are stored directly in the project root.
