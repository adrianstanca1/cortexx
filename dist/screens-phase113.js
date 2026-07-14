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
  const moneyK = n => {
    n = Number(n) || 0;
    return Math.abs(n) >= 1000 ? '£' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k' : '£' + Math.round(n);
  };
  window.FinancialIntelligenceScreen = function ({
    accent
  }) {
    const projects = window.useDB('projects');
    window.useDB('invoices');
    window.useDB('receipts');
    window.useDB('timesheets');
    window.useDB('purchaseOrders');
    const [tab, setTab] = React.useState('cashflow');
    const acc = accent || T.blue;
    const C = Backend.computed;
    const forecast = C.cashflowForecast(8);
    const alerts = C.marginAlerts(15);
    const wip = C.wipValue();
    const maxFlow = Math.max(1, ...forecast.map(f => Math.max(f.inflow, f.outflow)));
    let running = 0;
    const cumulative = forecast.map(f => {
      running += f.net;
      return running;
    });
    const TabBar = () => React.createElement('div', {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 16
      }
    }, [['cashflow', 'Cashflow'], ['pnl', 'P&L'], ['wip', 'WIP'], ['alerts', 'Alerts' + (alerts.length ? ' (' + alerts.length + ')' : '')]].map(([k, l]) => React.createElement('button', {
      key: k,
      onClick: () => setTab(k),
      style: {
        flex: 1,
        padding: '9px 0',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontSize: 12.5,
        fontWeight: 700,
        background: tab === k ? acc : T.bg2,
        color: tab === k ? '#fff' : T.t2
      }
    }, l)));
    const Cashflow = () => React.createElement('div', null, React.createElement('div', {
      style: card({
        marginBottom: 14
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 4
      }
    }, React.createElement('span', {
      style: {
        fontSize: 12,
        color: T.t3,
        fontWeight: 700
      }
    }, '8-WEEK NET POSITION'), React.createElement('span', {
      style: {
        fontSize: 12,
        color: cumulative[cumulative.length - 1] >= 0 ? T.green : T.red,
        fontWeight: 700
      }
    }, (cumulative[cumulative.length - 1] >= 0 ? '+' : '') + money(cumulative[cumulative.length - 1]))), React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 6,
        height: 130,
        marginTop: 14,
        paddingTop: 10
      }
    }, forecast.map((f, i) => React.createElement('div', {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        gap: 2,
        height: 100
      }
    }, React.createElement('div', {
      title: 'In ' + money(f.inflow),
      style: {
        width: 8,
        height: f.inflow / maxFlow * 100 + '%',
        background: T.green,
        borderRadius: '3px 3px 0 0',
        minHeight: 2
      }
    }), React.createElement('div', {
      title: 'Out ' + money(f.outflow),
      style: {
        width: 8,
        height: f.outflow / maxFlow * 100 + '%',
        background: T.red,
        borderRadius: '3px 3px 0 0',
        minHeight: 2
      }
    })), React.createElement('span', {
      style: {
        fontSize: 8,
        color: T.t3
      }
    }, 'W' + (i + 1))))), React.createElement('div', {
      style: {
        display: 'flex',
        gap: 16,
        marginTop: 12,
        justifyContent: 'center'
      }
    }, React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t2
      }
    }, React.createElement('span', {
      style: {
        color: T.green
      }
    }, '● '), 'Inflow'), React.createElement('span', {
      style: {
        fontSize: 11,
        color: T.t2
      }
    }, React.createElement('span', {
      style: {
        color: T.red
      }
    }, '● '), 'Outflow'))), forecast.map((f, i) => React.createElement('div', {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: T.bg1,
        border: '1px solid ' + T.hair,
        borderRadius: 10,
        marginBottom: 6
      }
    }, React.createElement('span', {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: T.t1,
        width: 50
      }
    }, f.label), React.createElement('span', {
      style: {
        fontSize: 12,
        color: T.green
      }
    }, '+' + moneyK(f.inflow)), React.createElement('span', {
      style: {
        fontSize: 12,
        color: T.red
      }
    }, '−' + moneyK(f.outflow)), React.createElement('span', {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: f.net >= 0 ? T.green : T.red,
        width: 70,
        textAlign: 'right'
      }
    }, (f.net >= 0 ? '+' : '') + moneyK(f.net)))));
    const PnL = () => React.createElement('div', null, projects.map(p => {
      const pl = C.projectPnL(p.id);
      if (pl.revenue === 0 && pl.cost === 0) return null;
      return React.createElement('div', {
        key: p.id,
        style: card({
          marginBottom: 12
        })
      }, React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12
        }
      }, React.createElement('div', null, React.createElement('div', {
        style: {
          fontSize: 15,
          fontWeight: 800,
          color: T.t1
        }
      }, p.name), React.createElement('div', {
        style: {
          fontSize: 11,
          color: T.t3
        }
      }, p.client || '')), React.createElement('span', {
        style: {
          fontSize: 20,
          fontWeight: 800,
          color: pl.marginPct >= 20 ? T.green : pl.marginPct >= 10 ? '#f59e0b' : T.red
        }
      }, pl.marginPct + '%')), React.createElement('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          marginBottom: 10
        }
      }, [['Revenue', pl.revenue, T.t1], ['Cost', pl.cost, T.t2], ['Profit', pl.profit, pl.profit >= 0 ? T.green : T.red]].map(([l, v, c]) => React.createElement('div', {
        key: l,
        style: {
          background: T.bg2,
          borderRadius: 8,
          padding: '8px 10px'
        }
      }, React.createElement('div', {
        style: {
          fontSize: 10,
          color: T.t3,
          textTransform: 'uppercase',
          fontWeight: 700
        }
      }, l), React.createElement('div', {
        style: {
          fontSize: 14,
          fontWeight: 800,
          color: c
        }
      }, moneyK(v))))), React.createElement('div', {
        style: {
          display: 'flex',
          height: 8,
          borderRadius: 5,
          overflow: 'hidden',
          background: T.bg2
        }
      }, pl.cost > 0 && React.createElement('div', {
        style: {
          width: pl.labour / pl.cost * 100 + '%',
          background: '#8b5cf6'
        },
        title: 'Labour ' + money(pl.labour)
      }), pl.cost > 0 && React.createElement('div', {
        style: {
          width: pl.materials / pl.cost * 100 + '%',
          background: '#3b82f6'
        },
        title: 'Materials ' + money(pl.materials)
      })), React.createElement('div', {
        style: {
          display: 'flex',
          gap: 14,
          marginTop: 6
        }
      }, React.createElement('span', {
        style: {
          fontSize: 10,
          color: T.t3
        }
      }, React.createElement('span', {
        style: {
          color: '#8b5cf6'
        }
      }, '● '), 'Labour ' + moneyK(pl.labour)), React.createElement('span', {
        style: {
          fontSize: 10,
          color: T.t3
        }
      }, React.createElement('span', {
        style: {
          color: '#3b82f6'
        }
      }, '● '), 'Materials ' + moneyK(pl.materials))));
    }));
    const WIP = () => React.createElement('div', null, React.createElement('div', {
      style: card({
        marginBottom: 14,
        textAlign: 'center',
        padding: 24
      })
    }, React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t3,
        fontWeight: 700,
        marginBottom: 6
      }
    }, 'TOTAL WORK-IN-PROGRESS'), React.createElement('div', {
      style: {
        fontSize: 38,
        fontWeight: 800,
        color: acc
      }
    }, money(wip)), React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t2,
        marginTop: 6
      }
    }, 'Value of work done but not yet certified / invoiced')), projects.map(p => {
      const pct = Number(p.pct) || 0;
      const contract = Number(p.value || p.contract || 0);
      if (!contract) return null;
      const earned = contract * pct / 100;
      return React.createElement('div', {
        key: p.id,
        style: {
          padding: '12px 14px',
          background: T.bg1,
          border: '1px solid ' + T.hair,
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
      }, p.name), React.createElement('span', {
        style: {
          fontSize: 12,
          color: T.t2
        }
      }, pct + '% · ' + moneyK(earned))), React.createElement('div', {
        style: {
          height: 6,
          background: T.bg2,
          borderRadius: 4,
          overflow: 'hidden'
        }
      }, React.createElement('div', {
        style: {
          width: pct + '%',
          height: '100%',
          background: acc
        }
      })));
    }));
    const Alerts = () => React.createElement('div', null, alerts.length === 0 ? React.createElement('div', {
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
    }, 'All projects above 15% margin'), React.createElement('div', {
      style: {
        fontSize: 13,
        marginTop: 4
      }
    }, 'No margin erosion detected.')) : alerts.map(({
      project,
      pnl
    }) => React.createElement('div', {
      key: project.id,
      style: card({
        marginBottom: 10,
        borderColor: pnl.marginPct < 5 ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)',
        background: pnl.marginPct < 5 ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)'
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6
      }
    }, React.createElement('span', {
      style: {
        fontSize: 18
      }
    }, pnl.marginPct < 5 ? '🚨' : '⚠️'), React.createElement('span', {
      style: {
        fontWeight: 800,
        color: T.t1,
        fontSize: 14,
        flex: 1
      }
    }, project.name), React.createElement('span', {
      style: {
        fontSize: 18,
        fontWeight: 800,
        color: pnl.marginPct < 5 ? T.red : '#f59e0b'
      }
    }, pnl.marginPct + '%')), React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t2
      }
    }, 'Revenue ' + moneyK(pnl.revenue) + ' · Cost ' + moneyK(pnl.cost) + ' · Profit ' + moneyK(pnl.profit)), React.createElement('button', {
      onClick: () => window.cortexxNav && window.cortexxNav('project', project),
      style: {
        marginTop: 10,
        width: '100%',
        padding: 9,
        borderRadius: 9,
        background: T.bg2,
        border: '1px solid ' + T.hair,
        color: acc,
        fontWeight: 700,
        fontSize: 12.5,
        cursor: 'pointer'
      }
    }, 'Review project →'))));
    return React.createElement('div', {
      style: {
        height: '100%',
        overflowY: 'auto',
        padding: '12px 16px 120px'
      }
    }, React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 14
      }
    }, React.createElement('div', {
      style: card({
        padding: 14
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: acc
      }
    }, moneyK(wip)), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'Work in progress')), React.createElement('div', {
      style: card({
        padding: 14,
        borderColor: alerts.length ? 'rgba(245,158,11,0.4)' : T.hair
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: alerts.length ? '#f59e0b' : T.green
      }
    }, alerts.length), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'Margin alerts'))), React.createElement(TabBar), tab === 'cashflow' && React.createElement(Cashflow), tab === 'pnl' && React.createElement(PnL), tab === 'wip' && React.createElement(WIP), tab === 'alerts' && React.createElement(Alerts));
  };
})();