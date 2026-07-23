# FluxorX — Enterprise AI Command Center

> Transform raw business data into executive intelligence. Ask questions in plain English. Automate decisions through chat.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-fluxorx.vercel.app-orange?style=for-the-badge)](https://fluxorx.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-khabteehouse--del-black?style=for-the-badge&logo=github)](https://github.com/khabteehouse-del)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Faraz%20Akhtar-blue?style=for-the-badge&logo=linkedin)](https://www.linkedin.com/in/beyondtahir/)
[![Status](https://img.shields.io/badge/Status-Live%20in%20Production-green?style=for-the-badge)]()

---

## What is FluxorX

FluxorX is a production-grade enterprise AI platform built for organizations that run on data but struggle to make it actionable. It ingests business data from spreadsheets and enterprise connectors, validates every record automatically, and delivers live executive dashboards, a deterministic AI agent, and automated alert workflows — all in a single, secure command center.

Built and deployed in **48 hours**. Passed **19 of 19 client acceptance criteria**.

---

## Live Demo

**URL:** https://fluxorx.vercel.app

```
Email:    fluxorx@gmail.com
Password: Admin@fluxorx
```

---

## The 12-Stage Pipeline

```
Data Upload
    ↓
Raw Landing Zone
    ↓
Column Mapping
    ↓
Validation Engine (Health Score / 100)
    ↓
Executive Dashboard
    ↓
AI Agent (Plain Language Queries)
    ↓
Automation Approval (RBAC)
    ↓
Live Email Delivery
    ↓
WhatsApp Notifications
    ↓
Audit Logging
```

---

## Key Features

### Data Pipeline
- Drag and drop Excel, XLS, and CSV upload with client-side SheetJS parsing
- One-click demo data loader (15 pre-built Greaves Solar records)
- Raw landing zone preserves original data before any transformation
- Automatic column mapping with matched, unrecognized, and missing detection
- 8-rule validation engine detecting missing values, duplicates, negative amounts, city misspellings via Levenshtein distance, and inconsistent casing
- Health score out of 100 with hover-to-reveal inline record inspection

### Executive Dashboard
- 6 live KPI tiles: Total Contract Value, Amount Collected, Collection Rate, Active Projects, Total Capacity in kW, and Data Health
- Glowing area chart and bar chart built with Recharts and custom SVG neon filters
- Salesperson leaderboard with animated gradient progress bars
- Every metric pulled from the production database in real time, zero hardcoded values

### Deterministic AI Agent
- Plain-language question interface with a Three.js constellation reactor
- 28-node data graph that expands on query and contracts on answer
- 8 intent categories: overdue invoices, top salesperson, city breakdown, delayed projects, collection rate, completed installations, system capacity, and general summary
- Zero LLM API cost at runtime, zero hallucination risk, every answer traceable to a live database query
- Schedule creation from chat: type `Create schedule:` and the agent generates an automation draft
- Clean upgrade path to Claude API via a single file change in `src/lib/agent.ts`

### Automation and Notifications
- Auto-generated automation suggestions from business events and validation results
- Role-based access control: Admin badge visible, Approve button locked for Viewer roles
- Live status transitions: Queued, Sending, Sent with timestamp
- Branded dark-theme executive HTML emails via Resend
- WhatsApp settings screen with 3 message templates, live phone preview, and scheduled delivery toggle
- Full audit logging on every key action written to Supabase

### Security
- Row Level Security on all 38 database tables via `current_org_id()` helper
- Org-level data isolation enforced at the database layer, not the application layer
- Resend API key server-side only, never exposed to the browser
- Supabase Auth with separate client and server instances for SSR compatibility
- Audit trail on upload, mapping approval, AI questions, automation actions, and email delivery

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| Animation | Framer Motion |
| 3D Graphics | Three.js, React Three Fiber, drei |
| Canvas | HTML Canvas (ambient constellation background) |
| Database | Supabase Postgres, 38 tables, Row Level Security, Mumbai region |
| Auth | Supabase Auth |
| Data Parsing | SheetJS (dynamic import only) |
| Charts | Recharts with custom SVG glow effects |
| Email | Resend |
| Hosting | Vercel |
| Source Control | GitHub with automatic Vercel deploy on push |
| AI Engine | Custom deterministic engine, zero LLM dependency |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   USER BROWSER                       │
│              fluxorx.vercel.app                      │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    VERCEL                            │
│         Next.js 16 App Router + Turbopack            │
│    Client Components + Server Components + API Routes│
└──────────┬──────────────────────────┬───────────────┘
           │                          │
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────┐
│    SUPABASE      │      │         RESEND           │
│ Postgres (Mumbai)│      │   Email Delivery API     │
│ 38 Tables + RLS  │      │   Server-side only       │
│ Auth + Realtime  │      └──────────────────────────┘
└──────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│              AI ENGINE (src/lib/agent.ts)            │
│   Intent Classification → Supabase Query → Response │
│   Deterministic by default. Claude API upgrade-ready│
└─────────────────────────────────────────────────────┘
```

---

## Database Schema (38 Tables)

| Group | Tables |
|-------|--------|
| Identity | organizations, profiles |
| Connectors | connectors |
| Raw Landing | raw_uploads, raw_tables, raw_records |
| Validation | validation_reports, validation_issues |
| Business Model | projects, customers, invoices, payments |
| KPI Engine | kpi_snapshots, kpi_definitions |
| AI Agent | agent_conversations, agent_messages |
| Automations | automations, automation_runs, notification_logs |
| Notifications | email_settings, whatsapp_settings |
| Audit | audit_logs |

---

## Project Structure

```
src/
├── app/
│   ├── login/          # Three.js particle burst hero, Supabase Auth
│   ├── connectors/     # 8 enterprise connector cards
│   ├── upload/         # File upload + demo data loader
│   ├── raw/            # Paginated raw records view
│   ├── mapping/        # Column mapping confirmation
│   ├── validation/     # Health score + 8-rule engine
│   ├── solar/          # Executive dashboard + charts.tsx (code split)
│   ├── agent/          # AI chat + constellation reactor
│   ├── automations/    # RBAC approval + schedule drafts
│   ├── email/          # Live email with Resend
│   ├── whatsapp/       # Settings + phone preview
│   └── api/
│       └── send-email/ # Server-side Resend API route
├── components/
│   ├── app-shell.tsx          # Navigation sidebar
│   ├── ambient-background.tsx # Canvas constellation animation
│   ├── hero-burst.tsx         # Three.js login animation
│   └── ai-reactor.tsx         # Three.js AI agent reactor
└── lib/
    ├── supabase/
    │   ├── client.ts   # Browser-side Supabase client
    │   └── server.ts   # Server-side Supabase client
    ├── agent.ts        # Deterministic AI engine
    └── audit.ts        # Audit logging utility
```

---

## Local Development

### Prerequisites
- Node.js v20 LTS
- Git
- A Supabase account (free tier)
- A Resend account (free tier)

### Setup

```bash
# Clone the repository
git clone https://github.com/khabteehouse-del/fluxorx.git
cd fluxorx

# Install dependencies
npm install

# Create environment file
# Create .env.local in the project root with:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_api_key

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> Always run `rmdir /s /q .next` before `npm run dev` after replacing any files on Windows to clear the build cache.

### Environment Variables

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard, Project Settings, API, Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard, Project Settings, API, anon public key |
| `RESEND_API_KEY` | Resend Dashboard, API Keys |

---

## Deployment

FluxorX is deployed on Vercel with automatic deploys on every push to main.

```bash
git add .
git commit -m "your commit message"
git push origin main
# Vercel detects the push and redeploys automatically within 60 seconds
```

Add the three environment variables in Vercel under Project Settings, Environment Variables before the first deploy.

---

## Milestone 2 Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| 1 | Google Sheets Live Connector (OAuth 2.0) | Planned |
| 2 | Custom Email Domain via Resend | Planned |
| 3 | WhatsApp Business API Activation | Planned |
| 4 | Claude API Upgrade (optional tier) | Planned |
| 5 | User Management Panel (invite + roles) | Planned |
| 6 | QuickBooks Live Connector | Planned |
| 7 | Interactive Column Mapper (drag and drop) | Planned |
| 8 | Salesforce Connector | Planned |
| 9 | Multi-source Data Merge | Planned |
| 10 | MCP Integration (agent actions in external systems) | Planned |

---

## Acceptance Criteria — 19 / 19 PASS

| Category | Requirement | Result |
|----------|------------|--------|
| Security | No API keys or secrets in frontend | PASS |
| Security | Read-only connector principle, no ERP write-back | PASS |
| Security | All data isolated per organization via RLS | PASS |
| Security | Role-based access control visible in UI | PASS |
| Security | Audit logs on all 8 key actions | PASS |
| Demo | Admin login and premium dashboard UI | PASS |
| Demo | All connector cards visible | PASS |
| Demo | Upload Excel/CSV or load demo data | PASS |
| Demo | Raw preview shown | PASS |
| Demo | Mapping confirmation and validation report | PASS |
| Demo | Dashboard with realistic KPIs and charts | PASS |
| Demo | AI Agent answers 7+ business questions | PASS |
| Demo | AI Agent creates automation draft from chat | PASS |
| Demo | Admin can approve and delete automations | PASS |
| Demo | Send Test Email with real delivery | PASS |
| Demo | WhatsApp settings and preview screen | PASS |
| Demo | Role restrictions visible, only Admin activates | PASS |
| Demo Script | Full pipeline from upload to email delivery | PASS |
| Demo Script | Schedule creation from AI chat | PASS |

---

## Built By

**Faraz Akhtar** — AI Solutions Architect

22 years of enterprise experience spanning DBA, project management, international stakeholders, and media. Transitioned into AI engineering with a focus on building production-grade business intelligence systems for enterprise clients.

- LinkedIn: [linkedin.com/in/beyondtahir](https://www.linkedin.com/in/beyondtahir/)
- GitHub: [github.com/khabteehouse-del](https://github.com/khabteehouse-del)
- Live: [fluxorx.vercel.app](https://fluxorx.vercel.app)

---

*FluxorX — Built in 48 hours. Production grade. Zero compromises.*
