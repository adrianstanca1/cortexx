export interface BankCsvTransaction {
  externalId: string
  occurredAt: string
  amount: number
  currency: string
  description: string
  reference: string
  accountName: string
  raw: string
}

export interface BankCsvParseResult {
  transactions: BankCsvTransaction[]
  skipped: number
  headers: string[]
}

const DATE_HEADERS = ['date', 'transactiondate', 'bookingdate', 'posteddate', 'valuedate']
const AMOUNT_HEADERS = ['amount', 'transactionamount', 'value']
const DEBIT_HEADERS = ['debit', 'debitamount', 'moneyout', 'paidout', 'withdrawal']
const CREDIT_HEADERS = ['credit', 'creditamount', 'moneyin', 'paidin', 'deposit']
const DESCRIPTION_HEADERS = ['description', 'transactiondescription', 'details', 'narrative', 'memo', 'merchant', 'payee']
const REFERENCE_HEADERS = ['reference', 'paymentreference', 'transactionreference', 'ref']
const ACCOUNT_HEADERS = ['account', 'accountname', 'accountnumber', 'bankaccount']
const CURRENCY_HEADERS = ['currency', 'currencycode']
const BALANCE_HEADERS = ['balance', 'runningbalance']

function normaliseHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        quoted = !quoted
      }
      continue
    }

    if (ch === ',' && !quoted) {
      row.push(field)
      field = ''
      continue
    }

    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some(cell => cell.trim() !== '')) rows.push(row)
      row = []
      continue
    }

    field += ch
  }

  row.push(field)
  if (row.some(cell => cell.trim() !== '')) rows.push(row)
  return rows
}

function findIndex(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias)
    if (index >= 0) return index
  }
  return -1
}

function numberFromCell(value: string) {
  const input = value.trim()
  if (!input) return null
  const negative = /^\(.*\)$/.test(input)
  const cleaned = input
    .replace(/[£$€]/g, '')
    .replace(/,/g, '')
    .replace(/[()]/g, '')
    .trim()
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null
  return negative ? -Math.abs(parsed) : parsed
}

function isoDate(value: string) {
  const input = value.trim()
  if (!input) return null

  const iso = input.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const uk = input.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2}|\d{4})$/)
  if (uk) {
    const [, d, m, rawYear] = uk
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear)
    const date = new Date(Date.UTC(year, Number(m) - 1, Number(d)))
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const parsed = new Date(input)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function clean(value: string | undefined, max = 500) {
  return String(value || '').trim().slice(0, max)
}

export function parseBankCsv(text: string): BankCsvParseResult {
  const rows = parseCsvRows(text.replace(/^\uFEFF/, ''))
  if (rows.length < 2) return { transactions: [], skipped: 0, headers: rows[0] || [] }

  const headers = rows[0].map(normaliseHeader)
  const dateIndex = findIndex(headers, DATE_HEADERS)
  const amountIndex = findIndex(headers, AMOUNT_HEADERS)
  const debitIndex = findIndex(headers, DEBIT_HEADERS)
  const creditIndex = findIndex(headers, CREDIT_HEADERS)
  const descriptionIndex = findIndex(headers, DESCRIPTION_HEADERS)
  const referenceIndex = findIndex(headers, REFERENCE_HEADERS)
  const accountIndex = findIndex(headers, ACCOUNT_HEADERS)
  const currencyIndex = findIndex(headers, CURRENCY_HEADERS)
  const balanceIndex = findIndex(headers, BALANCE_HEADERS)

  if (dateIndex < 0) throw new Error('CSV needs a Date or Transaction Date column')
  if (amountIndex < 0 && debitIndex < 0 && creditIndex < 0) {
    throw new Error('CSV needs Amount, or Debit/Credit columns')
  }

  const transactions: BankCsvTransaction[] = []
  let skipped = 0

  rows.slice(1, 1001).forEach((row, rowIndex) => {
    const occurredAt = isoDate(row[dateIndex] || '')
    let amount: number | null = amountIndex >= 0 ? numberFromCell(row[amountIndex] || '') : null

    if (amount === null) {
      const debit = debitIndex >= 0 ? numberFromCell(row[debitIndex] || '') : null
      const credit = creditIndex >= 0 ? numberFromCell(row[creditIndex] || '') : null
      if (credit !== null && credit !== 0) amount = Math.abs(credit)
      else if (debit !== null && debit !== 0) amount = -Math.abs(debit)
    }

    if (!occurredAt || amount === null || amount === 0) {
      skipped++
      return
    }

    const description = descriptionIndex >= 0 ? clean(row[descriptionIndex]) : ''
    const reference = referenceIndex >= 0 ? clean(row[referenceIndex], 160) : ''
    const accountName = accountIndex >= 0 ? clean(row[accountIndex], 160) : ''
    const currency = currencyIndex >= 0 ? clean(row[currencyIndex], 3).toUpperCase() || 'GBP' : 'GBP'
    const balance = balanceIndex >= 0 ? clean(row[balanceIndex], 80) : ''
    const rawIdentity = [occurredAt.slice(0, 10), amount.toFixed(2), description, reference, balance].join('|')
    const externalId = rawIdentity.slice(0, 500) || `csv-row-${rowIndex + 2}`

    transactions.push({
      externalId,
      occurredAt,
      amount,
      currency,
      description,
      reference,
      accountName,
      raw: row.join(',').slice(0, 500),
    })
  })

  return { transactions, skipped, headers: rows[0] }
}
