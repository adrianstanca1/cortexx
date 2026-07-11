(function () {
  if (!window.Backend || Backend._auditWrapped) return;
  Backend._auditWrapped = true;
  const hash = s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  };
  const writeEntry = (what, where, color, icon) => {
    try {
      const t = Backend.db.auditLog;
      if (!t) return;
      const all = t.listSync();
      const prev = all[0]?.sig || '0';
      const when = new Date().toISOString().slice(0, 16);
      const who = Backend.db.user?.get?.()?.name || 'You';
      const sig = hash(`${prev}|${who}|${what}|${where}|${when}`);
      t.create({
        who,
        what,
        where,
        when,
        sig,
        prev,
        icon,
        color
      });
    } catch (e) {}
  };
  const phraseFor = (table, op, before, after) => {
    const id = after?.id ?? before?.id;
    const colors = {
      create: '#10b981',
      update: '#2563eb',
      remove: '#ef4444'
    };
    const icons = {
      create: 'plus',
      update: 'edit',
      remove: 'trash'
    };
    const verb = op === 'create' ? 'added' : op === 'update' ? 'updated' : 'removed';
    let where = table;
    try {
      const projId = after?.projectId ?? before?.projectId;
      if (projId) {
        const proj = Backend.db.projects?.listSync?.()?.find(p => p.id == projId);
        if (proj) where = proj.name;
      }
    } catch (e) {}
    const friendlyTable = {
      tasks: 'task',
      projects: 'project',
      customers: 'customer',
      quotes: 'quote',
      invoices: 'invoice',
      receipts: 'receipt',
      timesheets: 'timesheet',
      team: 'team member',
      subs: 'subcontractor',
      documents: 'document',
      incidents: 'incident',
      holidays: 'leave',
      claims: 'insurance claim',
      improvements: 'improvement',
      mileage: 'mileage trip',
      clockEntries: 'clock entry',
      tags: 'tag',
      savedViews: 'saved view',
      templates: 'template',
      costItems: 'cost item',
      rfis: 'RFI',
      snags: 'snag',
      messages: 'message',
      purchaseOrders: 'PO'
    };
    const noun = friendlyTable[table] || table;
    const refId = id != null ? ` #${String(id).padStart(3, '0')}` : '';
    const title = (after?.title || after?.name || after?.n || after?.t || after?.id || '').toString().slice(0, 40);
    const titleStr = title ? ` "${title}"` : '';
    return {
      what: `${verb} ${noun}${refId}${titleStr}`,
      where,
      color: colors[op],
      icon: icons[op]
    };
  };
  const skipTables = new Set(['user', 'settings', 'activity', 'auditLog', 'docGens', 'computed', 'aiHistory']);
  function wrapTable(name, tbl) {
    if (!tbl || tbl._audited || skipTables.has(name)) return;
    tbl._audited = true;
    const origC = tbl.create,
      origU = tbl.update,
      origR = tbl.remove;
    if (origC) tbl.create = async d => {
      const r = await origC.call(tbl, d);
      const {
        what,
        where,
        color,
        icon
      } = phraseFor(name, 'create', null, d);
      writeEntry(what, where, color, icon);
      return r;
    };
    if (origU) tbl.update = async (id, p) => {
      const before = tbl.listSync ? tbl.listSync().find(x => x.id == id) : null;
      const r = await origU.call(tbl, id, p);
      const {
        what,
        where,
        color,
        icon
      } = phraseFor(name, 'update', before, {
        id,
        ...p
      });
      writeEntry(what, where, color, icon);
      return r;
    };
    if (origR) tbl.remove = async id => {
      const before = tbl.listSync ? tbl.listSync().find(x => x.id == id) : null;
      const r = await origR.call(tbl, id);
      const {
        what,
        where,
        color,
        icon
      } = phraseFor(name, 'remove', before, null);
      writeEntry(what, where, color, icon);
      return r;
    };
  }
  Object.entries(Backend.db).forEach(([name, tbl]) => {
    if (tbl && typeof tbl === 'object' && (tbl.create || tbl.update || tbl.remove)) {
      wrapTable(name, tbl);
    }
  });
  const origTable = Backend.db.table;
  if (origTable) {
    Backend.db.table = (name, opts) => {
      const t = origTable(name, opts);
      wrapTable(name, t);
      return t;
    };
  }
})();
(function () {
  if (!window.Backend) return;
  const s = Backend.db.snapshot();
  if (!s.snags) {
    s.snags = [];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
    } catch (e) {}
  }
  if (!Backend.db.snags && Backend.db.table) Backend.db.snags = Backend.db.table('snags');
})();
function PhotoToSnagSheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [stage, setStage] = React.useState('pick');
  const [blob, setBlob] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState(null);
  const [result, setResult] = React.useState(null);
  const [picked, setPicked] = React.useState(new Set());
  const [projectId, setProjectId] = React.useState(projects.find(p => p.status === 'active')?.id || projects[0]?.id || 1);
  const [err, setErr] = React.useState('');
  const fileRef = React.useRef(null);
  const pick = () => fileRef.current?.click();
  const onFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBlob(f);
    setPreviewUrl(URL.createObjectURL(f));
    setStage('scanning');
    setErr('');
    setPicked(new Set());
    try {
      const r = await Backend.vision.detectSnagsInPhoto(f);
      if (!r || !r.snags) throw new Error('No data');
      setResult(r);
      setPicked(new Set((r.snags || []).map((_, i) => i)));
      setStage('review');
    } catch (e) {
      setErr(e.message || String(e));
      setStage('pick');
    }
  };
  const toggle = i => {
    const next = new Set(picked);
    if (next.has(i)) next.delete(i);else next.add(i);
    setPicked(next);
  };
  const fileSelected = async () => {
    if (!result?.snags?.length) return;
    let photoId = null;
    if (blob && window.cortexxPhotoStore) {
      try {
        photoId = await window.cortexxPhotoStore.save(blob, {
          name: `snag_evidence.jpg`,
          projectId,
          tags: ['snag', 'evidence']
        });
      } catch (e) {}
    }
    const items = result.snags.filter((_, i) => picked.has(i));
    for (const sn of items) {
      await Backend.db.snags.create({
        description: sn.title,
        area: sn.area || '',
        priority: sn.priority || 'med',
        status: 'open',
        projectId: parseInt(projectId),
        raised: new Date().toISOString().slice(0, 10),
        photoId,
        source: 'photo-vision'
      });
    }
    toast(`${items.length} snag${items.length !== 1 ? 's' : ''} filed`, 'success');
    onClose();
  };
  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const priColor = p => p === 'high' ? T.red : p === 'med' ? T.amber : T.t3;
  return React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/*",
    capture: "environment",
    onChange: onFile,
    style: {
      display: 'none'
    }
  }), React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer'
    }
  }, "Close"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1
    }
  }, "Photo \u2192 Snag"), React.createElement("div", {
    style: {
      width: 50
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '14px 16px 24px'
    }
  }, stage === 'pick' && React.createElement(React.Fragment, null, React.createElement("button", {
    onClick: pick,
    style: {
      width: '100%',
      aspectRatio: '4 / 3',
      background: T.bg2,
      border: `1.5px dashed ${T.hairStrong}`,
      borderRadius: 14,
      color: T.t1,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12
    }
  }, React.createElement("div", {
    style: {
      width: 64,
      height: 64,
      borderRadius: 16,
      background: `${T.amber}22`,
      color: T.amber,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.alert, {
    size: 32
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700
    }
  }, "Photograph the defect"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      textAlign: 'center',
      lineHeight: 1.5,
      padding: '0 30px'
    }
  }, "Cortex vision will list every defect it can see \u2014 cracked tiles, paint runs, gaps, alignment issues \u2014 and file each as a separate snag.")), err && React.createElement("div", {
    style: {
      marginTop: 12,
      padding: 10,
      background: `${T.red}1a`,
      border: `0.5px solid ${T.red}55`,
      borderRadius: 10,
      fontFamily: SF,
      fontSize: 12,
      color: T.red
    }
  }, err)), stage === 'scanning' && previewUrl && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 14,
      background: '#000'
    }
  }, React.createElement("img", {
    src: previewUrl,
    style: {
      width: '100%',
      maxHeight: 280,
      objectFit: 'cover',
      display: 'block',
      opacity: 0.55
    }
  }), React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 12,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'pulse77 1.4s infinite'
    }
  }, React.cloneElement(Ic.spark, {
    size: 26
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: '#fff',
      fontWeight: 600
    }
  }, "Scanning for defects\u2026"))), React.createElement(ShimmerRows, {
    color: T.purple,
    rows: 3
  })), stage === 'review' && result && React.createElement(React.Fragment, null, previewUrl && React.createElement("div", {
    style: {
      borderRadius: 12,
      overflow: 'hidden',
      marginBottom: 12,
      maxHeight: 180,
      background: '#000'
    }
  }, React.createElement("img", {
    src: previewUrl,
    style: {
      width: '100%',
      maxHeight: 180,
      objectFit: 'cover',
      display: 'block'
    }
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.45,
      marginBottom: 14
    }
  }, result.summary || 'Defects detected:'), result.snags.length === 0 && React.createElement("div", {
    style: {
      padding: 28,
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "Nothing to file \u2014 this looks clean \u2713"), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 7
    }
  }, result.snags.map((sn, i) => {
    const sel = picked.has(i);
    return React.createElement("div", {
      key: i,
      onClick: () => toggle(i),
      style: {
        background: sel ? `${accent}14` : T.bg2,
        border: `0.5px solid ${sel ? accent : T.hair}`,
        borderRadius: 12,
        padding: '11px 13px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10
      }
    }, React.createElement("div", {
      style: {
        width: 20,
        height: 20,
        borderRadius: 4,
        flexShrink: 0,
        marginTop: 1,
        border: `1.5px solid ${sel ? accent : T.hairMid}`,
        background: sel ? accent : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, sel && React.createElement("span", {
      style: {
        color: '#fff'
      }
    }, React.cloneElement(Ic.check, {
      size: 12,
      sw: 3
    }))), React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2
      }
    }, React.createElement(Pill, {
      c: priColor(sn.priority),
      size: "xs"
    }, sn.priority), sn.area && React.createElement("span", {
      style: {
        fontFamily: SF,
        fontSize: 10.5,
        color: T.t3
      }
    }, sn.area)), React.createElement("div", {
      style: {
        fontFamily: SF,
        fontSize: 13.5,
        color: T.t1,
        lineHeight: 1.35
      }
    }, sn.title)));
  })), result.snags.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      marginTop: 16,
      fontFamily: SF,
      fontSize: 10.5,
      color: T.t3,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 6
    }
  }, "Project"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 4
    }
  }, projects.filter(p => p.status !== 'completed').map(p => React.createElement("button", {
    key: p.id,
    onClick: () => setProjectId(p.id),
    style: {
      padding: '7px 12px',
      borderRadius: 14,
      flexShrink: 0,
      border: `0.5px solid ${projectId === p.id ? accent : T.hair}`,
      background: projectId === p.id ? `${accent}22` : T.bg2,
      color: projectId === p.id ? accent : T.t2,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      cursor: 'pointer'
    }
  }, p.name))), React.createElement("button", {
    onClick: fileSelected,
    disabled: picked.size === 0,
    style: {
      marginTop: 16,
      width: '100%',
      padding: '13px',
      background: picked.size === 0 ? T.bg3 : `linear-gradient(135deg, ${accent}, ${accent}cc)`,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: picked.size === 0 ? 'default' : 'pointer',
      opacity: picked.size === 0 ? 0.5 : 1,
      boxShadow: picked.size === 0 ? 'none' : `0 6px 18px ${accent}44`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7
    }
  }, React.cloneElement(Ic.check, {
    size: 15
  }), "File ", picked.size, " snag", picked.size !== 1 ? 's' : ''), React.createElement("button", {
    onClick: pick,
    style: {
      marginTop: 8,
      width: '100%',
      padding: '11px',
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Re-scan with different photo")))));
}
Object.assign(window, {
  PhotoToSnagSheet
});