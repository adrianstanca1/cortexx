import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { requireAuth, actorName } from '@/lib/requireAuth'
import { enforceRateLimit } from '@/lib/rateLimit'
import { reportError } from '@/lib/errors'
import {
  RAMS_TEMPLATES,
  RAMS_TEMPLATE_KEYS,
  buildTemplateContext,
  fillTemplate,
} from '@/lib/rams-templates'
import { chat, buildSystemPrompt } from '@/lib/llm'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await requireAuth()
  if (auth instanceof NextResponse) return auth
  const __limited = await enforceRateLimit(req, 'write', (auth.user as { id?: string }).id)
  if (__limited) return __limited

  try {
    const body = await req.json()
    const projectId = String(body.projectId || '').trim()
    if (!projectId) return NextResponse.json({ error: 'Project is required' }, { status: 400 })
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, address: true, clientName: true },
    })
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 400 })

    const templateKey = String(body.template || 'generic_work_at_height')
    if (!RAMS_TEMPLATE_KEYS.includes(templateKey)) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
    }
    const template = RAMS_TEMPLATES[templateKey]
    const workDescription = String(body.workDescription || '').trim()
    const preparedBy = actorName(auth)
    const ctx = buildTemplateContext(project, workDescription, preparedBy)
    const draft = fillTemplate(template, ctx)

    // Optional AI enhancement — only if the local LLM is reachable.
    let enhanced: typeof draft | null = null
    if (body.ai === true) {
      try {
        const prompt = `You are a UK construction health and safety advisor. Draft a concise ${template.type.replace(/_/g, ' ')} for the following project and work. Keep the same sections: Hazards, Controls, PPE, Notes. Return ONLY a JSON object with keys "hazards", "controls", "ppe", "notes". Do not include markdown or explanation.\n\nProject: ${project.name}\nAddress: ${project.address || 'Not provided'}\nClient: ${project.clientName || 'Not provided'}\nWork description: ${workDescription || template.title}\n\nExisting draft to improve:\nHazards:\n${draft.hazards}\n\nControls:\n${draft.controls}\n\nPPE:\n${draft.ppe}\n\nNotes:\n${draft.notes}`
        const response = await chat([
          { role: 'system', content: buildSystemPrompt({ activeProjectCount: 0, openSnagCount: 0, pendingTimesheetCount: 0, recentActivity: [], projectNames: [] }) },
          { role: 'user', content: prompt },
        ], { json: true })
        const parsed = JSON.parse(response.content || '{}')
        enhanced = {
          ...draft,
          hazards: String(parsed.hazards || draft.hazards).slice(0, 4000),
          controls: String(parsed.controls || draft.controls).slice(0, 4000),
          ppe: String(parsed.ppe || draft.ppe).slice(0, 1000),
          notes: String(parsed.notes || draft.notes).slice(0, 2000),
        }
      } catch (err) {
        console.error('[rams/generate] AI enhancement failed, returning template draft:', err)
      }
    }

    const result = enhanced || draft
    const doc = await prisma.rams.create({
      data: {
        projectId,
        title: draft.title,
        type: template.type,
        status: 'draft',
        hazards: result.hazards,
        controls: result.controls,
        ppe: result.ppe,
        notes: result.notes,
        reviewBy: new Date(draft.reviewBy),
      },
      include: { project: { select: { id: true, name: true } } },
    })

    prisma.activity.create({
      data: {
        projectId,
        actorName: preparedBy,
        actorType: 'human',
        action: `generated ${template.type === 'rams' ? 'RAMS' : template.type.replace(/_/g, ' ')}: ${doc.title}`,
        iconType: 'doc',
      },
    }).catch(() => {})

    return NextResponse.json(doc, { status: 201 })
  } catch (error) {
    reportError(error)
    return NextResponse.json({ error: 'Failed to generate RAMS' }, { status: 500 })
  }
}
