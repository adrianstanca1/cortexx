'use client'

import ModuleStub from '@/components/ui/ModuleStub'
import { IcSpark } from '@/components/ui/Icons'

export default function AskCortexPage() {
  return (
    <ModuleStub
      title="Ask Cortex"
      description="Conversational AI agent. Ask about your projects, financials, schedule, anything — and get answers grounded in your real data."
      Icon={IcSpark}
      color="#8b5cf6"
      features={["Natural language queries (“What’s Camden’s margin?”)","Cited answers (which records the answer came from)","Voice input","Suggested follow-up actions","Daily briefing on demand","Decision queue with one-tap approvals"]}
    />
  )
}
