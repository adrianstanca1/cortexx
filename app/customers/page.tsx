'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcTeam } from '@/components/ui/Icons'

export default function CustomersPage() {
  return (
    <ModuleStub
      title="Customers"
      description="Your contacts — homeowners, agents, developers — with every project, invoice, and message they’ve been on."
      Icon={IcTeam}
      color="#2563eb"
      features={["One record per organisation + contacts","Project history per customer","Cumulative invoiced / paid / owed","Communication log","Tags + custom fields","Export to CSV / Excel"]}
    />
  )
}
