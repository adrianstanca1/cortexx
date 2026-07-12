// CortexBuild Pro — Phase 115: Procurement & Supply Chain
// ProcurementScreen — PO approval workflow, delivery tracking, supplier
// scorecards, and stock levels. Wired to purchaseOrders, supplierScores,
// and materials tables.

(function () {
  if (!window.Backend) return;
  const card = extra => ({
    background: T.bg1,
    border: '1px solid ' + T.hair,
    borderRadius: 14,
    padding: 16,
    ...extra
  });
  const money = n => '£' + Math.round(Number(n) || 0).toLocaleString();
  const STATUS_COL = {
    pending: '#f59e0b',
    approved: '#3b82f6',
    ordered: '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#64748b'
  };
  window.ProcurementScreen = function ({
    accent
  }) {
    const pos = window.useDB('purchaseOrders');
    const scores = window.useDB('supplierScores');
    const materials = window.useDB('materials');
    const [tab, setTab] = React.useState('approvals');
    const acc = accent || T.blue;
    const C = Backend.computed;
    const pending = pos.filter(p => p.status === 'pending');
    const inTransit = pos.filter(p => p.status === 'ordered' || p.status === 'approved');
    const lowStock = materials.filter(m => Number(m.stock) < Number(m.min || 0));
    const approve = async po => {
      await Backend.db.purchaseOrders.update(po.id, {
        status: 'approved'
      });
      window.cortexxToast && window.cortexxToast('PO ' + po.ref + ' approved', 'success');
    };
    const reject = async po => {
      await Backend.db.purchaseOrders.update(po.id, {
        status: 'cancelled'
      });
      window.cortexxToast && window.cortexxToast('PO ' + po.ref + ' rejected', 'info');
    };
    const order = async po => {
      await Backend.db.purchaseOrders.update(po.id, {
        status: 'ordered'
      });
      window.cortexxToast && window.cortexxToast('PO ' + po.ref + ' marked as ordered', 'success');
    };
    const TabBar = () => React.createElement('div', {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 16
      }
    }, [['approvals', 'Approvals' + (pending.length ? ' (' + pending.length + ')' : '')], ['delivery', 'Delivery'], ['suppliers', 'Suppliers'], ['stock', 'Stock']].map(([k, l]) => React.createElement('button', {
      key: k,
      onClick: () => setTab(k),
      style: {
        flex: 1,
        padding: '9px 4px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: 11.5,
        fontWeight: 700,
        background: tab === k ? acc : T.bg2,
        color: tab === k ? '#fff' : T.t2
      }
    }, l)));

    // ── Approvals ──────────────────────────────────────────────────
    const Approvals = () => React.createElement('div', null, pending.length === 0 ? React.createElement('div', {
      style: {
        textAlign: 'center',
        padding: 50,
        color: T.t2
      }
    }, React.createElement('div', {
      style: {
        fontSize: 40,
        marginBottom: 12
      }
    }, '✅'), React.createElement('div', {
      style: {
        fontWeight: 700,
        color: T.t1
      }
    }, 'No POs awaiting approval')) : pending.map(po => React.createElement('div', {
      key: po.id,
      style: card({
        marginBottom: 10
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 4
      }
    }, React.createElement('span', {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: T.t1
      }
    }, po.ref), React.createElement('span', {
      style: {
        fontSize: 16,
        fontWeight: 800,
        color: T.t1
      }
    }, money(po.total))), React.createElement('div', {
      style: {
        fontSize: 13,
        color: T.t2,
        marginBottom: 4
      }
    }, po.supplier), React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t3,
        marginBottom: 12
      }
    }, po.description || 'No description'), React.createElement('div', {
      style: {
        display: 'flex',
        gap: 8
      }
    }, React.createElement('button', {
      onClick: () => approve(po),
      style: {
        flex: 1,
        padding: 10,
        borderRadius: 9,
        background: T.green,
        border: 'none',
        color: '#fff',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer'
      }
    }, '✓ Approve'), React.createElement('button', {
      onClick: () => reject(po),
      style: {
        flex: 1,
        padding: 10,
        borderRadius: 9,
        background: 'transparent',
        border: '1px solid rgba(239,68,68,0.4)',
        color: T.red,
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer'
      }
    }, '✕ Reject')))));

    // ── Delivery tracking ──────────────────────────────────────────
    const Delivery = () => React.createElement('div', null, inTransit.length === 0 ? React.createElement('p', {
      style: {
        color: T.t2,
        fontSize: 13,
        textAlign: 'center',
        padding: 30
      }
    }, 'Nothing in transit.') : inTransit.map(po => {
      const due = po.deliveryDate ? new Date(po.deliveryDate) : null;
      const overdue = due && due < new Date();
      return React.createElement('div', {
        key: po.id,
        style: card({
          marginBottom: 10,
          borderColor: overdue ? 'rgba(239,68,68,0.4)' : T.hair
        })
      }, React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6
        }
      }, React.createElement('span', {
        style: {
          fontSize: 14,
          fontWeight: 700,
          color: T.t1
        }
      }, po.ref + ' · ' + po.supplier), React.createElement('span', {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: STATUS_COL[po.status]
        }
      }, (po.status || '').toUpperCase())), React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }
      }, React.createElement('span', {
        style: {
          fontSize: 12,
          color: overdue ? T.red : T.t3
        }
      }, (overdue ? '⚠ Overdue · ' : 'Expected ') + (po.deliveryDate || 'TBC')), React.createElement('div', {
        style: {
          display: 'flex',
          gap: 6
        }
      }, po.status === 'approved' && React.createElement('button', {
        onClick: () => order(po),
        style: {
          padding: '6px 12px',
          borderRadius: 8,
          background: T.bg2,
          border: '1px solid ' + T.hair,
          color: acc,
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer'
        }
      }, 'Mark ordered'), React.createElement('button', {
        onClick: () => window.cortexxNav && window.cortexxNav('confirmdelivery'),
        style: {
          padding: '6px 12px',
          borderRadius: 8,
          background: acc,
          border: 'none',
          color: '#fff',
          fontSize: 11.5,
          fontWeight: 700,
          cursor: 'pointer'
        }
      }, '📦 Receive'))));
    }));

    // ── Supplier scorecards ────────────────────────────────────────
    const bar = (pct, col) => React.createElement('div', {
      style: {
        flex: 1,
        height: 6,
        background: T.bg2,
        borderRadius: 3,
        overflow: 'hidden'
      }
    }, React.createElement('div', {
      style: {
        width: pct + '%',
        height: '100%',
        background: col
      }
    }));
    const Suppliers = () => React.createElement('div', null, React.createElement('div', {
      style: card({
        marginBottom: 14,
        textAlign: 'center',
        padding: 18
      })
    }, React.createElement('div', {
      style: {
        fontSize: 30,
        fontWeight: 800,
        color: acc
      }
    }, '★ ' + C.avgSupplierRating()), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'Average supplier rating')), [...scores].sort((a, b) => b.rating - a.rating).map(s => React.createElement('div', {
      key: s.id,
      style: card({
        marginBottom: 10
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
      }
    }, React.createElement('div', null, React.createElement('div', {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: T.t1
      }
    }, s.supplier), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, money(s.spend) + ' YTD · ' + s.disputes + ' disputes')), React.createElement('span', {
      style: {
        fontSize: 18,
        fontWeight: 800,
        color: s.rating >= 4.5 ? T.green : s.rating >= 4 ? '#f59e0b' : T.red
      }
    }, '★ ' + s.rating)), React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6
      }
    }, React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t3,
        width: 64
      }
    }, 'On-time'), bar(s.onTimePct, s.onTimePct >= 90 ? T.green : '#f59e0b'), React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t2,
        width: 34,
        textAlign: 'right'
      }
    }, s.onTimePct + '%')), React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t3,
        width: 64
      }
    }, 'Quality'), bar(s.qualityPct, s.qualityPct >= 95 ? T.green : '#f59e0b'), React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t2,
        width: 34,
        textAlign: 'right'
      }
    }, s.qualityPct + '%')))));

    // ── Stock levels ───────────────────────────────────────────────
    const Stock = () => React.createElement('div', null, lowStock.length > 0 && React.createElement('div', {
      style: card({
        marginBottom: 14,
        background: 'rgba(245,158,11,0.08)',
        borderColor: 'rgba(245,158,11,0.4)'
      })
    }, React.createElement('div', {
      style: {
        fontWeight: 700,
        color: T.t1,
        fontSize: 13,
        marginBottom: 4
      }
    }, '⚠ ' + lowStock.length + ' item' + (lowStock.length > 1 ? 's' : '') + ' below minimum'), React.createElement('button', {
      onClick: () => window.cortexxNav && window.cortexxNav('addpo'),
      style: {
        marginTop: 6,
        padding: '8px 14px',
        borderRadius: 8,
        background: acc,
        border: 'none',
        color: '#fff',
        fontWeight: 700,
        fontSize: 12.5,
        cursor: 'pointer'
      }
    }, 'Raise replenishment PO')), materials.length === 0 ? React.createElement('p', {
      style: {
        color: T.t2,
        fontSize: 13,
        textAlign: 'center',
        padding: 30
      }
    }, 'No materials tracked.') : materials.map(m => {
      const low = Number(m.stock) < Number(m.min || 0);
      const pct = Math.min(100, Number(m.stock) / (Number(m.min || 1) * 2) * 100);
      return React.createElement('div', {
        key: m.id,
        style: {
          padding: '12px 14px',
          background: T.bg1,
          border: '1px solid ' + (low ? 'rgba(245,158,11,0.4)' : T.hair),
          borderRadius: 10,
          marginBottom: 8
        }
      }, React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 6
        }
      }, React.createElement('span', {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: T.t1
        }
      }, m.name), React.createElement('span', {
        style: {
          fontSize: 12,
          color: low ? '#f59e0b' : T.t2,
          fontWeight: 700
        }
      }, m.stock + ' ' + (m.unit || '') + (low ? ' · LOW' : ''))), React.createElement('div', {
        style: {
          height: 6,
          background: T.bg2,
          borderRadius: 3,
          overflow: 'hidden'
        }
      }, React.createElement('div', {
        style: {
          width: pct + '%',
          height: '100%',
          background: low ? '#f59e0b' : T.green
        }
      })), React.createElement('div', {
        style: {
          fontSize: 10,
          color: T.t3,
          marginTop: 4
        }
      }, 'Min ' + (m.min || 0) + ' ' + (m.unit || '')));
    }));
    return React.createElement('div', {
      style: {
        height: '100%',
        overflowY: 'auto',
        padding: '12px 16px 120px'
      }
    }, React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        marginBottom: 14
      }
    }, React.createElement('div', {
      style: card({
        padding: 12
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: pending.length ? '#f59e0b' : T.green
      }
    }, pending.length), React.createElement('div', {
      style: {
        fontSize: 10,
        color: T.t3
      }
    }, 'To approve')), React.createElement('div', {
      style: card({
        padding: 12
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: acc
      }
    }, inTransit.length), React.createElement('div', {
      style: {
        fontSize: 10,
        color: T.t3
      }
    }, 'In transit')), React.createElement('div', {
      style: card({
        padding: 12
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: lowStock.length ? '#f59e0b' : T.green
      }
    }, lowStock.length), React.createElement('div', {
      style: {
        fontSize: 10,
        color: T.t3
      }
    }, 'Low stock'))), React.createElement(TabBar), tab === 'approvals' && React.createElement(Approvals), tab === 'delivery' && React.createElement(Delivery), tab === 'suppliers' && React.createElement(Suppliers), tab === 'stock' && React.createElement(Stock));
  };
})();