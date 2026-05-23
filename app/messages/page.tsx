'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcBell } from '@/components/ui/Icons'

export default function MessagesPage() {
  return (
    <ModuleStub
      title="Messages"
      description="Threaded conversations with your team, subs, and clients — kept on-record per project."
      Icon={IcBell}
      color="#06b6d4"
      features={["Per-project threads","Read receipts + typing indicators","Tag any team member with @mention","Attach photos / docs inline","Push to all participants via PWA notifications","Searchable across projects"]}
    />
  )
}
