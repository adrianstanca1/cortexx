'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcDoc } from '@/components/ui/Icons'

export default function SubinvoicesPage() {
  return (
    <ModuleStub
      title="Sub invoices"
      description="Invoices from subcontractors — CIS-aware. Auto-applies tax deduction, schedules payment runs."
      Icon={IcDoc}
      color="#f59e0b"
      features={["Upload PDF → AI extracts lines","CIS deduction auto-calculated","Match to PO + project","Approval workflow (PM → director)","Weekly payment run CSV (bank import)","CIS300 monthly submission"]}
    />
  )
}
