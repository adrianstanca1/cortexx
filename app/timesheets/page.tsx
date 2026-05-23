'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcClock } from '@/components/ui/Icons'

export default function TimesheetsPage() {
  return (
    <ModuleStub
      title="Timesheets"
      description="Hours per person per project per day. Approve weekly, export to payroll, bill clients."
      Icon={IcClock}
      color="#8b5cf6"
      features={["Auto-populated from check-ins","Manual entry + bulk edit","Weekly approval workflow","Variance vs schedule","Export to payroll (Sage / Xero)","CIS deduction at source for subs"]}
    />
  )
}
