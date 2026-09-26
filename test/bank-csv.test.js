const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const path = require('node:path')

function loadModule(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, { module, exports: module.exports, require, console, Date, Number, String, Error })
  return module.exports
}

const { parseBankCsv } = loadModule('lib/bank-csv.ts')

test('bank CSV parser handles standard signed amount exports', () => {
  const csv = [
    'Date,Description,Reference,Amount,Currency,Account',
    '25/09/2026,"Acme Materials, Ltd",INV-42,-1200.50,GBP,Business Current',
    '26/09/2026,Client receipt,VAL-7,2500.00,GBP,Business Current',
  ].join('\n')
  const result = parseBankCsv(csv)
  assert.equal(result.transactions.length, 2)
  assert.equal(result.skipped, 0)
  assert.equal(result.transactions[0].amount, -1200.5)
  assert.equal(result.transactions[0].description, 'Acme Materials, Ltd')
  assert.equal(result.transactions[0].occurredAt.slice(0, 10), '2026-09-25')
  assert.equal(result.transactions[1].amount, 2500)
})

test('bank CSV parser handles separate debit and credit columns', () => {
  const csv = [
    'Transaction Date,Narrative,Debit,Credit,Balance',
    '2026-09-20,Fuel,85.25,,9914.75',
    '2026-09-21,Payment received,,6000,15914.75',
  ].join('\n')
  const result = parseBankCsv(csv)
  assert.equal(result.transactions[0].amount, -85.25)
  assert.equal(result.transactions[1].amount, 6000)
})

test('bank CSV parser produces stable external ids and skips invalid rows', () => {
  const csv = [
    'Date,Details,Amount,Balance',
    '25/09/2026,Fixings,-125.00,1000',
    'not-a-date,Bad row,50,1050',
    '26/09/2026,Zero,0,1050',
  ].join('\n')
  const first = parseBankCsv(csv)
  const second = parseBankCsv(csv)
  assert.equal(first.transactions.length, 1)
  assert.equal(first.skipped, 2)
  assert.equal(first.transactions[0].externalId, second.transactions[0].externalId)
})

test('bank CSV parser rejects files without transaction date or amount columns', () => {
  assert.throws(() => parseBankCsv('Description,Reference\nSomething,ABC'), /Date/)
  assert.throws(() => parseBankCsv('Date,Description\n25\/09\/2026,Something'), /Amount/)
})
