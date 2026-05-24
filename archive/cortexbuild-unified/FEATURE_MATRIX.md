# CortexBuild Unified — Feature Matrix

| Module | Source Apps | Unified Table | Status |
|--------|-------------|---------------|--------|
| **Auth** | BuildTrack, Ultimate, Field, Web | `users`, `sessions`, `invitations` | ✅ Core |
| **Companies** | Ultimate, Field | `companies`, `company_users` | ✅ Core |
| **Projects** | All 6 apps | `projects` | ✅ Core |
| **Tasks** | BuildTrack, Ultimate, iOS, Field | `tasks` | ✅ Core |
| **Defects / Snags** | BuildTrack, Ultimate, iOS, Field | `defects`, `punch_items` | ✅ Core |
| **Inspections** | BuildTrack, iOS, Field | `inspections` | ✅ Core |
| **RFIs** | Ultimate, iOS, Field | `rfis` | ✅ Core |
| **Safety Incidents** | BuildTrack, Ultimate, iOS, Field | `incidents` | ✅ Core |
| **Permits** | BuildTrack, iOS, Field | `permits` | ✅ Core |
| **Daily Reports** | BuildTrack, Ultimate, iOS, Field | `daily_reports` | ✅ Core |
| **Timesheets** | BuildTrack, Field, Ultimate | `timesheets` | ✅ Core |
| **Invoices** | Ultimate, iOS, Field | `invoices` | ✅ Core |
| **Budget / Cost** | Ultimate, iOS, Field | `budgets`, `budget_lines` | ✅ Core |
| **Materials** | Ultimate, iOS, Field | `materials` | ✅ Core |
| **Equipment** | BuildTrack, Ultimate, iOS, Field | `equipment` | ✅ Core |
| **Drawings** | BuildTrack, iOS, Field | `drawings` | ✅ Core |
| **Meetings** | Ultimate, iOS, Field | `meetings` | ✅ Core |
| **Change Orders** | Ultimate, iOS | `change_orders` | ✅ Core |
| **Submittals** | Ultimate, iOS | `submittals` | ✅ Core |
| **Purchase Orders** | Ultimate, iOS | `purchase_orders` | ✅ Core |
| **Check-ins** | Field | `check_ins` | ✅ Core |
| **Files** | BuildTrack, Ultimate, Field | `files` | ✅ Core |
| **Documents (Generated)** | Ultimate, Field | `documents` | ✅ Core |
| **BIM Models** | Ultimate | `bim_models` | ✅ Core |
| **Tenders** | Ultimate | `tenders` | ✅ Core |
| **Risk Register** | Ultimate | `risk_register` | ✅ Core |
| **Certifications** | Ultimate | `certifications` | ✅ Core |
| **Delay Notes** | BuildTrack, iOS | `delay_notes` | ✅ Core |
| **Weather Logs** | Ultimate | `weather_logs` | ✅ Core |
| **Notifications** | BuildTrack, Ultimate, Field, iOS | `notifications`, `notification_preferences`, `push_tokens` | ✅ Core |
| **AI Chat** | Ultimate, Field | `ai_conversations` | ✅ Core |
| **Activity Feed** | Ultimate, Field | `activity_feed` | ✅ Core |
| **Audit Log** | Field | `audit_log` | ✅ Core |
| **Billing / Subscriptions** | Ultimate | `subscriptions` | ✅ Core |
| **API Keys (AI)** | Field | `company_api_keys` | ✅ Core |
| **Slack Integration** | Ultimate | `slack_integrations` | ✅ Core |
| **Cost Forecasts** | Ultimate | `cost_forecasts` | ✅ Core |

## Merge Strategy
- **Schema**: Drizzle ORM (`drizzle-orm/pg-core`) over PostgreSQL
- **API**: tRPC v11 (single type-safe contract)
- **Web**: React 19 + Vite + Tailwind 4 + React Router
- **Mobile**: Expo 55 + React Native 0.83 + Expo Router + NativeWind
- **Auth**: Dual JWT (HS256 local / RS256 Supabase)
- **Storage**: MinIO (S3-compatible)
- **AI**: OpenRouter → Ollama → Gemini fallback
- **Offline**: AsyncStorage sync queue (mobile)
