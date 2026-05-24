# CortexBuild Field

**AI-powered Construction Site Management Mobile App**

CortexBuild Field is a React Native mobile application built with Expo SDK 54, designed for construction site teams to manage projects, safety inspections, daily reports, drawings, materials, equipment, and more — all from a mobile device on site.

---

## Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Project overview, pending items, recent activity |
| **Projects** | Full project lifecycle management |
| **Field** | On-site tools: daily reports, inspections, punch lists |
| **AI Agent** | AI-powered assistant for site queries and report generation |
| **Safety Inspections** | Checklist-based safety audits with photo evidence |
| **Daily Reports** | Weather, manpower, progress, and issue logging |
| **Drawings** | Drawing viewer with revision tracking |
| **Materials** | Material tracking and delivery management |
| **Equipment** | Equipment log and maintenance scheduling |
| **RFI / Submittals** | Request for Information and submittal workflows |
| **Defects** | Defect tracking with photo documentation |
| **Finance** | Budget tracking and cost management |
| **Documents** | File vault and document management |
| **Announcements** | Team-wide broadcast messaging |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Framework | Expo SDK 54 / React Native 0.81 |
| Language | TypeScript 5.9 |
| Navigation | Expo Router 6 (file-based) |
| Styling | NativeWind 4 (Tailwind CSS) |
| Animations | React Native Reanimated 4 |
| API | tRPC 11 + TanStack Query 5 |
| Database ORM | Drizzle ORM (PostgreSQL) |
| Server | Express + Node.js |
| Auth | JWT / OAuth |
| Storage | AsyncStorage + S3-compatible |

---

## Project Structure

```
app/
  (tabs)/          ← Main tab screens (Dashboard, Projects, Field, AI, More)
  *.tsx            ← Feature screens (inspections, reports, drawings, etc.)
server/
  routers.ts       ← tRPC API routes
  db.ts            ← PostgreSQL connection
drizzle/
  schema.ts        ← Database schema (31 tables)
  *.sql            ← Migration files
components/        ← Shared UI components
hooks/             ← Custom React hooks
lib/               ← Utilities, theme, tRPC client
assets/            ← App icons, splash screen
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- Expo Go app (for device testing) or Xcode/Android Studio (for native builds)
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/adrianstanca1/cortexbuild-field.git
cd cortexbuild-field

# Install dependencies
pnpm install

# Set up environment variables
cp .env.production.template .env.local
# Edit .env.local with your database credentials and API keys
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for JWT token signing |
| `API_PORT` | Server port (default: 3005) |
| `S3_BUCKET` | S3 bucket name for file storage |
| `S3_REGION` | S3 region |
| `S3_ACCESS_KEY` | S3 access key |
| `S3_SECRET_KEY` | S3 secret key |

### Running Locally

```bash
# Start both Metro bundler and API server
pnpm dev

# Start only the Metro bundler
pnpm dev:metro

# Start only the API server
pnpm dev:server
```

### Database Setup

```bash
# Run migrations
pnpm db:push

# Or apply the SQL migration directly
psql -U postgres -d cortexbuild_field -f drizzle/0001_cortexfield_pg.sql
```

---

## Building for iOS (TestFlight)

This project uses **EAS Build** (Expo Application Services) for iOS distribution.

### Prerequisites

1. An [Expo account](https://expo.dev) with EAS enabled
2. An Apple Developer account
3. EAS CLI installed: `npm install -g eas-cli`

### Build & Submit

```bash
# Log in to Expo
eas login

# Configure EAS (first time only)
eas build:configure

# Build for iOS TestFlight
eas build --platform ios --profile preview

# Submit to TestFlight
eas submit --platform ios
```

See [eas.json](./eas.json) for build profiles.

---

## Deployment (VPS)

The API server is deployed on a VPS at `field.cortexbuildpro.com` using **PM2** and **Nginx**.

### Operator scripts (on the server)

From a clone on the VPS:

- `bash scripts/vps-probe.sh` — diagnostics (ports, PM2, local health).
- `sudo SKIP_CONFIRM=1 bash scripts/vps-bootstrap.sh` — install Node 22, pnpm, pm2, nginx, `postgresql-client` (optional Docker / Certbot / UFW — see script).
- `sudo bash scripts/vps-install-nginx-site.sh <domain> <web_root>` — HTTP Nginx site for PM2 on port 3005; then `certbot --nginx`.

Details: [DEPLOY.md](./DEPLOY.md), [scripts/README.md](./scripts/README.md).

### Server Setup

```bash
# Build the server bundle
pnpm build

# Start with PM2
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save
pm2 startup
```

### Nginx Configuration

The Nginx config is located at `/etc/nginx/sites-enabled/field.cortexbuildpro.com` on the VPS. SSL is managed by **Certbot** (Let's Encrypt), auto-renewing every 90 days.

---

## CI/CD

GitHub Actions automatically deploys to the VPS on every push to `main`. See [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml).

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS hostname or IP |
| `VPS_USER` | SSH user (e.g. `root` or deploy user) |
| `VPS_SSH_KEY` | Private SSH key (PEM) for `VPS_USER` |
| `VPS_SSH_PORT` | Optional; default `22` |
| `VPS_APP_DIR` | Optional; app path on server (default `/var/www/cortexbuild-field`) |
| `VPS_WEB_DIR` | Optional; primary web root for Expo export (default `/var/www/html`) |
| `DATABASE_URL` | Optional in Actions if already in server `.env`; used to merge into `.env` on deploy |
| `JWT_SECRET` | Optional; merged into `.env` if set |
| `BUILT_IN_FORGE_API_URL` | Optional; Manus Forge URL |
| `BUILT_IN_FORGE_API_KEY` | Optional; Manus Forge key |
| `BOOTSTRAP_SUPERADMIN_PASSWORD` | Optional; enables super-admin seed step after deploy |

**Actions variables** (optional, **Settings → Secrets and variables → Actions → Variables**):

| Variable | Description |
|----------|-------------|
| `HEALTH_API_BASE` | Base URL for API health/version checks (default `https://field.cortexbuildpro.com`) |
| `HEALTH_WWW_BASE` | Base URL for public web checks (default `https://www.cortexbuildpro.com`) |
| `VPS_WWW_ROOT` | Absolute path on the VPS where **www** static files are deployed when that directory is not picked up from `VPS_WEB_DIR` or Nginx `root` scans — fixes stale `cortexbuild-field-deploy.txt` if www uses a separate docroot |

The workflow health-check step uses `HEALTH_API_BASE` and `HEALTH_WWW_BASE` when set; otherwise it uses the defaults above.

---

## Testing

```bash
# Run unit tests
pnpm test

# Type checking
pnpm check

# Lint
pnpm lint
```

---

## License

Private — CortexBuild Ltd. All rights reserved.
