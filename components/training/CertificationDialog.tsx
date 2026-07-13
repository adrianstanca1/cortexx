'use client'

import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/ui/Modal'
import FormField from '@/components/ui/FormField'
import SegmentedControl from '@/components/ui/SegmentedControl'
import Button from '@/components/ui/Button'
import type { Certification, TrainingCourse } from '@/lib/types'

interface Member { id: string; name: string; role: string }

interface CertificationDialogProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<Certification>) => Promise<void>
  onDelete?: () => Promise<void>
  initial?: Partial<Certification> | null
  team: Member[]
  courses: TrainingCourse[]
  defaultMemberId?: string | null
  title?: string
}

const CATEGORIES = [
  { value: 'qualification', label: 'Qualification' },
  { value: 'training', label: 'Training' },
  { value: 'course', label: 'Course' },
  { value: 'licence', label: 'Licence' },
  { value: 'safety', label: 'Safety' },
]

const COMMON_TYPES = ['CSCS', 'IPAF', 'PASMA', 'SSSTS', 'SMSTS', 'Asbestos Awareness', 'First Aid at Work', 'Working at Heights', 'Manual Handling', 'Fire Warden']

export default function CertificationDialog({
  open,
  onClose,
  onSave,
  onDelete,
  initial,
  team,
  courses,
  defaultMemberId,
  title = initial?.id ? 'Edit certification' : 'Add certification',
}: CertificationDialogProps) {
  const [memberId, setMemberId] = useState(initial?.memberId || defaultMemberId || '')
  const [holderName, setHolderName] = useState(initial?.holderName || '')
  const [typeMode, setTypeMode] = useState<'preset' | 'custom'>(
    COMMON_TYPES.includes(initial?.type || '') ? 'preset' : 'custom'
  )
  const [type, setType] = useState(initial?.type || 'CSCS')
  const [customType, setCustomType] = useState(COMMON_TYPES.includes(initial?.type || '') ? '' : (initial?.type || ''))
  const [category, setCategory] = useState(initial?.category || 'qualification')
  const [number, setNumber] = useState(initial?.number || '')
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate ? initial.issuedDate.slice(0, 10) : '')
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate ? initial.expiryDate.slice(0, 10) : '')
  const [notes, setNotes] = useState(initial?.notes || '')
  const [courseId, setCourseId] = useState(initial?.courseId || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setMemberId(initial?.memberId || defaultMemberId || '')
    setHolderName(initial?.holderName || '')
    const isPreset = COMMON_TYPES.includes(initial?.type || '')
    setTypeMode(isPreset ? 'preset' : 'custom')
    setType(initial?.type || 'CSCS')
    setCustomType(isPreset ? '' : (initial?.type || ''))
    setCategory(initial?.category || 'qualification')
    setNumber(initial?.number || '')
    setIssuedDate(initial?.issuedDate ? initial.issuedDate.slice(0, 10) : '')
    setExpiryDate(initial?.expiryDate ? initial.expiryDate.slice(0, 10) : '')
    setNotes(initial?.notes || '')
    setCourseId(initial?.courseId || '')
    setError(null)
    setConfirmDelete(false)
  }, [open, initial, defaultMemberId])

  const selectedMemberName = useMemo(() => team.find((m) => m.id === memberId)?.name || '', [team, memberId])

  const handleMemberChange = (id: string) => {
    setMemberId(id)
    const name = team.find((m) => m.id === id)?.name
    if (name && !holderName.trim()) setHolderName(name)
  }

  const handleSave = async () => {
    const finalType = typeMode === 'preset' ? type : customType.trim()
    if (!holderName.trim()) { setError('Holder name is required'); return }
    if (!finalType) { setError('Type is required'); return }

    setLoading(true)
    setError(null)
    try {
      await onSave({
        id: initial?.id,
        memberId: memberId || null,
        holderName: holderName.trim(),
        type: finalType,
        category: category as Certification['category'],
        number: number.trim() || null,
        issuedDate: issuedDate || null,
        expiryDate: expiryDate || null,
        notes: notes.trim() || null,
        courseId: courseId || null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setLoading(true)
    try {
      await onDelete()
      setConfirmDelete(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 18 }}>
      <div>
        {onDelete && (
          <Button
            variant="danger"
            size="sm"
            loading={loading && confirmDelete}
            onClick={handleDelete}
          >
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="primary" loading={loading} onClick={handleSave}>{initial?.id ? 'Save changes' : 'Add certification'}</Button>
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={footer}
      loading={loading}
      size="md"
    >
      {error && <div style={{ padding: 10, borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: 'var(--red)', fontSize: 13, fontFamily: 'var(--font-system)' }}>{error}</div>}

      <FormField
        id="cert-member"
        as="select"
        label="Member (optional)"
        value={memberId}
        onChange={(e) => handleMemberChange(e.target.value)}
        options={[{ value: '', label: '— Not in team list —' }, ...team.map((m) => ({ value: m.id, label: `${m.name} · ${m.role}` }))]}
      />

      {selectedMemberName && holderName !== selectedMemberName && !initial?.id && (
        <div style={{ fontFamily: 'var(--font-system)', fontSize: 12, color: 'var(--t3)' }}>For {selectedMemberName}</div>
      )}

      <FormField
        id="cert-holder"
        label="Holder name"
        value={holderName}
        onChange={(e) => setHolderName(e.target.value)}
        placeholder="Person on the card"
      />

      <div>
        <label id="cert-category-label" style={labelStyle}>Category</label>
        <SegmentedControl
          ariaLabelledBy="cert-category-label"
          value={category}
          onChange={(v) => setCategory(v as Certification['category'])}
          options={CATEGORIES}
          size="sm"
        />
      </div>

      <FormField
        id="cert-course"
        as="select"
        label="Course catalog (optional)"
        value={courseId}
        onChange={(e) => setCourseId(e.target.value)}
        options={[{ value: '', label: '— None —' }, ...courses.map((c) => ({ value: c.id, label: `${c.name}${c.code ? ` (${c.code})` : ''}` }))]}
        hint="Linking a course auto-fills type and expiry rules in the future"
      />

      <div>
        <label id="cert-type-label" style={labelStyle}>Type</label>
        <SegmentedControl
          ariaLabelledBy="cert-type-label"
          value={typeMode}
          onChange={(v) => setTypeMode(v as 'preset' | 'custom')}
          options={[{ value: 'preset', label: 'Common' }, { value: 'custom', label: 'Custom' }]}
          size="sm"
        />
        <div style={{ marginTop: 8 }}>
          {typeMode === 'preset' ? (
            <FormField
              id="cert-type-preset"
              as="select"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={COMMON_TYPES.map((t) => ({ value: t, label: t }))}
            />
          ) : (
            <FormField
              id="cert-type-custom"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="e.g. Site Manager Safety Training Scheme"
            />
          )}
        </div>
      </div>

      <FormField
        id="cert-number"
        label="Card / cert number"
        value={number}
        onChange={(e) => setNumber(e.target.value)}
        placeholder="Optional"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FormField
          id="cert-issued"
          type="date"
          label="Issued"
          value={issuedDate}
          onChange={(e) => setIssuedDate(e.target.value)}
        />
        <FormField
          id="cert-expires"
          type="date"
          label="Expires"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
        />
      </div>

      <FormField
        id="cert-notes"
        as="textarea"
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Provider, location, restrictions…"
      />
    </Modal>
  )
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-system)',
  fontSize: 11,
  color: 'var(--t3)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 6,
}
