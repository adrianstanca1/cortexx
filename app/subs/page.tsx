'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcTeam } from '@/components/ui/Icons'

export default function SubcontractorsPage() {
  return (
    <ModuleStub
      title="Subcontractors"
      description="Your subbie roster — insurance, qualifications, day rate, project history."
      Icon={IcTeam}
      color="#2563eb"
      features={["Insurance + qualifications expiry alerts","Day rate + CIS / VAT status","Project history with ratings","Recent activity + jobs worked","Documents: contract, RAMS, certs","Auto-block bookings if cert expired"]}
    />
  )
}
