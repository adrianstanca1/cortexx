'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcArrowRight } from '@/components/ui/Icons'

export default function LeadsPage() {
  return (
    <ModuleStub
      title="Leads"
      description="Inbound enquiries from your website, referrals, or the trade network — qualified into customers + quotes."
      Icon={IcArrowRight}
      color="#06b6d4"
      features={["Lead capture form / inbox","Auto-enrichment (company lookup)","Stage pipeline (new / qualified / lost)","Convert to Customer + Project","Source attribution","Win/loss reporting"]}
    />
  )
}
