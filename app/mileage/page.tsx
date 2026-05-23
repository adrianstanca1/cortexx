'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcTruck } from '@/components/ui/Icons'

export default function MileagePage() {
  return (
    <ModuleStub
      title="Mileage"
      description="Track business travel — HMRC mileage allowance calculated automatically, fuel-card matched."
      Icon={IcTruck}
      color="#06b6d4"
      features={["Auto-track from phone GPS (opt-in)","Manual entry with site postcode","HMRC allowance auto-calc","Fuel card statement match","Per-employee monthly statement","Export to payroll"]}
    />
  )
}
