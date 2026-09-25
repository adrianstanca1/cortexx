CREATE TABLE "AccountingConnection" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'xero',
  "externalConnectionId" TEXT,
  "externalTenantId" TEXT,
  "externalTenantName" TEXT,
  "accessTokenCipher" TEXT,
  "refreshTokenCipher" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "scopes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'disconnected',
  "settings" JSONB NOT NULL DEFAULT '{}',
  "lastConnectedAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "lastHealthAt" TIMESTAMP(3),
  "lastHealthError" TEXT,
  "lastSyncAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT,
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccountingConnection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountingConnection_organizationId_provider_key" ON "AccountingConnection"("organizationId", "provider");
CREATE UNIQUE INDEX "AccountingConnection_provider_externalTenantId_key" ON "AccountingConnection"("provider", "externalTenantId");
CREATE INDEX "AccountingConnection_organizationId_status_idx" ON "AccountingConnection"("organizationId", "status");

CREATE TABLE "AccountingOAuthState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'xero',
  "stateHash" TEXT NOT NULL,
  "requestedById" TEXT,
  "returnTo" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountingOAuthState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccountingOAuthState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AccountingOAuthState_stateHash_key" ON "AccountingOAuthState"("stateHash");
CREATE INDEX "AccountingOAuthState_organizationId_provider_expiresAt_idx" ON "AccountingOAuthState"("organizationId", "provider", "expiresAt");
