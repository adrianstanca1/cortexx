// CortexBuild Pro — Phase 118: Client Experience
// ClientExperienceScreen — live progress feed, variation approvals, and
// satisfaction / NPS scoring. Wired to progressFeed, changeOrders, and
// satisfaction tables.

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
  window.ClientExperienceScreen = function ({
    accent
  }) {
    const projects = window.useDB('projects');
    const feed = window.useDB('progressFeed');
    const changes = window.useDB('changeOrders');
    const satisfaction = window.useDB('satisfaction');
    const [tab, setTab] = React.useState('feed');
    const acc = accent || T.blue;
    const C = Backend.computed;
    const projName = id => (projects.find(p => p.id == id) || {}).name || '—';
    const pendingChanges = changes.filter(c => c.status === 'pending' || c.status === 'submitted');
    const avgSat = C.avgSatisfaction();
    const nps = C.npsScore();
    const TabBar = () => React.createElement('div', {
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 16
      }
    }, [['feed', 'Progress feed'], ['variations', 'Variations' + (pendingChanges.length ? ' (' + pendingChanges.length + ')' : '')], ['satisfaction', 'Satisfaction']].map(([k, l]) => React.createElement('button', {
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

    // ── Live progress feed ─────────────────────────────────────────
    const Feed = () => React.createElement('div', null, React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t2,
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, React.createElement('span', {
      style: {
        width: 8,
        height: 8,
        borderRadius: 4,
        background: T.green,
        display: 'inline-block'
      }
    }), 'This feed is what your clients see in their branded portal'), feed.length === 0 ? React.createElement('p', {
      style: {
        color: T.t2,
        fontSize: 13,
        textAlign: 'center',
        padding: 30
      }
    }, 'No updates posted yet.') : feed.sort((a, b) => new Date(b.when) - new Date(a.when)).map((f, i) => React.createElement('div', {
      key: f.id,
      style: {
        display: 'flex',
        gap: 12,
        marginBottom: 4
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }
    }, React.createElement('div', {
      style: {
        width: 12,
        height: 12,
        borderRadius: 6,
        background: acc,
        marginTop: 4
      }
    }), i < feed.length - 1 && React.createElement('div', {
      style: {
        width: 2,
        flex: 1,
        background: T.hair,
        minHeight: 30
      }
    })), React.createElement('div', {
      style: {
        flex: 1,
        paddingBottom: 16
      }
    }, React.createElement('div', {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: T.t1
      }
    }, f.title), React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t2,
        margin: '2px 0 4px'
      }
    }, f.body), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, projName(f.projectId) + ' · ' + f.when + (f.clientVisible ? ' · 👁 visible to client' : ' · 🔒 internal'))))), React.createElement('button', {
      onClick: () => window.cortexxNav && window.cortexxNav('postupdate'),
      style: {
        marginTop: 6,
        width: '100%',
        padding: 13,
        borderRadius: 12,
        background: acc,
        color: '#fff',
        border: 'none',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer'
      }
    }, '+ Post progress update'));

    // ── Variation approvals ────────────────────────────────────────
    const Variations = () => React.createElement('div', null, changes.length === 0 ? React.createElement('p', {
      style: {
        color: T.t2,
        fontSize: 13,
        textAlign: 'center',
        padding: 30
      }
    }, 'No variations raised.') : changes.map(c => {
      const status = c.status || 'pending';
      const col = status === 'approved' ? T.green : status === 'rejected' ? T.red : '#f59e0b';
      return React.createElement('div', {
        key: c.id,
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
          fontWeight: 700,
          color: T.t1
        }
      }, c.ref || c.title || 'Variation'), React.createElement('span', {
        style: {
          fontSize: 15,
          fontWeight: 800,
          color: T.t1
        }
      }, money(c.value || c.amount || 0))), React.createElement('div', {
        style: {
          fontSize: 12,
          color: T.t2,
          marginBottom: 4
        }
      }, c.desc || c.description || c.title || ''), React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8
        }
      }, React.createElement('span', {
        style: {
          fontSize: 11,
          color: T.t3
        }
      }, projName(c.projectId)), React.createElement('span', {
        style: {
          fontSize: 11,
          fontWeight: 700,
          color: col
        }
      }, status.toUpperCase())), (status === 'pending' || status === 'submitted') && React.createElement('div', {
        style: {
          display: 'flex',
          gap: 8,
          marginTop: 10
        }
      }, React.createElement('button', {
        onClick: async () => {
          await Backend.db.changeOrders.update(c.id, {
            status: 'approved'
          });
          window.cortexxToast && window.cortexxToast('Variation approved', 'success');
        },
        style: {
          flex: 1,
          padding: 9,
          borderRadius: 9,
          background: T.green,
          border: 'none',
          color: '#fff',
          fontWeight: 700,
          fontSize: 12.5,
          cursor: 'pointer'
        }
      }, '✓ Client approved'), React.createElement('button', {
        onClick: async () => {
          await Backend.db.changeOrders.update(c.id, {
            status: 'rejected'
          });
          window.cortexxToast && window.cortexxToast('Variation rejected', 'info');
        },
        style: {
          flex: 1,
          padding: 9,
          borderRadius: 9,
          background: 'transparent',
          border: '1px solid rgba(239,68,68,0.4)',
          color: T.red,
          fontWeight: 700,
          fontSize: 12.5,
          cursor: 'pointer'
        }
      }, '✕ Rejected')));
    }));

    // ── Satisfaction / NPS ─────────────────────────────────────────
    const Satisfaction = () => React.createElement('div', null, React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        marginBottom: 14
      }
    }, React.createElement('div', {
      style: card({
        padding: 18,
        textAlign: 'center'
      })
    }, React.createElement('div', {
      style: {
        fontSize: 32,
        fontWeight: 800,
        color: Number(avgSat) >= 8 ? T.green : Number(avgSat) >= 6 ? '#f59e0b' : T.red
      }
    }, avgSat), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'Avg satisfaction / 10')), React.createElement('div', {
      style: card({
        padding: 18,
        textAlign: 'center'
      })
    }, React.createElement('div', {
      style: {
        fontSize: 32,
        fontWeight: 800,
        color: nps >= 50 ? T.green : nps >= 0 ? '#f59e0b' : T.red
      }
    }, (nps > 0 ? '+' : '') + nps), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, 'NPS score'))), satisfaction.length === 0 ? React.createElement('p', {
      style: {
        color: T.t2,
        fontSize: 13,
        textAlign: 'center',
        padding: 30
      }
    }, 'No surveys completed yet.') : satisfaction.sort((a, b) => new Date(b.surveyedOn) - new Date(a.surveyedOn)).map(s => React.createElement('div', {
      key: s.id,
      style: card({
        marginBottom: 10
      })
    }, React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
      }
    }, React.createElement('div', null, React.createElement('div', {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: T.t1
      }
    }, s.client), React.createElement('div', {
      style: {
        fontSize: 11,
        color: T.t3
      }
    }, projName(s.projectId) + ' · ' + s.surveyedOn)), React.createElement('span', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: s.score >= 9 ? T.green : s.score >= 7 ? '#f59e0b' : T.red
      }
    }, s.score + '/10')), s.comment && React.createElement('div', {
      style: {
        fontSize: 12,
        color: T.t2,
        fontStyle: 'italic',
        lineHeight: 1.5,
        paddingTop: 6,
        borderTop: '1px solid ' + T.hair
      }
    }, '"' + s.comment + '"'))), React.createElement('button', {
      onClick: () => window.cortexxNav && window.cortexxNav('requestsurvey'),
      style: {
        marginTop: 6,
        width: '100%',
        padding: 13,
        borderRadius: 12,
        background: T.bg2,
        border: '1px dashed ' + T.hair,
        color: acc,
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer'
      }
    }, '+ Request client survey'));
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
        color: acc
      }
    }, avgSat), React.createElement('div', {
      style: {
        fontSize: 10,
        color: T.t3
      }
    }, 'Satisfaction')), React.createElement('div', {
      style: card({
        padding: 12
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: nps >= 0 ? T.green : T.red
      }
    }, (nps > 0 ? '+' : '') + nps), React.createElement('div', {
      style: {
        fontSize: 10,
        color: T.t3
      }
    }, 'NPS')), React.createElement('div', {
      style: card({
        padding: 12,
        borderColor: pendingChanges.length ? 'rgba(245,158,11,0.4)' : T.hair
      })
    }, React.createElement('div', {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: pendingChanges.length ? '#f59e0b' : T.green
      }
    }, pendingChanges.length), React.createElement('div', {
      style: {
        fontSize: 10,
        color: T.t3
      }
    }, 'Pending'))), React.createElement(TabBar), tab === 'feed' && React.createElement(Feed), tab === 'variations' && React.createElement(Variations), tab === 'satisfaction' && React.createElement(Satisfaction));
  };

  // ── Post progress update sheet ───────────────────────────────────
  window.PostUpdateSheet = function ({
    onClose,
    accent
  }) {
    const projects = window.useDB('projects');
    const [form, setForm] = React.useState({
      projectId: (projects[0] || {}).id || '',
      title: '',
      body: '',
      clientVisible: true
    });
    const [saving, setSaving] = React.useState(false);
    const set = (k, v) => setForm(f => ({
      ...f,
      [k]: v
    }));
    const inp = {
      width: '100%',
      padding: '10px 12px',
      borderRadius: 10,
      background: T.bg2,
      border: '1px solid ' + T.hair,
      color: T.t1,
      fontSize: 15,
      boxSizing: 'border-box',
      outline: 'none'
    };
    const Field = ({
      label,
      children
    }) => React.createElement('div', {
      style: {
        marginBottom: 16
      }
    }, React.createElement('div', {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: T.t3,
        letterSpacing: '0.08em',
        marginBottom: 6,
        textTransform: 'uppercase'
      }
    }, label), children);
    const save = async () => {
      if (!form.title) return;
      setSaving(true);
      await Backend.db.progressFeed.create({
        projectId: parseInt(form.projectId) || form.projectId,
        title: form.title,
        body: form.body,
        when: new Date().toISOString().slice(0, 10),
        clientVisible: form.clientVisible,
        photo: null
      });
      window.cortexxToast && window.cortexxToast('Update posted to client feed', 'success');
      onClose();
    };
    return React.createElement('div', {
      style: {
        position: 'fixed',
        inset: 0,
        background: T.bg1,
        zIndex: 1100,
        overflowY: 'auto',
        paddingBottom: 100
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '20px 20px 0'
      }
    }, React.createElement('button', {
      onClick: onClose,
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: T.bg2,
        border: 'none',
        color: T.t1,
        fontSize: 20,
        cursor: 'pointer'
      }
    }, '←'), React.createElement('h2', {
      style: {
        color: T.t1,
        fontSize: 18,
        fontWeight: 800,
        margin: 0,
        flex: 1
      }
    }, 'Post Update'), React.createElement('button', {
      onClick: save,
      disabled: saving,
      style: {
        padding: '8px 18px',
        borderRadius: 10,
        background: accent || T.blue,
        color: '#fff',
        border: 'none',
        fontWeight: 700,
        fontSize: 14,
        cursor: 'pointer',
        opacity: saving ? 0.6 : 1
      }
    }, saving ? 'Posting…' : 'Post')), React.createElement('div', {
      style: {
        padding: '20px 20px 0'
      }
    }, React.createElement(Field, {
      label: 'Project'
    }, React.createElement('select', {
      style: inp,
      value: form.projectId,
      onChange: e => set('projectId', e.target.value)
    }, projects.map(p => React.createElement('option', {
      key: p.id,
      value: p.id
    }, p.name)))), React.createElement(Field, {
      label: 'Headline'
    }, React.createElement('input', {
      style: inp,
      placeholder: 'e.g. Roof structure complete',
      value: form.title,
      onChange: e => set('title', e.target.value)
    })), React.createElement(Field, {
      label: 'Detail'
    }, React.createElement('textarea', {
      style: {
        ...inp,
        minHeight: 90,
        resize: 'vertical'
      },
      placeholder: 'What progress has been made?',
      value: form.body,
      onChange: e => set('body', e.target.value)
    })), React.createElement('label', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        color: T.t1,
        fontSize: 14,
        cursor: 'pointer'
      }
    }, React.createElement('input', {
      type: 'checkbox',
      checked: form.clientVisible,
      onChange: e => set('clientVisible', e.target.checked)
    }), 'Visible to client in portal')));
  };
})();