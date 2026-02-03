# NetScope - Network Information Dashboard

## Overview

NetScope is a network information dashboard that displays a user's IP address, geolocation, browser details, and connection information in real-time. The application follows a full-stack TypeScript architecture with a React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2026-02-03**: Added Speed Test feature
  - Real-time download/upload speed testing with streaming data endpoints
  - Ping latency measurement using Cloudflare CDN (routes to nearest edge server)
  - Speed test history graph using recharts (keeps last 10 results)
  - Progress indicators for each test phase

- **2026-02-03**: Initial MVP implementation
  - Created network dashboard UI with 6 info cards (Location, Connection, Network Speed, Browser, Display, Server Info)
  - Implemented IP geolocation API integration with ip-api.com
  - Added dark/light theme toggle with system preference detection
  - Added comprehensive data-testid attributes for testing
  - Added SEO meta tags and Open Graph/Twitter cards

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and data fetching
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style variant)
- **Theming**: Custom theme provider supporting light/dark/system modes with CSS variables
- **Build Tool**: Vite with path aliases (`@/` for client, `@shared/` for shared code)

### Backend Architecture
- **Framework**: Express 5 with TypeScript
- **Runtime**: Node.js with tsx for development
- **API Design**: RESTful endpoints under `/api/` prefix
- **Static Serving**: Production builds served from `dist/public`
- **Development**: Vite dev server integration with HMR support

### API Endpoints
- `GET /api/network-info` - Returns IP geolocation and network information
- `GET /api/ping` - Simple ping endpoint for latency measurement
- `GET /api/speed-test/download?size=X` - Downloads random data for speed testing (default 1MB, max 10MB)
- `POST /api/speed-test/upload` - Receives data for upload speed testing (max 10MB)
- `GET /api/server-info` - Returns server location info for speed test display

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/  # UI components (shadcn/ui + custom)
│       │   ├── info-card.tsx      # Reusable info card component
│       │   ├── theme-provider.tsx # Dark/light theme context
│       │   └── theme-toggle.tsx   # Theme toggle button
│       ├── hooks/       # Custom React hooks
│       ├── lib/         # Utilities and query client
│       └── pages/       # Route page components
│           └── home.tsx # Main network dashboard page
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── static.ts     # Static file serving
│   └── vite.ts       # Vite dev server integration
├── shared/           # Shared code between client/server
│   └── schema.ts     # Zod schemas and types
```

### Key Design Decisions
1. **No Database Required**: This app only displays real-time network info, no data persistence needed
2. **Type Safety**: End-to-end TypeScript with Zod validation for API contracts
3. **Component Library**: shadcn/ui provides consistent, accessible UI primitives with Radix UI foundations
4. **Build Process**: Custom build script bundles server dependencies to reduce cold start times

## External Dependencies

### External APIs
- **ip-api.com**: Used for IP geolocation lookup (free tier, HTTP only)
  - Note: Free tier only supports HTTP. HTTPS requires a paid subscription.
  - The backend makes these requests server-side to avoid CORS issues

### Key NPM Packages
- **@tanstack/react-query**: Server state management
- **drizzle-orm / drizzle-zod**: Database ORM and schema validation (available if needed)
- **Radix UI primitives**: Accessible component foundations (dialog, dropdown, tooltip, etc.)
- **class-variance-authority / clsx / tailwind-merge**: Styling utilities for component variants

### Development Tools
- **Vite**: Frontend bundler with HMR
- **tsx**: TypeScript execution for development
- **esbuild**: Production server bundling
- **@replit/vite-plugin-***: Replit-specific development enhancements
