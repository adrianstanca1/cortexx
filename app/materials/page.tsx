'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcWrench } from '@/components/ui/Icons'

export default function MaterialsPage() {
  return (
    <ModuleStub
      title="Materials"
      description="Track materials ordered, delivered, used per project. Cuts wastage and theft."
      Icon={IcWrench}
      color="#f59e0b"
      features={["Cost catalog with merchant prices","Order against project budget","Goods received note (photo)","Stock locations (yard / van / site)","Waste % per project","Reorder forecasts from schedule"]}
    />
  )
}
