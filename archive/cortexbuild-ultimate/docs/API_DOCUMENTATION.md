# CortexBuild Ultimate API Documentation

**Version:** 3.0.0  
**Last Updated:** April 2026  
**Base URL:**  
- Development: `http://localhost:3001`  
- Production: `https://www.cortexbuildpro.com`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Generic CRUD Endpoints](#generic-crud-endpoints)
4. [Authentication API](#authentication-api)
5. [AI & RAG API](#ai--rag-api)
6. [File Management API](#file-management-api)
7. [Search API](#search-api)
8. [Notifications API](#notifications-api)
9. [Calendar API](#calendar-api)
10. [Email API](#email-api)
11. [Insights API](#insights-api)
12. [Audit API](#audit-api)
13. [Permissions API](#permissions-api)
14. [Metrics & Health API](#metrics--health-api)
15. [Deploy API](#deploy-api)
16. [Backup & Export API](#backup--export-api)
17. [WebSocket API](#websocket-api)
18. [Error Responses](#error-responses)
19. [Rate Limiting](#rate-limiting)

---

## Overview

CortexBuild Ultimate is a comprehensive construction management SaaS platform with a RESTful API and real-time WebSocket support. The API follows standard HTTP conventions:

- **GET** - Retrieve resources
- **POST** - Create resources
- **PUT** - Update resources
- **DELETE** - Delete resources

### Response Format

All responses are JSON formatted:

```json
{
  "data": { ... },
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 500,
    "pages": 5
  }
}
```

### Multi-Tenancy

All endpoints support multi-tenancy via `organization_id` and `company_id`. Super admins and company owners see all data; other users see only their organization's data.

---

## Authentication

### JWT Bearer Token

All endpoints require a JWT Bearer token except:
- `/api/auth/login`
- `/api/auth/register`
- `/api/auth/google`
- `/api/auth/microsoft`
- `/api/health`
- `/api/deploy` (uses `DEPLOY_SECRET`)
- `/api/metrics`

### Token Format

```
Authorization: Bearer <jwt_token>
```

### Token Payload

```json
{
  "id": "user_id",
  "email": "user @example.com",
  "role": "project_manager",
  "name": "User Name",
  "company": "Company Name",
  "organization_id": "org_id",
  "company_id": "company_id"
}
```

**Token Expiry:** 7 days

---

## Generic CRUD Endpoints

All tables support standard CRUD operations via the generic router (`/server/routes/generic.js`).

### Standard Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/{resource}` | List all (paginated) |
| GET | `/api/{resource}/:id` | Get one by ID |
| POST | `/api/{resource}` | Create new |
| PUT | `/api/{resource}/:id` | Update by ID |
| DELETE | `/api/{resource}/:id` | Delete by ID |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 100 | Items per page (max: 1000) |

### Filtering & Sorting

- Results are sorted by `created_at DESC` by default
- Filtering is applied via multi-tenancy (organization_id)
- Custom filtering available on specific endpoints

---

## Available Tables (40+ Modules)

### Core Modules

| Table | Endpoint | Allowed Columns |
|-------|----------|-----------------|
| **projects** | `/api/projects` | `name`, `client`, `status`, `progress`, `budget`, `spent`, `start_date`, `end_date`, `manager`, `location`, `type`, `phase`, `workers`, `contract_value`, `description` |
| **invoices** | `/api/invoices` | `number`, `client`, `project_id`, `project`, `amount`, `vat`, `cis_deduction`, `status`, `issue_date`, `due_date`, `description`, `payment_terms`, `bank_account`, `notes` |
| **safety_incidents** | `/api/safety` | `type`, `title`, `severity`, `status`, `project_id`, `project`, `reported_by`, `reported_by_name`, `date`, `location`, `description`, `root_cause`, `corrective_actions`, `injured_party`, `immediate_actions`, `riddor_reportable`, `injury_type`, `body_part_affected`, `days_lost`, `witness_name`, `target_closure_date` |
| **rfis** | `/api/rfis` | `number`, `title`, `project_id`, `project`, `rfi_number`, `subject`, `question`, `answer`, `priority`, `status`, `submitted_by`, `submitted_date`, `due_date`, `assigned_to`, `response`, `discipline`, `notes`, `ball_in_court`, `cost_impact`, `schedule_impact` |
| **change_orders** | `/api/change-orders` | `number`, `co_number`, `project_id`, `project`, `title`, `description`, `amount`, `value`, `status`, `submitted_date`, `approved_date`, `reason`, `schedule_impact`, `days_extension`, `rejection_reason`, `cost_change`, `schedule_change`, `type` |
| **team_members** | `/api/team` | `name`, `role`, `trade`, `trade_type`, `email`, `phone`, `status`, `cis_status`, `utr_number`, `ni_number`, `hours_this_week`, `rams_completed`, `notes`, `daily_rate`, `cscs_card`, `cscs_expiry`, `cscs_type` |
| **equipment** | `/api/equipment` | `name`, `type`, `registration`, `status`, `location`, `next_service`, `daily_rate`, `hire_period`, `category`, `serial_number`, `ownership`, `inspection_due`, `mewp_check`, `project_id`, `supplier`, `notes` |
| **subcontractors** | `/api/subcontractors` | `company`, `trade`, `contact`, `email`, `phone`, `status`, `cis_verified`, `cis_status`, `insurance_expiry`, `rams_approved`, `rams_status`, `current_project`, `contract_value`, `rating`, `utr_number`, `address`, `notes` |
| **documents** | `/api/documents` | `name`, `type`, `project_id`, `project`, `uploaded_by`, `version`, `size`, `status`, `category`, `discipline`, `file_url`, `date_issued`, `author` |
| **timesheets** | `/api/timesheets` | `worker_id`, `worker`, `project_id`, `project`, `week`, `regular_hours`, `overtime_hours`, `daywork_hours`, `total_pay`, `status`, `cis_deduction`, `notes` |

### Additional Modules

| Table | Endpoint | Key Columns |
|-------|----------|-------------|
| **meetings** | `/api/meetings` | `title`, `meeting_type`, `project_id`, `project`, `date`, `time`, `location`, `attendees`, `agenda`, `minutes`, `actions`, `status`, `link` |
| **materials** | `/api/materials` | `name`, `category`, `quantity`, `unit`, `unit_cost`, `total_cost`, `supplier`, `project_id`, `project`, `status`, `delivery_date`, `po_number`, `order_date`, `notes` |
| **punch_list** | `/api/punch-list` | `project_id`, `project`, `location`, `description`, `assigned_to`, `priority`, `status`, `due_date`, `photos`, `trade`, `item_number`, `category`, `resolution`, `notes` |
| **inspections** | `/api/inspections` | `type`, `project_id`, `project`, `inspector`, `date`, `status`, `score`, `items`, `next_inspection`, `title`, `location`, `notes`, `findings`, `corrective_actions` |
| **rams** | `/api/rams` | `title`, `project_id`, `project`, `activity`, `doc_type`, `version`, `status`, `created_by`, `approved_by`, `review_date`, `hazards`, `method_statement`, `ppe`, `signatures`, `required`, `risk_level`, `valid_from`, `valid_until`, `controls`, `reviewed_by`, `likelihood`, `severity`, `notes` |
| **cis_returns** | `/api/cis` | `contractor`, `utr`, `period`, `gross_payment`, `materials_cost`, `labour_net`, `cis_deduction`, `cis_rate`, `status`, `verification_status`, `payment_date`, `notes` |
| **tenders** | `/api/tenders` | `title`, `client`, `value`, `deadline`, `status`, `probability`, `type`, `location`, `ai_score`, `notes`, `stage`, `result_date` |
| **contacts** | `/api/contacts` | `name`, `company`, `role`, `email`, `phone`, `type`, `value`, `last_contact`, `status`, `projects`, `address`, `website`, `notes`, `rating` |
| **risk_register** | `/api/risk-register` | `title`, `project_id`, `project`, `category`, `likelihood`, `impact`, `risk_score`, `owner`, `status`, `mitigation`, `review_date`, `notes`, `contingency`, `description` |
| **purchase_orders** | `/api/purchase-orders` | `number`, `supplier`, `project_id`, `project`, `amount`, `status`, `order_date`, `delivery_date`, `items`, `notes`, `category` |
| **daily_reports** | `/api/daily-reports` | `project_id`, `project`, `report_date`, `prepared_by`, `weather`, `temperature`, `workers_on_site`, `activities`, `materials`, `equipment`, `issues`, `photos`, `progress`, `temp_high`, `temp_low`, `delays`, `safety_observations`, `visitors`, `status`, `submitted_by` |

### Construction Modules

| Table | Endpoint | Key Columns |
|-------|----------|-------------|
| **variations** | `/api/variations` | `ref`, `title`, `project_id`, `project`, `subcontractor`, `status`, `type`, `value`, `original_value`, `impact`, `submitted_date`, `responded_date`, `description`, `reason`, `affected_items`, `approval_chain`, `documents` |
| **defects** | `/api/defects` | `reference`, `title`, `project_id`, `project`, `location`, `description`, `priority`, `status`, `trade`, `raised_by`, `assigned_to`, `due_date`, `closed_date`, `photos`, `cost`, `category` |
| **valuations** | `/api/valuations` | `reference`, `project_id`, `project`, `application_number`, `period_start`, `period_end`, `status`, `contractor_name`, `client_name`, `original_value`, `variations`, `total_value`, `retention`, `amount_due`, `submitted_date`, `certified_date`, `certified_by`, `notes` |
| **specifications** | `/api/specifications` | `reference`, `title`, `project_id`, `project`, `section`, `version`, `status`, `description`, `specifications`, `materials`, `standards`, `approved_by`, `approved_date` |
| **temp_works** | `/api/temp-works` | `reference`, `title`, `project_id`, `project`, `description`, `type`, `status`, `location`, `design_by`, `approved_by`, `design_date`, `approval_date`, `erected_by`, `erected_date`, `inspected_by`, `inspected_date`, `load_capacity`, `notes` |
| **signage** | `/api/signage` | `reference`, `project_id`, `project`, `type`, `description`, `location`, `size`, `material`, `quantity`, `status`, `required_date`, `installed_date`, `installed_by`, `notes` |
| **waste_management** | `/api/waste-management` | `reference`, `project_id`, `project`, `waste_type`, `carrier`, `license_number`, `skip_number`, `collection_date`, `quantity`, `unit`, `cost`, `disposal_site`, `waste_code`, `status`, `notes` |
| **sustainability** | `/api/sustainability` | `project_id`, `project`, `metric_type`, `target`, `actual`, `unit`, `period`, `status`, `notes` |
| **training** | `/api/training` | `reference`, `title`, `project_id`, `project`, `type`, `provider`, `duration`, `cost`, `attendees`, `status`, `scheduled_date`, `completed_date`, `certification`, `expiry_date`, `notes` |
| **certifications** | `/api/certifications` | `reference`, `company`, `certification_type`, `body`, `grade`, `expiry_date`, `status`, `renewal_date`, `cost`, `scope`, `accreditation_number`, `notes` |
| **prequalification** | `/api/prequalification` | `reference`, `contractor`, `project_id`, `project`, `questionnaire_type`, `status`, `score`, `approved_by`, `approved_date`, `expiry_date`, `documents`, `sections_completed`, `total_sections`, `notes` |
| **lettings** | `/api/lettings` | `reference`, `project_id`, `project`, `package_name`, `trade`, `status`, `tender_closing_date`, `award_date`, `contractor`, `contract_value`, `notes` |
| **measuring** | `/api/measuring` | `reference`, `project_id`, `project`, `survey_type`, `location`, `status`, `surveyor`, `survey_date`, `completed_date`, `areas`, `total_area`, `unit`, `notes` |

### Supporting Tables

| Table | Endpoint | Key Columns |
|-------|----------|-------------|
| **site_permits** | `/api/site-permits` | `type`, `site`, `issued_by`, `from_date`, `to_date`, `status` |
| **equipment_service_logs** | `/api/equipment-service-logs` | `equipment_id`, `date`, `type`, `technician`, `notes`, `next_due` |
| **equipment_hire_logs** | `/api/equipment-hire-logs` | `equipment_id`, `name`, `company`, `daily_rate`, `start_date`, `end_date`, `project`, `status` |
| **risk_mitigation_actions** | `/api/risk-mitigation-actions` | `risk_id`, `title`, `owner`, `due_date`, `status`, `progress` |
| **contact_interactions** | `/api/contact-interactions` | `contact_id`, `type`, `date`, `note` |
| **safety_permits** | `/api/safety-permits` | `permit_no`, `type`, `project`, `location`, `start_date`, `end_date`, `issued_by`, `status` |
| **toolbox_talks** | `/api/toolbox-talks` | `date`, `topic`, `location`, `presenter`, `attendees`, `signed_off` |
| **drawing_transmittals** | `/api/drawing-transmittals` | `project`, `issued_to`, `date`, `purpose`, `status` |

---

## Authentication API

Base: `/api/auth`

### POST `/api/auth/register`

Register a new user account (creates `company_owner` role).

**Rate Limit:** 5 per hour

**Request:**
```json
{
  "name": "John Doe",
  "email": "john @example.com",
  "password": "securepassword123",
  "company": "Acme Construction Ltd",
  "phone": "+44 7700 900000"
}
```

**Response (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john @example.com",
    "role": "company_owner",
    "company": "Acme Construction Ltd",
    "phone": "+44 7700 900000",
    "created_at": "2026-04-02T10:00:00Z"
  }
}
```

### POST `/api/auth/login`

Authenticate user and receive JWT token.

**Rate Limit:** 5 failed attempts per 15 minutes

**Request:**
```json
{
  "email": "john @example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john @example.com",
    "role": "company_owner",
    "company": "Acme Construction Ltd"
  }
}
```

### POST `/api/auth/logout`

Logout user (client should discard token).

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

### GET `/api/auth/me`

Get current authenticated user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "id": "user_id",
  "name": "John Doe",
  "email": "john @example.com",
  "role": "company_owner",
  "company": "Acme Construction Ltd",
  "phone": "+44 7700 900000",
  "avatar": "https://...",
  "organization_id": "org_id",
  "company_id": "company_id",
  "created_at": "2026-04-02T10:00:00Z"
}
```

### PUT `/api/auth/profile`

Update user profile.

**Request:**
```json
{
  "name": "John Smith",
  "phone": "+44 7700 900111"
}
```

### PUT `/api/auth/password`

Change user password.

**Request:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newsecurepassword456"
}
```

### GET `/api/auth/users`

List all users (admin+ only).

**Response (200):**
```json
[
  {
    "id": "user_id",
    "name": "John Doe",
    "email": "john @example.com",
    "role": "company_owner",
    "company": "Acme Construction Ltd",
    "created_at": "2026-04-02T10:00:00Z"
  }
]
```

### POST `/api/auth/users`

Create new user (admin+ only).

**Request:**
```json
{
  "name": "Jane Smith",
  "email": "jane @example.com",
  "password": "securepassword123",
  "role": "project_manager",
  "company": "Acme Construction Ltd",
  "phone": "+44 7700 900222"
}
```

**Valid Roles:** `super_admin`, `company_owner`, `admin`, `project_manager`, `field_worker`, `client`

### DELETE `/api/auth/users/:id`

Delete user (super_admin / company_owner only).

### PUT `/api/auth/avatar`

Update user avatar URL.

**Request:**
```json
{
  "avatar": "https://example.com/avatar.jpg"
}
```

**Note:** Avatar must be a valid `https://` URL.

### GET `/api/auth/settings`

Get user settings.

**Response (200):**
```json
{
  "notifications": { "email": true, "push": true },
  "theme": "dark",
  "timezone": "Europe/London",
  "language": "en"
}
```

### PUT `/api/auth/settings`

Update user setting.

**Request:**
```json
{
  "key": "theme",
  "value": "light"
}
```

**Valid Keys:** `notifications`, `theme`, `company`, `language`, `timezone`, `dashboard`, `alerts`, `reports`

---

## AI & RAG API

Base: `/api/ai`

### GET `/api/ai/status`

Check Ollama AI service status and available models.

**Response (200):**
```json
{
  "status": "healthy",
  "ollama": {
    "reachable": true,
    "latencyMs": 45,
    "host": "http://localhost:11434",
    "model": "qwen3.5:latest"
  },
  "capabilities": {
    "chat": true,
    "summarise": true,
    "embeddings": true
  },
  "recommendation": "All systems operational."
}
```

### POST `/api/ai/chat`

Send a chat message to the AI assistant.

**Request:**
```json
{
  "message": "Show me all active projects",
  "sessionId": "session_123"
}
```

**Response (200):**
```json
{
  "reply": "You have 5 active projects...",
  "data": { "count": 5, "active": 5, "projects": [...] },
  "suggestions": [
    "Show me overdue invoices",
    "Which projects are over budget?"
  ]
}
```

### GET `/api/ai/conversations/:sessionId`

Get conversation history.

### DELETE `/api/ai/conversations/:sessionId`

Clear conversation history.

### POST `/api/rag/chat`

Chat with RAG (Retrieval Augmented Generation) using document embeddings.

**Request:**
```json
{
  "message": "What does the safety policy say about PPE?",
  "sessionId": "session_123"
}
```

### GET `/api/rag/status`

Check RAG embedding status.

---

## File Management API

Base: `/api/files`

### GET `/api/files`

List all documents with optional filtering.

**Query Parameters:**
- `category` - Filter by category (e.g., `REPORTS`, `DRAWINGS`)
- `project_id` - Filter by project
- `search` - Search by name
- `type` - Filter by file type (e.g., `PDF`, `DOCX`)
- `include_versions` - Include version history (`true`/`false`)

**Response (200):**
```json
{
  "data": [
    {
      "id": "doc_id",
      "name": "Safety Report Q1.pdf",
      "type": "PDF",
      "category": "REPORTS",
      "project_id": "proj_id",
      "uploaded_by": "John Doe",
      "version": "1.0",
      "size": "2.5 MB",
      "status": "current",
      "file_path": "/uploads/1234567890-abc.pdf",
      "created_at": "2026-04-01T10:00:00Z"
    }
  ]
}
```

### GET `/api/files/:id`

Get document details with version history.

### POST `/api/files/upload`

Upload a new file.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` - The file to upload
- `name` - Document name (optional, defaults to filename)
- `category` - Category (optional, default: `REPORTS`)
- `project_id` - Project ID (optional)
- `access_level` - Access level (optional, default: `project`)
- `discipline` - Discipline (optional)
- `date_issued` - Date issued (optional)
- `author` - Author (optional, defaults to uploader)

**Allowed Extensions:** `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.dwg`, `.dxf`, `.zip`, `.rar`, `.csv`

**Max File Size:** 100 MB

**Response (201):**
```json
{
  "id": "doc_id",
  "name": "Safety Report Q1.pdf",
  "type": "PDF",
  "category": "REPORTS",
  "version": "1.0",
  "size": "2.5 MB",
  "file_path": "/uploads/1234567890-abc.pdf"
}
```

### PUT `/api/files/:id`

Update document metadata.

**Request:**
```json
{
  "name": "Updated Name.pdf",
  "category": "DRAWINGS",
  "access_level": "public",
  "discipline": "Structural",
  "date_issued": "2026-04-01",
  "author": "Jane Smith"
}
```

### POST `/api/files/:id/upload-version`

Upload a new version of an existing document.

**Form Fields:**
- `file` - The new file
- `changes` - Description of changes (optional)

**Response (201):**
```json
{
  "id": "doc_id",
  "version": "2.0",
  "file_path": "/uploads/1234567891-xyz.pdf"
}
```

### GET `/api/files/:id/download`

Download a document file.

### GET `/api/files/:id/preview`

Preview a document (inline display for PDFs and images).

### GET `/api/files/folders/list`

List unique folder paths.

**Query Parameters:**
- `parent` - Filter by parent folder

### DELETE `/api/files/:id`

Delete a document and all its versions.

---

## Upload API

Base: `/api/upload`

### POST `/api/upload`

Simple file upload endpoint (legacy, use `/api/files/upload` for new uploads).

**Form Fields:**
- `file` - The file to upload
- `category` - Category (optional)
- `project` - Project name (optional)
- `project_id` - Project ID (optional)

**Response (201):**
```json
{
  "id": "doc_id",
  "name": "Document.pdf",
  "type": "PDF",
  "uploaded_by": "John Doe",
  "version": "1.0",
  "size": "1.2 MB",
  "status": "current",
  "category": "REPORTS"
}
```

---

## Search API

Base: `/api/search`

### GET `/api/search`

Global search across all tables with optional semantic search.

**Query Parameters:**
- `q` - Search query (required, min 2 characters)
- `limit` - Max results per table (default: 20)
- `semantic` - Enable semantic search with embeddings (default: `true`)

**Response (200):**
```json
{
  "results": {
    "projects": [
      { "id": "proj_id", "name": "Project Alpha", "client": "Client A", "status": "active" }
    ],
    "invoices": [
      { "id": "inv_id", "number": "INV-001", "client": "Client A", "amount": 5000, "status": "overdue" }
    ],
    "contacts": [],
    "rfis": [],
    "documents": [],
    "team": []
  },
  "total": 2,
  "query": "alpha",
  "semanticResults": [
    {
      "type": "semantic",
      "file_name": "Safety Policy.pdf",
      "file_id": "doc_id",
      "chunk_text": "All workers must wear PPE...",
      "score": 0.92,
      "doc_type": "PDF"
    }
  ],
  "searchMode": "hybrid"
}
```

**Searchable Tables:** `projects`, `invoices`, `safety_incidents`, `rfis`, `change_orders`, `team_members`, `documents`, `subcontractors`, `contacts`, `tenders`, `rams`, `meetings`, `daily_reports`

---

## Notifications API

Base: `/api/notifications`

### GET `/api/notifications`

Get all notifications for the user's organization.

**Response (200):**
```json
[
  {
    "id": "notif_id",
    "title": "Overdue Invoice Alert",
    "description": "3 invoices are overdue",
    "severity": "warning",
    "type": "alert",
    "read": false,
    "link": "/invoicing",
    "created_at": "2026-04-02T09:00:00Z"
  }
]
```

### GET `/api/notifications/unread-count`

Get count of unread notifications.

**Response (200):**
```json
{
  "count": 5
}
```

### PUT `/api/notifications/:id/read`

Mark a notification as read.

### PUT `/api/notifications/read-all`

Mark all notifications as read.

### DELETE `/api/notifications/:id`

Delete a notification.

### DELETE `/api/notifications`

Clear all notifications for the user.

### POST `/api/notifications`

Create a new notification (system use).

**Request:**
```json
{
  "title": "System Alert",
  "description": "Maintenance scheduled for tonight",
  "severity": "info",
  "type": "notification",
  "user_id": "user_id",
  "link": "/settings"
}
```

### POST `/api/notifications/generate-alerts`

Generate system alerts based on data analysis (overdue invoices, expiring RAMS, open safety incidents).

**Response (200):**
```json
{
  "generated": 3,
  "alerts": [
    {
      "title": "Overdue Invoices",
      "description": "5 invoice(s) are overdue",
      "severity": "warning",
      "type": "alert",
      "link": "/invoicing"
    }
  ]
}
```

---

## Calendar API

Base: `/api/calendar`

### GET `/api/calendar`

Get all calendar events (projects, meetings, inspections, deadlines).

**Query Parameters:**
- `start` - Filter events from date (YYYY-MM-DD)
- `end` - Filter events until date (YYYY-MM-DD)

**Response (200):**
```json
[
  {
    "id": "project-proj_id",
    "title": "Project Alpha",
    "type": "project",
    "subtype": "Commercial",
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "status": "active",
    "client": "Client A",
    "url": "/projects/proj_id"
  },
  {
    "id": "meeting-meet_id",
    "title": "Weekly Progress Meeting",
    "type": "meeting",
    "subtype": "Meeting",
    "startDate": "2026-04-05",
    "time": "10:00",
    "status": "scheduled",
    "project": "Project Alpha",
    "url": "/meetings/meet_id"
  },
  {
    "id": "inspection-insp_id",
    "title": "Safety Inspection",
    "type": "inspection",
    "subtype": "Safety",
    "startDate": "2026-04-10",
    "status": "scheduled",
    "project": "Project Alpha",
    "url": "/inspections/insp_id"
  }
]
```

---

## Email API

Base: `/api/email`

### GET `/api/email/templates`

Get available email templates.

**Response (200):**
```json
{
  "system": [
    {
      "key": "invoice_overdue",
      "subject": "Invoice Overdue - Action Required",
      "template": "invoice_overdue",
      "description": "Sent when an invoice becomes overdue",
      "isSystem": true
    }
  ],
  "custom": [
    {
      "id": "tmpl_id",
      "name": "Custom Welcome",
      "subject": "Welcome to CortexBuild",
      "body": "<p>Welcome!</p>",
      "emailType": "custom",
      "isActive": true
    }
  ]
}
```

### POST `/api/email/templates`

Create a new email template.

**Request:**
```json
{
  "name": "Project Update",
  "subject": "Project {{project_name}} Update",
  "body": "<p>Project status updated...</p>",
  "email_type": "project_update",
  "description": "Sent on project status changes",
  "variables": ["project_name", "status", "progress"]
}
```

### PUT `/api/email/templates/:id`

Update an email template.

### DELETE `/api/email/templates/:id`

Deactivate an email template.

### GET `/api/email/history`

Get email sending history.

**Query Parameters:**
- `limit` - Max results (default: 50)
- `offset` - Offset for pagination (default: 0)

**Response (200):**
```json
{
  "emails": [
    {
      "id": "email_id",
      "recipient": "client @example.com",
      "subject": "Invoice Overdue",
      "body": "...",
      "email_type": "invoice_overdue",
      "status": "delivered",
      "created_at": "2026-04-01T10:00:00Z"
    }
  ],
  "total": 150
}
```

### POST `/api/email/send`

Send an email.

**Rate Limit:** 50 per minute per user

**Request:**
```json
{
  "to": "client @example.com",
  "cc": "pm @example.com",
  "type": "invoice_overdue",
  "data": {
    "invoice_number": "INV-001",
    "amount": "£5,000",
    "client": "Client A",
    "due_date": "2026-03-01"
  }
}
```

**Email Types:**
- `invoice_overdue` - Invoice overdue notification
- `invoice_paid` - Payment received confirmation
- `project_update` - Project status change
- `safety_alert` - Safety incident alert
- `rfi_response` - RFI response notification
- `meeting_reminder` - Meeting reminder (1 hour before)
- `deadline_reminder` - Deadline reminder (24 hours before)
- `document_shared` - Document shared notification
- `team_assignment` - Task assignment notification
- `weekly_summary` - Weekly summary report
- `custom` - Custom email (requires `subject` and `body`)

**Response (201):**
```json
{
  "success": true,
  "email": {
    "id": "email_id",
    "recipient": "client @example.com",
    "subject": "Invoice Overdue - Action Required",
    "status": "sent"
  }
}
```

### POST `/api/email/bulk`

Send bulk emails.

**Request:**
```json
{
  "recipients": ["user1 @example.com", "user2 @example.com"],
  "type": "project_update",
  "data": { "project_name": "Alpha" }
}
```

**Max Recipients:** 100 per request

### POST `/api/email/schedule`

Schedule an email for later delivery.

**Request:**
```json
{
  "to": "client @example.com",
  "type": "meeting_reminder",
  "data": { "meeting_title": "Kickoff", "date": "2026-04-10", "time": "10:00" },
  "scheduledAt": "2026-04-10T09:00:00Z"
}
```

---

## Insights API

Base: `/api/insights`

### GET `/api/insights`

Get AI-generated insights from project data analysis.

**Response (200):**
```json
[
  {
    "id": "fin-001",
    "category": "financial",
    "severity": "high",
    "title": "Invoice Payment Delays Detected",
    "description": "5 invoice(s) overdue totalling £25,000.",
    "recommendation": "Prioritise follow-up with clients representing the largest overdue amounts.",
    "impact": "Working capital constraint affecting supplier payments.",
    "confidence": 92,
    "dataPoints": 5,
    "generatedAt": "2026-04-02T10:00:00Z"
  },
  {
    "id": "saf-001",
    "category": "safety",
    "severity": "medium",
    "title": "Safety Incident Rate Increasing",
    "description": "3 incident(s) in the last 30 days vs 1 in the prior 30 days — a 200% increase.",
    "recommendation": "Conduct a safety stand-down meeting.",
    "impact": "Elevated HSE enforcement risk.",
    "confidence": 85,
    "dataPoints": 4,
    "generatedAt": "2026-04-02T10:00:00Z"
  }
]
```

**Insight Categories:**
- `financial` - Budget, invoices, cash flow
- `safety` - Incidents, permits, compliance
- `programme` - RFIs, change orders, delays
- `subcontractor` - CIS verification, insurance, RAMS
- `resource` - Training, certifications
- `trend` - Quarter-over-quarter trends

**Severity Levels:** `low`, `medium`, `high`, `critical`

---

## Audit API

Base: `/api/audit`

### GET `/api/audit`

Get audit log entries.

**Query Parameters:**
- `table` - Filter by table name
- `record_id` - Filter by record ID
- `user_id` - Filter by user ID
- `limit` - Max results (default: 100)

**Response (200):**
```json
[
  {
    "id": "audit_id",
    "table_name": "projects",
    "record_id": "proj_id",
    "action": "update",
    "changes": {
      "status": { "old": "planning", "new": "active" },
      "progress": { "old": 0, "new": 25 }
    },
    "user_id": "user_id",
    "created_at": "2026-04-02T10:00:00Z"
  }
]
```

### POST `/api/audit`

Create an audit log entry.

**Request:**
```json
{
  "table_name": "projects",
  "record_id": "proj_id",
  "action": "create",
  "changes": { "name": "Project Alpha" },
  "user_id": "user_id"
}
```

### GET `/api/audit/stats`

Get audit statistics for the last 7 days.

**Response (200):**
```json
{
  "byAction": [
    { "action": "update", "count": 150 },
    { "action": "create", "count": 50 },
    { "action": "delete", "count": 10 }
  ],
  "byTable": [
    { "table_name": "projects", "count": 80 },
    { "table_name": "invoices", "count": 50 }
  ],
  "last24Hours": 45
}
```

---

## Permissions API

Base: `/api/permissions`

### GET `/api/permissions/permissions`

Get available permissions structure.

**Response (200):**
```json
{
  "modules": {
    "dashboard": { "label": "Dashboard", "defaultRole": "all" },
    "projects": { "label": "Projects", "defaultRole": "project_manager" },
    "invoicing": { "label": "Invoicing", "defaultRole": "project_manager" }
  },
  "actions": {
    "create": { "label": "Create", "description": "Create new records" },
    "read": { "label": "Read", "description": "View records" },
    "update": { "label": "Update", "description": "Modify records" },
    "delete": { "label": "Delete", "description": "Remove records" }
  }
}
```

### GET `/api/permissions/roles`

Get all available roles (system + custom).

**Response (200):**
```json
[
  {
    "id": "super_admin",
    "name": "Super Admin",
    "description": "Full system access",
    "permissions": { "*": ["*"] },
    "isCustom": false,
    "isSystem": true
  },
  {
    "id": "custom_123",
    "name": "Custom Manager",
    "description": "Custom role",
    "permissions": { "projects": ["read", "update"] },
    "isCustom": true,
    "isSystem": false
  }
]
```

### GET `/api/permissions/roles/:id`

Get a specific role.

### POST `/api/permissions/roles`

Create a custom role.

**Request:**
```json
{
  "name": "Custom Manager",
  "description": "Limited manager role",
  "permissions": {
    "projects": ["create", "read", "update"],
    "team": ["read"]
  }
}
```

### PUT `/api/permissions/roles/:id`

Update a custom role (must use `custom_` prefix).

### DELETE `/api/permissions/roles/:id`

Delete a custom role (must use `custom_` prefix).

### GET `/api/permissions/users/:userId/permissions`

Get permissions for a specific user.

### POST `/api/permissions/check`

Check if a user has permission for an action.

**Request:**
```json
{
  "module": "projects",
  "action": "delete",
  "userId": "user_id"
}
```

**Response (200):**
```json
{
  "allowed": false
}
```

---

## Metrics & Health API

Base: `/api/metrics`

### GET `/api/metrics`

Get system metrics (no auth required).

**Query Parameters:**
- `format` - Response format (`json` or `prometheus`)

**Response (200) - JSON:**
```json
{
  "process": {
    "uptime_seconds": 86400,
    "memory_heap_used_mb": 256
  },
  "system": {
    "load_1m": 0.5,
    "load_5m": 0.4,
    "total_memory_mb": 16384,
    "free_memory_mb": 8192
  },
  "http": {
    "total_requests": 15000,
    "by_method": { "GET": 10000, "POST": 4000, "PUT": 800, "DELETE": 200 }
  },
  "database": {
    "total": 20,
    "idle": 15,
    "waiting": 0
  },
  "timestamp": "2026-04-02T10:00:00Z"
}
```

**Response (200) - Prometheus:**
```
cortexbuild_uptime_seconds 86400
cortexbuild_memory_heap_bytes 268435456
cortexbuild_http_requests_total 15000
cortexbuild_db_connections 20
cortexbuild_system_load_1m 0.5
```

### GET `/api/metrics/health`

Health check endpoint (no auth required).

**Response (200):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-04-02T10:00:00Z"
}
```

**Response (503):**
```json
{
  "status": "unhealthy",
  "database": "disconnected",
  "error": "Connection refused"
}
```

---

## Deploy API

Base: `/api/deploy`

### POST `/api/deploy`

Trigger deployment (called by GitHub Actions).

**Authentication:** `Authorization: Bearer <DEPLOY_SECRET>`

**Response (200):**
```json
{
  "ok": true,
  "message": "Deploy started",
  "timestamp": "2026-04-02T10:00:00Z"
}
```

**Response (401):**
```json
{
  "error": "Unauthorized"
}
```

**Response (409):**
```json
{
  "error": "Deploy already in progress"
}
```

### GET `/api/deploy/status`

Check deployment status.

**Authentication:** `Authorization: Bearer <DEPLOY_SECRET>`

**Response (200):**
```json
{
  "deploying": false,
  "timestamp": "2026-04-02T10:00:00Z"
}
```

---

## Backup & Export API

Base: `/api/backup`

### GET `/api/backup/tables`

Get list of exportable tables.

**Response (200):**
```json
{
  "tables": [
    "projects",
    "invoices",
    "safety_incidents",
    "rfis",
    "change_orders",
    "team_members",
    "equipment",
    "subcontractors",
    "documents",
    "timesheets",
    "meetings",
    "materials",
    "punch_list",
    "inspections",
    "rams",
    "cis_returns",
    "tenders",
    "contacts",
    "risk_register",
    "purchase_orders",
    "daily_reports",
    "variations",
    "defects",
    "valuations",
    "specifications",
    "temp_works",
    "signage",
    "waste_management",
    "sustainability",
    "training",
    "certifications",
    "prequalification",
    "lettings",
    "measuring",
    "notifications",
    "users",
    "audit_log"
  ]
}
```

### GET `/api/backup/export/:table`

Export a single table.

**Query Parameters:**
- `format` - Export format (`json` or `csv`, default: `json`)
- `limit` - Max rows (default: 10000, max: 50000)

**Response (200) - JSON:**
```json
{
  "table": "projects",
  "count": 50,
  "data": [
    { "id": "proj_id", "name": "Project Alpha", ... }
  ]
}
```

**Response (200) - CSV:**
```csv
"id","name","client","status","budget","spent"
"proj_id","Project Alpha","Client A","active","100000","50000"
```

### GET `/api/backup/export-all`

Export all tables (full backup).

**Query Parameters:**
- `format` - Export format (`json` only)

**Response (200):**
```json
{
  "exportedAt": "2026-04-02T10:00:00Z",
  "version": "3.0.0",
  "tables": ["projects", "invoices", ...],
  "data": {
    "projects": { "count": 50, "rows": [...] },
    "invoices": { "count": 200, "rows": [...] }
  }
}
```

---

## WebSocket API

Base: `ws://localhost:3001/ws` (or `wss://www.cortexbuildpro.com/ws`)

### Connection

Connect with JWT token:

```
ws://localhost:3001/ws?token=<jwt_token>
```

### Connection Response

On successful connection:
```json
{
  "type": "system",
  "event": "connected",
  "payload": {
    "message": "Connected to CortexBuild real-time service",
    "timestamp": "2026-04-02T10:00:00Z"
  }
}
```

### Message Types

| Type | Description |
|------|-------------|
| `notification` | User notifications |
| `dashboard_update` | Real-time dashboard KPI updates |
| `alert` | High-priority alerts |
| `collaboration` | Project collaboration events |
| `system` | System messages |

### Client Events

#### Join Room

Join a project or custom room.

**Send:**
```json
{
  "event": "join_room",
  "payload": {
    "room": "project:proj_id"
  }
}
```

**Receive:**
```json
{
  "type": "system",
  "event": "room_joined",
  "payload": {
    "room": "project:proj_id"
  }
}
```

#### Leave Room

**Send:**
```json
{
  "event": "leave_room",
  "payload": {
    "room": "project:proj_id"
  }
}
```

#### Send Notification

Send a notification to a user or room.

**Send:**
```json
{
  "event": "send_notification",
  "payload": {
    "userId": "user_id",
    "data": {
      "title": "New Message",
      "description": "You have a new message"
    }
  }
}
```

#### Broadcast

Broadcast to all connected clients (admin+ only).

**Send:**
```json
{
  "event": "broadcast",
  "payload": {
    "title": "System Maintenance",
    "description": "Scheduled maintenance tonight"
  }
}
```

### Server Events

#### Notification

```json
{
  "type": "notification",
  "event": "notification",
  "payload": {
    "title": "Invoice Overdue",
    "description": "INV-001 is overdue",
    "severity": "warning",
    "link": "/invoicing",
    "timestamp": "2026-04-02T10:00:00Z"
  }
}
```

#### Dashboard Update

```json
{
  "type": "dashboard_update",
  "event": "create_projects",
  "payload": {
    "action": "create",
    "table": "projects",
    "record": { "id": "proj_id", "name": "New Project" },
    "affectedKpis": ["activeProjects", "totalRevenue"],
    "timestamp": "2026-04-02T10:00:00Z"
  }
}
```

#### Alert

```json
{
  "type": "alert",
  "event": "alert",
  "payload": {
    "title": "Safety Incident",
    "description": "High severity incident reported",
    "severity": "critical",
    "link": "/safety",
    "timestamp": "2026-04-02T10:00:00Z"
  }
}
```

#### Project Notification

```json
{
  "type": "collaboration",
  "event": "project_notification",
  "payload": {
    "projectId": "proj_id",
    "title": "New Document",
    "description": "Drawing uploaded",
    "timestamp": "2026-04-02T10:00:00Z"
  }
}
```

#### Error

```json
{
  "type": "system",
  "event": "error",
  "payload": {
    "message": "Unknown event: invalid_event"
  }
}
```

### Heartbeat

The server pings clients every 30 seconds. Clients must respond with pong within 5 seconds or be disconnected.

---

## Error Responses

### Standard Error Format

```json
{
  "message": "Error description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (invalid input) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (duplicate resource) |
| 429 | Too Many Requests (rate limit) |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Example Errors

**400 Bad Request:**
```json
{
  "message": "Password must be at least 8 characters"
}
```

**401 Unauthorized:**
```json
{
  "message": "Invalid email or password"
}
```

**403 Forbidden:**
```json
{
  "message": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "message": "User not found"
}
```

**409 Conflict:**
```json
{
  "message": "An account with that email already exists"
}
```

**429 Too Many Requests:**
```json
{
  "message": "Too many login attempts. Please try again in 15 minutes."
}
```

**500 Internal Server Error:**
```json
{
  "message": "Server error"
}
```

---

## Rate Limiting

### Global Rate Limiter

- **Window:** 15 minutes
- **Max Requests:** 100 per IP

### Authentication Endpoints

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| POST `/api/auth/login` | 15 minutes | 5 failed attempts |
| POST `/api/auth/register` | 1 hour | 5 |

### Email Endpoints

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| POST `/api/email/send` | 1 minute | 50 per user |
| POST `/api/email/bulk` | 1 minute | 50 per user |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1680436800
```

### Rate Limit Response (429)

```json
{
  "message": "Too many requests, please try again later."
}
```

---

## Additional Endpoints

### Dashboard Data

**GET `/api/dashboard-data`** - Get dashboard KPI data

### Analytics Data

**GET `/api/analytics-data`** - Get analytics chart data

### Financial Reports

**GET `/api/financial-reports`** - Get financial reports

**GET `/api/executive-reports`** - Get executive summary reports

### Daily Reports Summary

**GET `/api/reports`** - Get daily reports summary

### Tender AI

**POST `/api/tenders/ai`** - AI-powered tender analysis

### Team Member Data

**GET `/api/team-member-data`** - Get team member statistics

### Weather Forecast

**GET `/api/weather-forecast`** - Get weather data for projects

### Report Templates

**GET `/api/report-templates`** - List report templates

**POST `/api/report-templates`** - Create report template

### RAG Chat

**POST `/api/rag-chat`** - Chat with document embeddings

---

## OAuth Integration

### Google OAuth

**GET `/api/auth/google`** - Initiate Google OAuth flow

**GET `/api/auth/google/callback`** - OAuth callback handler

### Microsoft OAuth

**GET `/api/auth/microsoft`** - Initiate Microsoft OAuth flow

**GET `/api/auth/microsoft/callback`** - OAuth callback handler

---

## API Best Practices

1. **Always use HTTPS in production**
2. **Store JWT tokens securely** (httpOnly cookies recommended)
3. **Implement token refresh** before expiry
4. **Handle rate limits** with exponential backoff
5. **Use WebSocket for real-time updates** instead of polling
6. **Validate all user input** on the client side
7. **Log all API errors** for debugging

---

## Support

For API support, contact: support @cortexbuild.co.uk

**Documentation:** https://docs.cortexbuildpro.com  
**Status Page:** https://status.cortexbuildpro.com
