'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcLayers } from '@/components/ui/Icons'

export default function DrawingsPage() {
  return (
    <ModuleStub
      title="Drawings"
      description="Architect and engineer drawings, versioned, with pinned RFIs and snags on the relevant page."
      Icon={IcLayers}
      color="#2563eb"
      features={["PDF + DWG upload with revision tracking","Pin RFIs / snags to specific pages","Side-by-side rev compare","Markup tools (callouts, lengths)","Auto-notify subs when superseded","Drawing register PDF export"]}
    />
  )
}
