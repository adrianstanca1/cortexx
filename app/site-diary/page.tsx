'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcDoc } from '@/components/ui/Icons'

export default function SitediaryPage() {
  return (
    <ModuleStub
      title="Site diary"
      description="Daily journal per project — weather, attendance, work done, issues. Auto-compiled from your activity + check-ins."
      Icon={IcDoc}
      color="#10b981"
      features={["Auto-compiled from check-ins + activity","Daily weather (auto-fetched)","Attendance: who was on site","Work done in plain English (AI summary)","Issues + remediation log","PDF export for client / loss adjuster"]}
    />
  )
}
