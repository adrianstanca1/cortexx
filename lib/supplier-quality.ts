type DateValue = Date | string | null

export type SupplierQualitySource = {
  sourceType: 'snag' | 'inspection'
  id: string
  title: string
  status: string
  project: { id: string; name: string }
  updatedAt: DateValue
  description?: string | null
  priority?: string
  dueDate?: DateValue
  closedAt?: DateValue
  type?: string
  overallResult?: string | null
  completedAt?: DateValue
  notes?: string | null
}

export type QualityEvidenceInput = {
  id: string
  reason: string
  createdBy: string
  createdAt: DateValue
  withdrawnAt: DateValue
  withdrawnBy: string | null
  withdrawalReason: string | null
  source: SupplierQualitySource | null
  purchaseOrder: { id: string; number: string } | null
}

function iso(value: DateValue | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function supplierQuality(evidence: QualityEvidenceInput[], now = new Date()) {
  const today = iso(now)?.slice(0, 10)
  let defectCount = 0, openDefects = 0, closedDefects = 0, overdueDefects = 0, urgentOpenDefects = 0, unassessedDefects = 0
  let inspectionCount = 0, passedInspections = 0, failedInspections = 0, unassessedInspections = 0, withdrawnCount = 0, unavailableSources = 0
  const rows = evidence.map(record => {
    const source = record.source
    let assessment = 'not_assessed'
    if (record.withdrawnAt) {
      withdrawnCount++
      assessment = 'withdrawn'
    } else if (!source || (source.sourceType === 'inspection' && source.type !== 'quality')) {
      unavailableSources++
      assessment = 'source_unavailable'
    } else if (source.sourceType === 'snag') {
      defectCount++
      if (source.status === 'closed') {
        closedDefects++
        assessment = 'closed'
      } else if (source.status === 'open' || source.status === 'in_progress') {
        openDefects++
        assessment = 'open'
        if (['high', 'critical'].includes(source.priority || '')) urgentOpenDefects++
        const due = iso(source.dueDate)?.slice(0, 10)
        if (due && today && due < today) overdueDefects++
      } else unassessedDefects++
    } else {
      inspectionCount++
      // Draft/in-progress, missing completion and contradictory result/status
      // records never enter the denominator of a completed inspection rate.
      if (iso(source.completedAt) && source.status === 'passed' && source.overallResult === 'pass') {
        passedInspections++
        assessment = 'passed'
      } else if (iso(source.completedAt) && source.status === 'failed' && source.overallResult === 'fail') {
        failedInspections++
        assessment = 'failed'
      } else unassessedInspections++
    }
    return {
      id: record.id, reason: record.reason, createdBy: record.createdBy, createdAt: iso(record.createdAt),
      withdrawnAt: iso(record.withdrawnAt), withdrawnBy: record.withdrawnBy, withdrawalReason: record.withdrawalReason,
      assessment, purchaseOrder: record.purchaseOrder,
      source: source ? {
        ...source, updatedAt: iso(source.updatedAt), dueDate: iso(source.dueDate),
        closedAt: iso(source.closedAt), completedAt: iso(source.completedAt),
      } : null,
    }
  })
  const assessedInspections = passedInspections + failedInspections
  return {
    evidenceCount: evidence.length, withdrawnCount, unavailableSources,
    defectCount, openDefects, closedDefects, overdueDefects, urgentOpenDefects, unassessedDefects,
    inspectionCount, assessedInspections, passedInspections, failedInspections, unassessedInspections,
    inspectionPassPercent: assessedInspections ? Math.round(passedInspections / assessedInspections * 100) : null,
    rows,
  }
}

export type SupplierQuality = ReturnType<typeof supplierQuality> & { truncated: boolean }
