'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcDoc } from '@/components/ui/Icons'

export default function QuotesPage() {
  return (
    <ModuleStub
      title="Quotes"
      description="Build, send, and track quotes. AI generates a first draft from the brief — you refine the line items."
      Icon={IcDoc}
      color="#06b6d4"
      features={["AI-drafted quotes from brief","Line items from cost catalog","Margin slider","Status: draft / sent / accepted / declined","Auto-convert accepted quotes → project","Templates per service type"]}
    />
  )
}
