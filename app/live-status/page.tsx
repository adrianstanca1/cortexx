'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcPin } from '@/components/ui/Icons'

export default function LivestatusPage() {
  return (
    <ModuleStub
      title="Live status"
      description="Who is on which site right now. Fed by check-ins, visible to PMs."
      Icon={IcPin}
      color="#06b6d4"
      features={["Real-time map of all sites + people","Filter by trade / sub / project","Last seen timestamp","Coverage gaps (sites unstaffed)","Auto-text the PM if someone late","Historical heatmap"]}
    />
  )
}
