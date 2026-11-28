'use client'

import { useEffect, useState } from 'react'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import type { TrainingCourse } from '@/lib/types'

interface CourseDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<TrainingCourse>) => Promise<void>
  initial?: TrainingCourse | null
}

const CATEGORIES = [
  { value: 'safety', label: 'Safety' },
  { value: 'technical', label: 'Technical' },
  { value: 'management', label: 'Management' },
  { value: 'first_aid', label: 'First aid' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'other', label: 'Other' },
]

export default function CourseDialog({ open, onClose, onSave, initial }: CourseDialogProps) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [provider, setProvider] = useState('')
  const [category, setCategory] = useState('safety')
  const [validityDays, setValidityDays] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(initial?.name || '')
    setCode(initial?.code || '')
    setProvider(initial?.provider || '')
    setCategory(initial?.category || 'safety')
    setValidityDays(initial?.validityDays ? String(initial.validityDays) : '')
    setDescription(initial?.description || '')
    setError(null)
  }, [open, initial])

  const handleSave = async () => {
    if (!name.trim()) { setError('Course name is required'); return }
    setLoading(true)
    setError(null)
    try {
      await onSave({
        id: initial?.id,
        name: name.trim(),
        code: code.trim() || null,
        provider: provider.trim() || null,
        category: category as TrainingCourse['category'],
        validityDays: validityDays ? Number(validityDays) : null,
        description: description.trim() || null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title={initial?.id ? 'Edit course' : 'Add course'}
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 18 }}>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" loading={loading} onClick={handleSave}>{initial?.id ? 'Save course' : 'Add course'}</Button>
        </div>
      }
      loading={loading}
      size="md"
    >
      {error && <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: 'var(--red)', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>}
      <FormField id="course-name" label="Course name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SMSTS" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField id="course-code" label="Code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Optional" />
        <FormField id="course-provider" label="Provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Optional" />
      </div>
      <div>
        <div id="course-category-label" style={{ fontFamily: 'var(--font-system)', fontSize: 11, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Category</div>
        <SegmentedControl
          ariaLabelledBy="course-category-label"
          value={category}
          onChange={setCategory}
          options={CATEGORIES}
          size="sm"
        />
      </div>
      <FormField
        id="course-validity"
        type="number"
        min={1}
        label="Validity (days)"
        value={validityDays}
        onChange={(e) => setValidityDays(e.target.value)}
        hint="Leave blank for a non-expiring course"
      />
      <FormField id="course-description" as="textarea" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
    </Modal>
  )
}
