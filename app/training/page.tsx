'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcHardhat } from '@/components/ui/Icons'

export default function TrainingPage() {
  return (
    <ModuleStub
      title="Training"
      description="Track required tickets (CSCS, IPAF, asbestos awareness). Block bookings if expired."
      Icon={IcHardhat}
      color="#f59e0b"
      features={["Per-person ticket register","Expiry alerts (60 / 30 / 7 days)","Auto-block site bookings if expired","Photo upload of physical card","Renewal booking links","Cost tracking per renewal"]}
    />
  )
}
