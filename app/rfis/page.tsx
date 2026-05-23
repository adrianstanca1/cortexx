'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcAlert } from '@/components/ui/Icons'

export default function RFIsPage() {
  return (
    <ModuleStub
      title="RFIs"
      description="Requests for Information — formal queries from site to office, tracked with response SLAs and ball-in-court."
      Icon={IcAlert}
      color="#f59e0b"
      features={["Voice-note → AI transcription → structured RFI","Response SLA tracking + escalation","Ball-in-court routing","Linked to drawings / specifications","Auto-export to PDF for client","Status: open / answered / closed"]}
    />
  )
}
