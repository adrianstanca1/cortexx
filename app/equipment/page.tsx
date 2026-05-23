'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcWrench } from '@/components/ui/Icons'

export default function EquipmentPage() {
  return (
    <ModuleStub
      title="Equipment"
      description="Plant & tools register. Track location, service intervals, who has what."
      Icon={IcWrench}
      color="#52749a"
      features={["Asset register (serial #, value, owner)","Service interval alerts","Check-out / check-in to subs","Location tracking (last seen)","Hire vs own cost comparison","PAT + LOLER cert tracking"]}
    />
  )
}
