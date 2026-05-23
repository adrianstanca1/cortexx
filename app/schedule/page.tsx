'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcClock } from '@/components/ui/Icons'

export default function SchedulePage() {
  return (
    <ModuleStub
      title="Schedule"
      description="Gantt-style program of works across all projects. Drag to reschedule, see resource clashes, predict slippage."
      Icon={IcClock}
      color="#06b6d4"
      features={["Gantt + week / day views","Resource view (who’s on what)","Critical path highlight","Slippage prediction from actuals","Subcontractor mobilisation reminders","Bank holiday + weekend handling"]}
    />
  )
}
