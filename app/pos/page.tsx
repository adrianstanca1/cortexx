'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcDoc } from '@/components/ui/Icons'

export default function PurchaseordersPage() {
  return (
    <ModuleStub
      title="Purchase orders"
      description="Issue POs to merchants and subs. Match deliveries, three-way match with invoices."
      Icon={IcDoc}
      color="#f59e0b"
      features={["Issue PO from cost catalog or freeform","Email PDF to supplier","Delivery note capture (photo)","Three-way match: PO ↔ GRN ↔ invoice","Outstanding PO ageing report","Per-project commitment vs budget"]}
    />
  )
}
