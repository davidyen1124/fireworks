# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Deployment Commands

- `npm run deploy:worker` - Deploy WebSocket backend to Cloudflare Workers
- `npm run deploy:pages` - Deploy frontend to Cloudflare Pages
- `npm run deploy` - Deploy both worker and pages
- `wrangler deploy` - Deploy worker only

## Environment Variables

- `VITE_WS_URL` - WebSocket server URL (required for production)
  - Development: `ws://localhost:8787`
  - Production: `wss://fireworks-ws.your-subdomain.workers.dev`

## Architecture Overview

This is a React-based interactive fireworks visualization that uses HTML Canvas for rendering and WebSocket for real-time multiplayer functionality. The app is deployed on Cloudflare infrastructure.

### Core Components

**App.jsx** - Main application component containing:

- Canvas-based fireworks animation system with three main classes:
  - `Star` - Twinkling background stars
  - `Rocket` - Projectiles that launch upward with trailing effects
  - `Particle` - Explosion particles with physics simulation
- Unified pointer event handling for both mouse and touch interactions
- Color palette system for customizable firework colors
- Real-time networking integration via WebSocket

**src/hooks/useWebSocket.js** - WebSocket management hook:

- Handles connection lifecycle with automatic reconnection
- Implements heartbeat pings to prevent idle disconnects (30-second intervals)
- Manages connection state (myId, clientCount)
- Exponential backoff retry mechanism with configurable attempts
- Environment-aware WebSocket URL configuration

**src/utils/roomId.js** - Room ID generation utility:

- Generates cryptographically secure 6-character room IDs
- Uses base-62 encoding for URL-friendly identifiers
- Provides random room creation for multiplayer sessions

**worker/index.js** - Cloudflare Worker with Durable Objects:

- FireworksRoom Durable Object manages room state and connections
- Handles WebSocket upgrades and connection management
- Broadcasts messages between users in the same room
- Provides CORS support for cross-origin requests
- Implements connection tracking with UUID-based client identification

### Key Technical Details

- Uses `requestAnimationFrame` for smooth 60fps animation
- Implements device pixel ratio scaling for high-DPI displays
- Canvas uses "lighter" composite operation for bright particle effects
- Pointer events are unified to handle both mouse and touch consistently
- Touch events use `passive: false` to prevent scrolling
- Vite configured with root base path for Cloudflare Pages deployment

### Networking Architecture

The app supports real-time multiplayer fireworks via WebSocket and Cloudflare Durable Objects:

- Each user connects to a WebSocket endpoint hosted on Cloudflare Workers
- Room isolation via URL parameters (e.g., `?room=myroom`)
- Durable Objects maintain connection state across multiple Worker instances
- Firework launch events include position (x,y) and color information
- Real-time client join/leave notifications with accurate client counts
- Automatic reconnection with exponential backoff (up to 5 attempts)
- Heartbeat ping mechanism every 30 seconds to prevent idle disconnects
- Environment-aware connection handling (dev vs production URLs)
- Connection state tracking with unique client IDs and live client counts

### Message Format

WebSocket messages use a simple JSON structure:
- Firework events: `{ t: 'launch', x: number, y: number, color: string }`
- Connection events: `{ type: 'connected', id: string, clientCount: number }`
- Client events: `{ type: 'client_joined'|'client_left', id: string, clientCount: number }`

## Configuration Files

- **wrangler.toml** (root) - Cloudflare Pages configuration
- **worker/wrangler.toml** - Worker configuration with Durable Objects
  - Defines `FIREWORKS_ROOM` binding for Durable Objects
  - Includes SQLite migrations for room state persistence
  - Sets compatibility date and deployment settings
- **DEPLOYMENT.md** - Detailed deployment guide with step-by-step instructions
- **.env.example** - Environment variable template

### Deployment Infrastructure

- **Frontend**: Cloudflare Pages at https://your-app-id.your-project.pages.dev
- **Backend**: Cloudflare Workers at https://your-worker-name.your-subdomain.workers.dev
- **State Management**: Durable Objects with SQLite storage
- **Configuration**: Dual wrangler.toml setup (root for Pages, worker/ for Workers)
### Development Notes

- Built with React 19 and Vite 7
- No test framework currently configured
- Uses ESLint for code quality
- Deployed on Cloudflare infrastructure (Workers + Pages + Durable Objects)
- Room support allows multiple isolated multiplayer sessions
- Environment variable configuration required for production deployment
- WebSocket connection management with React hooks pattern
- Cryptographically secure room ID generation
- Dual wrangler.toml configuration for Pages and Workers deployment
