'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcWrench } from '@/components/ui/Icons'

export default function VariationsPage() {
  return (
    <ModuleStub
      title="Variations"
      description="Change orders — scope changes that affect cost / time. Tracked from raise to client approval."
      Icon={IcWrench}
      color="#8b5cf6"
      features={["Raise from any record (snag, task, conversation)","Cost impact + time impact","Client approval workflow","Auto-update contract value","Margin recalc on approval","Variation register PDF"]}
    />
  )
}
