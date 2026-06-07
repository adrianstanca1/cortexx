// CortexBuild Pro — /api/payments  (v1.3)
// Generates payment links for invoices via:
//   • Stripe Payment Links API  (real, production-ready)
//   • GoCardless Direct Debit    (real, production-ready)
//   • Manual bank transfer       (UK Faster Payments — no third party)
//
// All three are turned on/off by the presence of their respective secrets in
// server/.env. If a secret is missing, that provider returns 503 with a
// clear message; the others still work. No env required for the bank-transfer
// path — it just renders payment details from BANK_* env vars.
//
// All links/refs are persisted to `invoices.payment_link_url / .payment_ref`
// via the generic /api/invoices update route the front-end already uses.

const express = require('express');
const router = express.Router();

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const GC_TOKEN = process.env.GOCARDLESS_ACCESS_TOKEN || '';
const GC_BASE = (process.env.GOCARDLESS_BASE || 'https://api.gocardless.com').replace(/\/+$/, '');

// Bank-transfer details (no third party — just rendered for the client)
const BANK = {
  accountName: process.env.BANK_ACCOUNT_NAME || 'CortexBuild Ltd',
  sortCode:    process.env.BANK_SORT_CODE    || '',
  accountNo:   process.env.BANK_ACCOUNT_NO   || '',
  iban:        process.env.BANK_IBAN         || '',
};

function timeoutFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 15000);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Stripe wants amounts in pennies and form-encoded bodies
function form(o) {
  return Object.entries(o)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
    .join('&');
}

// ── Stripe: create a Product + Price + Payment Link in one go ─────────
async function stripeLink({ invoiceId, amountPennies, currency, description }) {
  if (!STRIPE_KEY) { const e = new Error('Stripe not configured — set STRIPE_SECRET_KEY'); e.status = 503; throw e; }
  const auth = 'Bearer ' + STRIPE_KEY;
  const h = { authorization: auth, 'content-type': 'application/x-www-form-urlencoded' };

  // 1. Product
  const pRes = await timeoutFetch('https://api.stripe.com/v1/products', {
    method: 'POST', headers: h,
    body: form({ name: 'Invoice ' + invoiceId, description: (description || '').slice(0, 250) }),
  });
  if (!pRes.ok) throw new Error('Stripe products: ' + pRes.status + ' ' + (await pRes.text()).slice(0, 200));
  const product = await pRes.json();

  // 2. Price
  const prRes = await timeoutFetch('https://api.stripe.com/v1/prices', {
    method: 'POST', headers: h,
    body: form({ 'unit_amount': amountPennies, currency: (currency || 'gbp').toLowerCase(), product: product.id }),
  });
  if (!prRes.ok) throw new Error('Stripe prices: ' + prRes.status + ' ' + (await prRes.text()).slice(0, 200));
  const price = await prRes.json();

  // 3. Payment Link
  const lRes = await timeoutFetch('https://api.stripe.com/v1/payment_links', {
    method: 'POST', headers: h,
    body: form({ 'line_items[0][price]': price.id, 'line_items[0][quantity]': '1' }),
  });
  if (!lRes.ok) throw new Error('Stripe payment_links: ' + lRes.status + ' ' + (await lRes.text()).slice(0, 200));
  const link = await lRes.json();
  return { provider: 'stripe', url: link.url, ref: link.id };
}

// ── GoCardless: hosted billing-request flow (real Direct Debit) ──────
async function gocardlessLink({ invoiceId, amountPennies, currency, description }) {
  if (!GC_TOKEN) { const e = new Error('GoCardless not configured — set GOCARDLESS_ACCESS_TOKEN'); e.status = 503; throw e; }
  const h = {
    authorization: 'Bearer ' + GC_TOKEN,
    'content-type': 'application/json',
    'GoCardless-Version': '2015-07-06',
    'Accept': 'application/json',
  };
  // 1. Billing request (one-off payment with mandate)
  const brRes = await timeoutFetch(GC_BASE + '/billing_requests', {
    method: 'POST', headers: h,
    body: JSON.stringify({ billing_requests: {
      payment_request: {
        description: 'Invoice ' + invoiceId + (description ? ' — ' + description : ''),
        amount: amountPennies,
        currency: (currency || 'GBP').toUpperCase(),
      },
      mandate_request: { scheme: 'bacs', currency: (currency || 'GBP').toUpperCase() },
    }}),
  });
  if (!brRes.ok) throw new Error('GoCardless billing_request: ' + brRes.status + ' ' + (await brRes.text()).slice(0, 200));
  const br = await brRes.json();
  const brId = br.billing_requests.id;

  // 2. Billing-request flow (hosted page URL)
  const flowRes = await timeoutFetch(GC_BASE + '/billing_request_flows', {
    method: 'POST', headers: h,
    body: JSON.stringify({ billing_request_flows: { links: { billing_request: brId } } }),
  });
  if (!flowRes.ok) throw new Error('GoCardless flow: ' + flowRes.status + ' ' + (await flowRes.text()).slice(0, 200));
  const flow = await flowRes.json();
  return { provider: 'gocardless', url: flow.billing_request_flows.authorisation_url, ref: brId };
}

// ── Bank transfer: pure render ────────────────────────────────────────
function bankTransferDetails({ invoiceId, amountPennies, currency }) {
  return {
    provider: 'bank',
    accountName: BANK.accountName,
    sortCode: BANK.sortCode || null,
    accountNo: BANK.accountNo || null,
    iban: BANK.iban || null,
    reference: invoiceId,
    amount: (amountPennies / 100).toFixed(2),
    currency: (currency || 'GBP').toUpperCase(),
    ready: !!(BANK.accountName && (BANK.sortCode && BANK.accountNo) || BANK.iban),
  };
}

// ── Routes ────────────────────────────────────────────────────────────
router.get('/payments/providers', (_req, res) => {
  res.json({
    stripe:     { available: !!STRIPE_KEY,        mode: STRIPE_KEY.startsWith('sk_test_') ? 'test' : (STRIPE_KEY ? 'live' : 'off') },
    gocardless: { available: !!GC_TOKEN,          mode: GC_BASE.includes('sandbox') ? 'sandbox' : (GC_TOKEN ? 'live' : 'off') },
    bank:       { available: !!(BANK.accountName && ((BANK.sortCode && BANK.accountNo) || BANK.iban)) },
  });
});

router.post('/payments/link', async (req, res) => {
  try {
    const b = req.body || {};
    const provider = String(b.provider || 'stripe');
    const invoiceId = String(b.invoiceId || '').trim();
    const amount = Number(b.amount);
    if (!invoiceId || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'invoiceId and positive amount required' });
    }
    const amountPennies = Math.round(amount * 100);
    const currency = b.currency || 'GBP';
    const description = b.description || '';
    if (provider === 'stripe')      return res.json(await stripeLink({ invoiceId, amountPennies, currency, description }));
    if (provider === 'gocardless')  return res.json(await gocardlessLink({ invoiceId, amountPennies, currency, description }));
    if (provider === 'bank')        return res.json(bankTransferDetails({ invoiceId, amountPennies, currency }));
    return res.status(400).json({ error: 'unknown provider: ' + provider });
  } catch (e) {
    const status = e.status || 502;
    res.status(status).json({ error: e.message || 'payment-link generation failed', provider: req.body && req.body.provider });
  }
});

module.exports = router;
