(function () {
  if (window.CortexTenant) return;
  const TKEY = 'cortexx_active_tenant';
  const LIST_KEY = 'cortexx_tenants';
  const defaults = [{
    id: 'cortexbuild',
    name: 'CortexBuild Ltd',
    plan: 'Pro',
    role: 'Director',
    color: '#2563eb'
  }, {
    id: 'camden-joinery',
    name: 'Camden Joinery',
    plan: 'Free',
    role: 'Co-owner',
    color: '#f59e0b'
  }, {
    id: 'hackney-refurb',
    name: 'Hackney Refurb',
    plan: 'Free',
    role: 'Contractor',
    color: '#10b981'
  }];
  function loadTenants() {
    try {
      const r = localStorage.getItem(LIST_KEY);
      if (r) return JSON.parse(r);
    } catch (e) {}
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify(defaults));
    } catch (e) {}
    return defaults;
  }
  window.CortexTenant = {
    list() {
      return loadTenants();
    },
    active() {
      try {
        return localStorage.getItem(TKEY) || 'cortexbuild';
      } catch (e) {
        return 'cortexbuild';
      }
    },
    activeRecord() {
      return this.list().find(t => t.id === this.active()) || this.list()[0];
    },
    dbKey() {
      return 'cortexx_db_v1__' + this.active();
    },
    photoDb() {
      return 'cortexx_photos__' + this.active();
    },
    switch(id) {
      try {
        localStorage.setItem(TKEY, id);
      } catch (e) {}
      setTimeout(() => location.reload(), 350);
    },
    create(name) {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24) + '-' + Date.now().toString(36).slice(-4);
      const tenants = this.list();
      tenants.push({
        id,
        name,
        plan: 'Free',
        role: 'Owner',
        color: '#8b5cf6'
      });
      try {
        localStorage.setItem(LIST_KEY, JSON.stringify(tenants));
      } catch (e) {}
      return id;
    },
    setPlan(plan) {
      const tenants = this.list();
      const t = tenants.find(x => x.id === this.active());
      if (t) {
        t.plan = plan;
        try {
          localStorage.setItem(LIST_KEY, JSON.stringify(tenants));
        } catch (e) {}
      }
      return t;
    }
  };
  const realGet = localStorage.getItem.bind(localStorage);
  const realSet = localStorage.setItem.bind(localStorage);
  const BASE = 'cortexx_db_v1';
  localStorage.getItem = function (k) {
    if (k === BASE) return realGet(window.CortexTenant.dbKey()) || realGet(BASE);
    return realGet(k);
  };
  localStorage.setItem = function (k, v) {
    if (k === BASE) return realSet(window.CortexTenant.dbKey(), v);
    return realSet(k, v);
  };
})();
function PhotoReviewScreen({
  accent
}) {
  const [photos, setPhotos] = React.useState([]);
  const [filter, setFilter] = React.useState('pending');
  const [viewing, setViewing] = React.useState(null);
  const fileInput = React.useRef(null);
  const load = React.useCallback(async () => {
    try {
      const list = await window.cortexxPhotoStore.list();
      setPhotos(list.reverse());
    } catch (e) {
      setPhotos([]);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);
  const setStatus = async (id, status) => {
    try {
      const all = await window.cortexxPhotoStore.list();
      const p = all.find(x => x.id === id);
      if (p) {
        p.reviewStatus = status;
      }
    } catch (e) {}
    setPhotos(ps => ps.map(p => p.id === id ? {
      ...p,
      reviewStatus: status
    } : p));
    if (window.cortexxToast) window.cortexxToast(`Photo ${status}`, status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'info');
    if (viewing && viewing.id === id) setViewing(v => ({
      ...v,
      reviewStatus: status
    }));
  };
  const handleFile = async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      await window.cortexxPhotoStore.save(f, {
        name: f.name,
        projectId: 1,
        reviewStatus: 'pending'
      });
    }
    await load();
    if (files.length && window.cortexxToast) window.cortexxToast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded for review`, 'success');
    e.target.value = '';
  };
  const tagged = photos.map(p => ({
    ...p,
    reviewStatus: p.reviewStatus || 'pending'
  }));
  const counts = {
    pending: tagged.filter(p => p.reviewStatus === 'pending').length,
    approved: tagged.filter(p => p.reviewStatus === 'approved').length,
    rejected: tagged.filter(p => p.reviewStatus === 'rejected').length
  };
  const shown = tagged.filter(p => p.reviewStatus === filter);
  const statusC = {
    pending: T.amber,
    approved: T.green,
    rejected: T.red
  };
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Photo review",
    subtitle: `${counts.pending} awaiting review`,
    right: React.createElement("button", {
      onClick: () => fileInput.current && fileInput.current.click(),
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: accent,
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.camera, {
      size: 18
    }))
  }), React.createElement("input", {
    ref: fileInput,
    type: "file",
    accept: "image/*",
    multiple: true,
    capture: "environment",
    onChange: handleFile,
    style: {
      display: 'none'
    }
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement(SegControl, {
    value: filter,
    onChange: setFilter,
    options: [{
      k: 'pending',
      l: 'Pending',
      n: counts.pending
    }, {
      k: 'approved',
      l: 'Approved',
      n: counts.approved
    }, {
      k: 'rejected',
      l: 'Rejected',
      n: counts.rejected
    }]
  })), shown.length === 0 ? React.createElement("div", {
    onClick: () => fileInput.current && fileInput.current.click(),
    style: {
      margin: '4px 16px',
      padding: '40px 20px',
      border: `1.5px dashed ${T.hairStrong}`,
      background: T.bg2,
      borderRadius: 14,
      textAlign: 'center',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      color: accent,
      fontSize: 34,
      marginBottom: 8
    }
  }, React.cloneElement(Ic.camera, {
    size: 34
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 600
    }
  }, filter === 'pending' ? 'No photos awaiting review' : `No ${filter} photos`), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 4
    }
  }, "Tap to capture or upload site photos")) : React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, shown.map(p => {
    let url = '';
    try {
      url = window.cortexxPhotoStore.blobURL(p.blob);
    } catch (e) {}
    return React.createElement("div", {
      key: p.id,
      style: {
        background: T.bg2,
        borderRadius: 12,
        overflow: 'hidden',
        border: `0.5px solid ${T.hair}`
      }
    }, React.createElement("div", {
      onClick: () => setViewing({
        ...p,
        url
      }),
      style: {
        aspectRatio: '4/3',
        background: url ? `url(${url}) center/cover` : T.bg3,
        cursor: 'pointer',
        position: 'relative'
      }
    }, React.createElement("div", {
      style: {
        position: 'absolute',
        top: 6,
        left: 6
      }
    }, React.createElement(Pill, {
      c: statusC[p.reviewStatus],
      size: "xs"
    }, p.reviewStatus))), filter === 'pending' && React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        padding: 6
      }
    }, React.createElement("button", {
      onClick: () => setStatus(p.id, 'approved'),
      style: {
        flex: 1,
        background: `${T.green}22`,
        color: T.green,
        border: 'none',
        borderRadius: 7,
        padding: '7px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700
      }
    }, "\u2713"), React.createElement("button", {
      onClick: () => setStatus(p.id, 'rejected'),
      style: {
        flex: 1,
        background: `${T.red}22`,
        color: T.red,
        border: 'none',
        borderRadius: 7,
        padding: '7px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 700
      }
    }, "\u2717")));
  }))), viewing && React.createElement("div", {
    onClick: () => setViewing(null),
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.95)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, React.createElement("button", {
    onClick: () => setViewing(null),
    style: {
      background: 'none',
      border: 'none',
      color: '#fff',
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer'
    }
  }, "Close"), React.createElement(Pill, {
    c: statusC[viewing.reviewStatus || 'pending']
  }, viewing.reviewStatus || 'pending')), React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }
  }, viewing.url && React.createElement("img", {
    src: viewing.url,
    alt: "",
    style: {
      maxWidth: '100%',
      maxHeight: '100%',
      borderRadius: 12
    }
  })), React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      padding: 16,
      display: 'flex',
      gap: 8
    }
  }, React.createElement("button", {
    onClick: () => setStatus(viewing.id, 'approved'),
    style: {
      flex: 1,
      background: T.green,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Approve"), React.createElement("button", {
    onClick: () => setStatus(viewing.id, 'rejected'),
    style: {
      flex: 1,
      background: 'transparent',
      color: T.red,
      border: `0.5px solid ${T.red}66`,
      borderRadius: 12,
      padding: '14px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Reject"), React.createElement("button", {
    onClick: async () => {
      await window.cortexxPhotoStore.remove(viewing.id);
      await load();
      setViewing(null);
      if (window.cortexxToast) window.cortexxToast('Photo deleted', 'success');
    },
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '14px 16px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Delete")))));
}
function TenantScreen({
  accent
}) {
  const tenants = window.CortexTenant.list();
  const activeId = window.CortexTenant.active();
  const [newName, setNewName] = React.useState('');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Workspaces",
    subtitle: `${tenants.length} organisations · isolated data`
  }), React.createElement("div", {
    style: {
      padding: '4px 16px 14px'
    }
  }, React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${T.purple}22, ${accent}11)`,
      border: `0.5px solid ${T.purple}44`,
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("div", {
    style: {
      color: T.purple
    }
  }, React.cloneElement(Ic.shield, {
    size: 16
  })), React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      lineHeight: 1.4
    }
  }, "Each workspace has fully isolated data \u2014 projects, money, photos. Switching reloads into that tenant's namespace."))), React.createElement(Section, {
    title: "Your workspaces"
  }, React.createElement(GroupedList, null, tenants.map((t, i) => React.createElement(Row, {
    key: t.id,
    icon: React.cloneElement(React.createElement(Avatar, {
      name: t.name,
      size: 32,
      c: t.color
    })),
    iconBg: null,
    title: t.name,
    sub: `${t.role} · ${t.plan}`,
    right: t.id === activeId ? React.createElement(Pill, {
      c: T.green,
      size: "xs"
    }, "ACTIVE") : React.createElement("button", {
      onClick: () => window.CortexTenant.switch(t.id),
      style: {
        background: accent,
        color: '#fff',
        border: 'none',
        borderRadius: 14,
        padding: '5px 12px',
        cursor: 'pointer',
        fontFamily: SF,
        fontSize: 11,
        fontWeight: 700
      }
    }, "Switch"),
    isLast: i === tenants.length - 1
  })))), React.createElement(Section, {
    title: "Create workspace"
  }, React.createElement("div", {
    style: {
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 12
    }
  }, React.createElement("input", {
    value: newName,
    onChange: e => setNewName(e.target.value),
    placeholder: "New company name",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg3,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: '10px 12px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      outline: 'none'
    }
  }), React.createElement("button", {
    onClick: () => {
      if (!newName.trim()) {
        if (window.cortexxToast) window.cortexxToast('Enter a name', 'error');
        return;
      }
      const id = window.CortexTenant.create(newName.trim());
      if (window.cortexxToast) window.cortexxToast('Workspace created', 'success');
      window.CortexTenant.switch(id);
    },
    style: {
      width: '100%',
      marginTop: 8,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 10,
      padding: '11px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Create & switch")))));
}
Object.assign(window, {
  PhotoReviewScreen,
  TenantScreen
});