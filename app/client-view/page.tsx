'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcLayers } from '@/components/ui/Icons'

export default function ClientviewPage() {
  return (
    <ModuleStub
      title="Client view"
      description="A read-only project portal you share with clients. Progress photos, schedule, snags, payment status — branded."
      Icon={IcLayers}
      color="#10b981"
      features={["Unique per-project public URL","Photo gallery (latest first)","Schedule with milestones","Snag list (their snags only)","Payment status + invoices to view","Custom branding (logo, colours)"]}
    />
  )
}
