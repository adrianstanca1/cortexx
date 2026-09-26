-- Composite indexes for the tenant-scoped Innovation OS read path.
CREATE INDEX "Improvement_organizationId_projectId_createdAt_idx"
ON "Improvement"("organizationId", "projectId", "createdAt");

CREATE INDEX "ProcessDoc_organizationId_publishedAt_createdAt_idx"
ON "ProcessDoc"("organizationId", "publishedAt", "createdAt");

CREATE INDEX "FieldConstraint_organizationId_projectId_status_priority_dueDate_idx"
ON "FieldConstraint"("organizationId", "projectId", "status", "priority", "dueDate");

CREATE INDEX "FieldProductionLog_organizationId_projectId_date_createdAt_idx"
ON "FieldProductionLog"("organizationId", "projectId", "date", "createdAt");

CREATE INDEX "ProgrammeActivity_organizationId_projectId_status_plannedEnd_idx"
ON "ProgrammeActivity"("organizationId", "projectId", "status", "plannedEnd");

CREATE INDEX "ProcurementRequisition_organizationId_projectId_status_neededBy_idx"
ON "ProcurementRequisition"("organizationId", "projectId", "status", "neededBy");

CREATE INDEX "SafetyIncident_organizationId_projectId_status_severity_idx"
ON "SafetyIncident"("organizationId", "projectId", "status", "severity");
