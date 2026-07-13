'use client'

interface BaseProps {
  id?: string
  label?: string
  error?: string | null
  hint?: string
}

interface InputProps extends BaseProps, React.InputHTMLAttributes<HTMLInputElement> {
  as?: 'input'
}

interface SelectProps extends BaseProps, React.SelectHTMLAttributes<HTMLSelectElement> {
  as: 'select'
  options?: Array<{ value: string; label: string }>
}

interface TextareaProps extends BaseProps, React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  as: 'textarea'
}

type FormFieldProps = InputProps | SelectProps | TextareaProps

const SF = 'var(--font-system)'
const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg3)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10,
  padding: '11px 14px',
  color: 'var(--t1)',
  fontFamily: SF,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

function renderControl(props: FormFieldProps, id?: string, ariaDescribedBy?: string) {
  const { label, error, hint, as, ...rest } = props as any
  const style = { ...inputStyle, ...(error ? { borderColor: 'var(--red)' } : {}) }
  if (as === 'select') {
    const { options = [], ...selectRest } = rest
    return (
      <select id={id} aria-describedby={ariaDescribedBy} {...selectRest} style={{ ...style, appearance: 'none' }}>
        {options.map((o: { value: string; label: string }) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }
  if (as === 'textarea') {
    return <textarea id={id} aria-describedby={ariaDescribedBy} {...rest} style={{ ...style, minHeight: 80, resize: 'vertical' }} />
  }
  return <input id={id} aria-describedby={ariaDescribedBy} {...rest} style={{ ...style, colorScheme: 'dark' }} />
}

/**
 * Labelled form control with optional error/hint text.
 */
export default function FormField(props: FormFieldProps) {
  const { id, label, error, hint } = props
  const descId = (hint || error) && id ? `${id}-desc` : undefined
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontFamily: SF,
            fontSize: 11,
            color: 'var(--t3)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </label>
      )}
      {renderControl(props, id, descId)}
      {error && <span id={descId} style={{ fontFamily: SF, fontSize: 12, color: 'var(--red)' }}>{error}</span>}
      {hint && !error && <span id={descId} style={{ fontFamily: SF, fontSize: 12, color: 'var(--t3)' }}>{hint}</span>}
    </div>
  )
}
