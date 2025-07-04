# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture Overview

This is a React-based interactive fireworks visualization that uses HTML Canvas for rendering and PeerJS for real-time multiplayer functionality.

### Core Components

**App.jsx** - Main application component containing:

- Canvas-based fireworks animation system with three main classes:
  - `Star` - Twinkling background stars
  - `Rocket` - Projectiles that launch upward with trailing effects
  - `Particle` - Explosion particles with physics simulation
- Unified pointer event handling for both mouse and touch interactions
- Color palette system for customizable firework colors
- Real-time networking integration via PeerJS

**network.js** - Peer-to-peer networking layer:

- Initializes PeerJS connections with Google STUN servers
- Handles peer discovery and connection management
- Broadcasts firework launch events to connected peers
- Manages connection lifecycle (open, data, close, error)

### Key Technical Details

- Uses `requestAnimationFrame` for smooth 60fps animation
- Implements device pixel ratio scaling for high-DPI displays
- Canvas uses "lighter" composite operation for bright particle effects
- Pointer events are unified to handle both mouse and touch consistently
- Touch events use `passive: false` to prevent scrolling
- Animation pauses when page is hidden (visibility API)
- Vite configured with base path `/fireworks/` for GitHub Pages deployment

### Networking Architecture

The app supports real-time multiplayer fireworks via WebRTC:

- Each user gets a unique peer ID from PeerJS
- Firework launch events are broadcast to all connected peers
- Events include position (x,y) and color information
- No central server required - uses PeerJS's free relay service

### Development Notes

- Built with React 19 and Vite 7
- No test framework currently configured
- Uses ESLint for code quality
- Deployed automatically to GitHub Pages via GitHub Actions
