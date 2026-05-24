# CortexBuild AI — WhatsApp Construction Agent

## Phase 1: Database Schema
- [x] contacts table (waId, phoneNumber, displayName, projectTag, notes)
- [x] conversations table (contactId, waConversationId, title, projectTag, counters)
- [x] messages table (conversationId, contactId, direction, messageType, body, mediaId, isKeySection)
- [x] media table (conversationId, contactId, s3Key, s3Url, mimeType, visionAnalyzed, visionDescription, visionTags, visionIssuesDetected, visionSafetyHazards)
- [x] memorySections table (contactId, conversationId, sectionType, content, keywords, importance)
- [x] issues table (contactId, conversationId, messageId, mediaId, title, description, severity, status, location, resolvedAt)
- [x] reports table (title, reportType, htmlUrl, pdfUrl, dateFrom, dateTo, projectTag, stats)
- [x] scheduledReports table (name, frequency, reportType, format, sendToWhatsapp, sendToEmail, nextRunAt, lastRunAt)
- [x] agentConfig table (key, value, description)
- [x] Drizzle migration generated and applied

## Phase 2: Core Backend Services
- [x] db.ts — all query helpers (upsertContact, insertMessage, insertMedia, insertIssue, etc.)
- [x] memoryEngine.ts — buildMemoryContext, extractAndStoreMemory, buildAgentSystemPrompt
- [x] visionAI.ts — processMediaWithVision (vision AI analysis of construction images)
- [x] issueDetector.ts — detectAndSaveIssues (AI-powered issue detection from text)
- [x] whatsappClient.ts — sendTextMessage, downloadWhatsAppMedia, parseWebhookPayload (graceful no-credentials fallback)
- [x] reportGenerator.ts — generateReport (HTML + PDF, S3 upload, LLM executive summary)
- [x] emailService.ts — sendReportNotification, sendCriticalIssueAlert (via owner notification)
- [x] scheduledReports.ts — runDueScheduledReports (daily/weekly cron runner)

## Phase 3: WhatsApp Webhook + Full Pipeline
- [x] GET /api/webhook/whatsapp — Meta verification endpoint
- [x] POST /api/webhook/whatsapp — receives messages, runs full AI pipeline
- [x] webhookProcessor.ts — full 12-step pipeline (contact → media → vision → issues → memory → AI reply)
- [x] Scheduled report runner wired into server startup (every 60 minutes)

## Phase 4: In-App Chat Inbox (No WhatsApp API Required)
- [x] inboxProcessor.ts — full AI pipeline for dashboard-sent messages and images
- [x] POST /api/upload — multipart file upload endpoint (multer → S3)
- [x] tRPC inbox.sendMessage — text + image through full AI pipeline
- [x] tRPC inbox.createContact — create contacts from dashboard
- [x] ChatInbox.tsx page — contact list + conversation thread + message composer + image upload
- [x] Chat Inbox added to sidebar navigation

## Phase 5: tRPC API Routers
- [x] contacts router (list, update)
- [x] conversations router (list, get, messages, updateTitle)
- [x] media router (list, gallery)
- [x] memory router (byContact, all)
- [x] issues router (list, update)
- [x] reports router (list, generate, sendToWhatsapp, sendNotification)
- [x] scheduledReports router (list, create, toggle)
- [x] settings router (getAll, set) — admin only
- [x] dashboard.stats router
- [x] inbox router (sendMessage, createContact)

## Phase 6: Admin Dashboard UI
- [x] Dark construction theme (index.css)
- [x] DashboardShell — sidebar with all nav items including Chat Inbox
- [x] Home.tsx — landing page with login CTA
- [x] Dashboard.tsx — stats overview + recent issues + recent images
- [x] ChatInbox.tsx — real in-app chat with AI pipeline
- [x] Conversations.tsx — conversation list with search
- [x] ConversationDetail.tsx — message thread + media viewer
- [x] ImageGallery.tsx — image grid with vision AI analysis display
- [x] IssueTracker.tsx — issue list with status/severity filters
- [x] Memory.tsx — memory sections browser
- [x] Reports.tsx — report generator + viewer
- [x] Settings.tsx — WhatsApp config + agent settings

## Phase 7: VPS Deployment
- [x] Dockerfile — production multi-stage build
- [x] docker-compose.yml — full stack (app + nginx)
- [x] nginx/nginx.conf + nginx/conf.d/cortexbuild.conf
- [x] .env.example — all required environment variables
- [x] DEPLOYMENT.md — full VPS setup guide

## Phase 8: Tests
- [x] server/auth.logout.test.ts — session cookie clearing (1 test)
- [x] server/agent.test.ts — 18 tests covering auth, inbox, issues, reports, settings, WhatsApp fallback, inboxProcessor, scheduledReports

## Pending / Future
- [ ] Real-time message polling (WebSocket or SSE) for live inbox updates
- [ ] Voice message transcription (Whisper API) for audio messages
- [ ] Multi-project workspace support
- [ ] WhatsApp template messages for scheduled report delivery
