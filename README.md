# Gee Graphics POS

A sleek, retail-first point-of-sale experience built for fast checkout, product browsing, and customer-friendly transactions.

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-5-646cff?logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PWA-Installable-ff4d4d?logo=progressivewebapps" alt="PWA" />
</p>

## Why this exists

Gee Graphics POS is designed for modern retail operations where speed matters. It combines a clean sales dashboard, quick product search, customer handling, order tracking, and offline-capable install behavior in a single, streamlined interface.

The app feels like a premium internal tool: crisp, dark, and focused on getting the transaction done without the usual retail clutter.

## Highlights

- Fast product catalog browsing and filtering
- Cart-based checkout flow with subtotal, tax, and totals
- Multiple payment modes including cash and online payment details
- Customer records and repeat purchase tracking
- Daily orders and revenue insights
- Local-first persistence using browser storage
- Installable PWA experience for desktop and mobile use
- Offline shell support for resilient usage

## Tech stack

- React + TypeScript
- Vite for fast development and production builds
- CSS-driven dark retail UI
- LocalStorage-backed state persistence
- Web App Manifest + Service Worker for PWA support

## Quick start

```bash
npm install
npm run dev
```

Then open the local Vite URL in your browser.

## Production build

```bash
npm run build
npm run preview
```

## Project structure

```text
.
├── public/
│   ├── icons/
│   ├── manifest.webmanifest
│   └── sw.js
├── src/
│   ├── App.tsx
│   ├── data.ts
│   ├── icons.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## PWA notes

This app is configured as a standalone web app for installable use:

- manifest metadata for app identity and display
- theme color and mobile app shell configuration
- service worker registration for offline caching
- app icon assets for home screen installation

## Scripts

```bash
npm run dev      # start local development server
npm run build    # type-check + production bundle
npm run preview  # preview production build locally
```

## Design philosophy

This interface is built around a simple idea: when someone is selling, everything else should disappear.

The experience emphasizes:

- high contrast for clarity
- dense but readable layouts
- strong product and transaction focus
- elegant dashboard treatment without visual noise

## License

This project is currently a local application for Gee Graphics operations and is intended for internal or operational use.

---

Made for fast transactions, sharp inventory flow, and a seriously polished POS experience.
