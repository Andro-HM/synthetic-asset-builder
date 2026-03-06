# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.



# V1:
# Synthetic Asset Builder — Completed Walkthrough

## What Was Built

A fully stateless, browser-only React SPA for viewing real financial instruments and composing synthetic charts from weighted combinations of multiple assets.

## File Structure

```
synthetic-asset-builder/
├── vite.config.js              # Vite + Tailwind v4 plugin
├── src/
│   ├── index.css               # Tailwind + dark theme base
│   ├── main.jsx                # React entry point
│   ├── App.jsx                 # Root layout + view switcher
│   ├── utils/
│   │   ├── api.js              # Yahoo Finance fetch (via corsproxy.io)
│   │   └── math.js             # Date alignment, forward-fill, linear combo
│   └── components/
│       ├── Navbar.jsx          # Top nav with view toggle
│       ├── LiveSearch.jsx      # Debounced async search dropdown
│       ├── ChartComponent.jsx  # TradingView Lightweight Charts wrapper
│       ├── SingleAssetViewer.jsx
│       └── SyntheticBuilder.jsx
```

## Key Implementation Details

| Area | Decision |
|---|---|
| **CORS** | `https://corsproxy.io/?` used as primary proxy for both search and chart Yahoo endpoints |
| **Dates** | Yahoo timestamps (Unix seconds) parsed to `YYYY-MM-DD` UTC strings — no timezone shift artifacts |
| **Forward Fill** | Carries *previous* day OHLCV forward into missing dates (not backward) |
| **Volume (short positions)** | Uses `Math.abs(weight) × volume` so negative weights don't produce negative bars |
| **Synthetic High/Low** | Recalculates `actualHigh = max(O,H,L,C)` after weighting, since negative weights can invert the natural OHLC ordering |
| **Chart Resize** | `ResizeObserver`-free approach: listens to `window.resize` and calls `chart.applyOptions({width})` |

## Verification

- ✅ **Production build**: `npm run build` — 1755 modules transformed, 0 errors, 0 warnings
- ✅ **Dev server**: Runs at `http://localhost:5173`
- ⚠️ **Browser automation**: Unavailable on Windows (Chrome subagent is Linux-only) — manual verification needed

## How to Run

```powershell
cd C:\_VAULT\Trading\synthetic-asset-builder
$env:PATH += ";C:\Program Files\nodejs"
npm run dev
```
Then open **http://localhost:5173** in your browser.
