'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcCamera } from '@/components/ui/Icons'

export default function PhotosPage() {
  return (
    <ModuleStub
      title="Photos"
      description="Geo-tagged site photos organised by project + date. AI tags content (electrics / plaster / damage)."
      Icon={IcCamera}
      color="#8b5cf6"
      features={["Drag-and-drop upload","Geo + EXIF auto-tagging","AI content tags (electrics, plaster, damage)","Compare same view over time","Mark up + annotate","Export project album to PDF"]}
    />
  )
}
