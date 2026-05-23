'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcLayers } from '@/components/ui/Icons'

export default function CostcatalogPage() {
  return (
    <ModuleStub
      title="Cost catalog"
      description="Your unit-rate library. Used to price quotes and benchmark actuals."
      Icon={IcLayers}
      color="#06b6d4"
      features={["Unit rates per trade / element","Auto-import merchant trade-account prices","Markup rules per customer tier","Historical price tracking","Bulk update on indexation","Sync to estimating module"]}
    />
  )
}
