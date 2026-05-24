'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { Loader2, Receipt, TrendingUp, Clock, AlertTriangle, FileText, Download } from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  projectId: string | null;
  vendor: string | null;
  amount: number | null;
  status: string;
  dueDate: string | null;
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue'>('all');

  useEffect(() => {
    apiFetch('/invoices').then(r => r.json()).then(data => {
      setInvoices(data.invoices || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const total = invoices.reduce((s, i) => s + (i.amount || 0), 0);
  const pending = invoices.filter(i => i.status === 'pending');
  const paid = invoices.filter(i => i.status === 'paid');
  const overdue = invoices.filter(i => i.status === 'overdue');
  const totalPending = pending.reduce((s, i) => s + (i.amount || 0), 0);
  const totalPaid = paid.reduce((s, i) => s + (i.amount || 0), 0);
  const totalOverdue = overdue.reduce((s, i) => s + (i.amount || 0), 0);

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Invoices</h1>
        </div>
        <Button size="sm"><FileText className="mr-1 h-4 w-4" />Create Invoice</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-l-4 border-emerald-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Paid</p><p className="text-xl font-bold">${totalPaid.toLocaleString()}</p><p className="text-xs text-slate-400">{paid.length} invoices</p></div>
            <TrendingUp className="h-7 w-7 text-emerald-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Pending</p><p className="text-xl font-bold">${totalPending.toLocaleString()}</p><p className="text-xs text-slate-400">{pending.length} invoices</p></div>
            <Clock className="h-7 w-7 text-blue-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Overdue</p><p className="text-xl font-bold text-red-600">${totalOverdue.toLocaleString()}</p><p className="text-xs text-slate-400">{overdue.length} invoices</p></div>
            <AlertTriangle className="h-7 w-7 text-red-500 opacity-70" />
          </div>
        </Card>
        <Card className="p-4 border-l-4 border-violet-500">
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-slate-500">Total</p><p className="text-xl font-bold">${total.toLocaleString()}</p><p className="text-xs text-slate-400">{invoices.length} invoices</p></div>
            <Receipt className="h-7 w-7 text-violet-500 opacity-70" />
          </div>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        {(['all','pending','paid','overdue'] as const).map(f => (
          <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)} {f === 'all' ? `(${invoices.length})` : `(${invoices.filter(i=>i.status===f).length})`}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(i => (
          <Card key={i.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Receipt className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="font-semibold">#{i.invoiceNumber}</p>
                  <p className="text-xs text-slate-500">{i.vendor || 'Unknown vendor'}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold">${(i.amount || 0).toLocaleString()}</p>
                  <p className="text-xs text-slate-400">Due {i.dueDate || '-'}</p>
                </div>
                <Badge variant={i.status === 'paid' ? 'success' : i.status === 'overdue' ? 'destructive' : 'warning'}>{i.status}</Badge>
                <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-slate-500 py-8">No invoices found</p>}
      </div>
    </div>
  );
}
