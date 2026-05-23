'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcPin } from '@/components/ui/Icons'

export default function CheckinoutPage() {
  return (
    <ModuleStub
      title="Check in/out"
      description="GPS-verified arrival + departure per site. Replaces sign-in sheets, drives timesheets."
      Icon={IcPin}
      color="#10b981"
      features={["One-tap check in (GPS verified)","Auto check-out at end of day","Site-specific induction confirmation","Visible to PM in real-time","Drives timesheet hours","Late / missed alerts"]}
    />
  )
}
