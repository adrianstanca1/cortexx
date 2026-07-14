(function () {
  if (window.CortexPortalMsgs) return;
  const KEY = 'cortexx_portal_messages';
  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  }
  function save(l) {
    try {
      localStorage.setItem(KEY, JSON.stringify(l.slice(0, 200)));
    } catch (e) {}
  }
  window.CortexPortalMsgs = {
    list() {
      return load();
    },
    unreadCount() {
      return load().filter(m => !m.read).length;
    },
    markRead(id) {
      const l = load();
      const m = l.find(x => x.id === id);
      if (m) {
        m.read = true;
        save(l);
      }
      return l;
    },
    markReplied(id) {
      const l = load();
      const m = l.find(x => x.id === id);
      if (m) {
        m.read = true;
        m.replied = true;
        save(l);
      }
      return l;
    },
    remove(id) {
      save(load().filter(x => x.id !== id));
      return load();
    },
    seedIfEmpty() {
      if (load().length) return;
      save([{
        id: Date.now() - 3600e3,
        projectId: 1,
        project: 'Camden Mews Refurb',
        client: 'J. Patterson',
        text: 'The kitchen is looking great! Quick question — are we still on track for the worktop install next week?',
        when: new Date(Date.now() - 3600e3).toISOString(),
        read: false
      }, {
        id: Date.now() - 9e7,
        projectId: 3,
        project: 'Brixton Shopfront',
        client: 'Tonic Café Ltd',
        text: 'Happy with the snag progress. Can you send the final invoice once the clean is done?',
        when: new Date(Date.now() - 9e7).toISOString(),
        read: true,
        replied: true
      }]);
    }
  };
})();
function ClientMessagesScreen({
  accent
}) {
  window.CortexPortalMsgs.seedIfEmpty();
  const [msgs, setMsgs] = React.useState(window.CortexPortalMsgs.list());
  const [reply, setReply] = React.useState(null);
  const [draft, setDraft] = React.useState('');
  const [cloudOn, setCloudOn] = React.useState(false);
  const refresh = () => setMsgs(window.CortexPortalMsgs.list());
  React.useEffect(() => {
    const cloud = window.cortexxCloud;
    if (!cloud || !cloud.status().authed) return;
    setCloudOn(true);
    let alive = true;
    const pull = async () => {
      const rows = await cloud.portalInbox();
      if (!alive || !Array.isArray(rows)) return;
      const local = window.CortexPortalMsgs.list();
      const seen = new Set(local.map(m => 'srv-' + m.id));
      const mapped = rows.filter(r => r.direction !== 'out').map(r => ({
        id: 'srv-' + r.id,
        projectId: r.project_id,
        project: r.project || 'Project',
        client: r.client,
        text: r.body,
        when: r.created_at,
        read: r.read,
        replied: r.replied,
        kind: r.kind,
        _server: true
      }));
      const fresh = mapped.filter(m => !seen.has(m.id));
      if (fresh.length) {
        const merged = [...fresh, ...local].sort((a, b) => new Date(b.when) - new Date(a.when));
        try {
          localStorage.setItem('cortexx_portal_messages', JSON.stringify(merged.slice(0, 200)));
        } catch (e) {}
        setMsgs(window.CortexPortalMsgs.list());
      }
    };
    pull();
    const onRemote = e => {
      if (e.detail && (e.detail.type === 'portal_message' || e.detail.type === 'portal_approval')) pull();
    };
    window.addEventListener('cortexx-remote', onRemote);
    return () => {
      alive = false;
      window.removeEventListener('cortexx-remote', onRemote);
    };
  }, []);
  const open = m => {
    if (!m.read) {
      window.CortexPortalMsgs.markRead(m.id);
      refresh();
    }
    setReply(m);
    setDraft('');
  };
  const sendReply = () => {
    if (!draft.trim() || !reply) return;
    window.CortexPortalMsgs.markReplied(reply.id);
    if (reply._server && window.cortexxCloud && window.cortexxCloud.status().authed) {
      const srvId = String(reply.id).replace(/^srv-/, '');
      const api = window.cortexxCloud.status().apiUrl;
      try {
        fetch(`${api}/api/portal-inbox/${srvId}/reply`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Bearer ' + (localStorage.getItem('cortexx_token') || '')
          },
          body: JSON.stringify({
            body: draft.trim()
          })
        }).catch(() => {});
      } catch (e) {}
    }
    if (window.CortexAudit) window.CortexAudit.log('You', `replied to ${reply.client} via portal`, 'Settings');
    if (window.cortexxToast) window.cortexxToast('Reply sent to ' + reply.client, 'success');
    setReply(null);
    setDraft('');
    refresh();
  };
  const remove = id => {
    window.CortexPortalMsgs.remove(id);
    refresh();
  };
  const fmtWhen = iso => {
    const d = new Date(iso),
      diff = (Date.now() - d) / 1000;
    if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short'
    });
  };
  const unread = msgs.filter(m => !m.read).length;
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Client messages",
    subtitle: (unread ? `${unread} unread · ` : '') + (cloudOn ? 'synced from cloud + portals' : 'from your client portals'),
    ws: true
  }), React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, msgs.length === 0 ? React.createElement("div", {
    style: {
      padding: '40px 16px',
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3
    }
  }, "No client messages yet. When a client sends a note from their portal, it lands here.") : React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, msgs.map(m => React.createElement("div", {
    key: m.id,
    onClick: () => open(m),
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 14,
      cursor: 'pointer',
      border: `0.5px solid ${m.read ? T.hair : accent}`,
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8
    }
  }, React.createElement(Avatar, {
    name: m.client,
    size: 32,
    c: accent
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 600,
      color: T.t1
    }
  }, m.client), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, m.project, " \xB7 ", fmtWhen(m.when))), !m.read && React.createElement("div", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 5,
      background: accent,
      flexShrink: 0
    }
  }), m.kind === 'approval' && React.createElement(Pill, {
    c: T.green,
    size: "xs"
  }, "APPROVED"), m.replied && React.createElement(Pill, {
    c: T.green,
    size: "xs"
  }, "REPLIED")), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.45,
      opacity: 0.92
    }
  }, m.text)))))), reply && React.createElement(Sheet, {
    onClose: () => setReply(null)
  }, React.createElement("div", {
    style: {
      padding: '20px 20px 30px'
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 14
    }
  }, React.createElement(Avatar, {
    name: reply.client,
    size: 40,
    c: accent
  }), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 700,
      color: T.t1
    }
  }, reply.client), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2
    }
  }, reply.project)), React.createElement("button", {
    onClick: () => {
      remove(reply.id);
      setReply(null);
    },
    title: "Delete",
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: T.t3,
      padding: 6
    }
  }, React.cloneElement(Ic.trash || Ic.x, {
    size: 16
  }))), React.createElement("div", {
    style: {
      background: T.bg2,
      borderRadius: 12,
      padding: 14,
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, reply.text), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6
    }
  }, "Your reply"), React.createElement("textarea", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    rows: 4,
    placeholder: `Reply to ${reply.client}…`,
    style: {
      width: '100%',
      background: T.bg3,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 10,
      padding: 12,
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      outline: 'none',
      resize: 'vertical',
      boxSizing: 'border-box'
    }
  }), React.createElement("button", {
    onClick: sendReply,
    disabled: !draft.trim(),
    style: {
      width: '100%',
      marginTop: 12,
      background: draft.trim() ? accent : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: draft.trim() ? 'pointer' : 'default',
      opacity: draft.trim() ? 1 : 0.5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.send, {
    size: 15
  }), " Send reply"))));
}
Object.assign(window, {
  ClientMessagesScreen
});