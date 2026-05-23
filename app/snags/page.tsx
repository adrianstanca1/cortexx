'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcAlert } from '@/components/ui/Icons'

export default function SnagsPage() {
  return (
    <ModuleStub
      title="Snags"
      description="Defect register per project. Each snag has photo, location, contractor, due date, sign-off."
      Icon={IcAlert}
      color="#ef4444"
      features={["Photo → AI defect detection (auto-files snag)","Pin to drawing or location tag","Assign contractor + due date","Sign-off photo proof","Snag list PDF (for handover)","Reopen if not actually fixed"]}
    />
  )
}
