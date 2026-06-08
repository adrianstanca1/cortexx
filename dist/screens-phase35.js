(function () {
  if (!window.Backend) return;
  const snap = Backend.db.snapshot();
  if (!snap.aiHistory) {
    snap.aiHistory = [];
    try {
      localStorage.setItem('cortexx_db_v1', JSON.stringify(snap));
    } catch (e) {}
  }
  const mk = n => ({
    listSync: () => [...Backend.db.snapshot()[n]],
    list: async () => [...Backend.db.snapshot()[n]],
    create: async d => {
      const s = Backend.db.snapshot();
      const ids = s[n].map(x => typeof x.id === 'number' ? x.id : 0);
      s[n] = [{
        ...d,
        id: Math.max(0, ...ids) + 1
      }, ...s[n]].slice(0, 50);
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    },
    update: async () => {},
    remove: async () => {},
    clear: async () => {
      const s = Backend.db.snapshot();
      s[n] = [];
      try {
        localStorage.setItem('cortexx_db_v1', JSON.stringify(s));
      } catch (e) {}
      Backend.db.user.update({});
    }
  });
  Backend.db.aiHistory = mk('aiHistory');
  const origAsk = Backend.ai.ask;
  Backend.ai.ask = async (userMsg, opts = {}) => {
    const result = await origAsk(userMsg, opts);
    if (userMsg && userMsg.trim() && !opts.skipHistory) {
      await Backend.db.aiHistory.create({
        userMsg,
        aiReply: result,
        when: new Date().toISOString().slice(0, 16)
      });
    }
    return result;
  };
})();
function AIHistoryScreen({
  accent
}) {
  const history = useDB('aiHistory');
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Conversation history",
    subtitle: `${history.length} past chats with Cortex`,
    right: history.length > 0 && React.createElement(HeaderBtn, {
      icon: Ic.trash,
      onClick: async () => {
        await Backend.db.aiHistory.clear();
        toast('History cleared', 'success');
      }
    })
  }), history.length === 0 ? React.createElement("div", {
    style: {
      padding: 40,
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      width: 60,
      height: 60,
      margin: '0 auto 16px',
      borderRadius: 14,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.spark, {
    size: 30
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      color: T.t1,
      fontWeight: 600
    }
  }, "No history yet"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginTop: 6
    }
  }, "Ask Cortex anything \u2014 chats appear here"), React.createElement("button", {
    onClick: () => window.cortexxNav('ai'),
    style: {
      marginTop: 20,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '10px 18px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Start a chat")) : React.createElement("div", {
    style: {
      padding: '0 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, history.map(h => React.createElement("div", {
    key: h.id,
    style: {
      background: T.bg2,
      borderRadius: 14,
      padding: 12,
      border: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      color: T.t3
    }
  }, React.cloneElement(Ic.search, {
    size: 11
  })), React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3
    }
  }, new Date(h.when).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }))), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      fontWeight: 600,
      marginBottom: 8
    }
  }, "\"", h.userMsg, "\""), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      paddingTop: 8,
      borderTop: `0.5px solid ${T.hair}`
    }
  }, React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 5,
      background: `${T.purple}22`,
      color: T.purple,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.cloneElement(Ic.spark, {
    size: 11
  })), React.createElement("div", {
    style: {
      flex: 1,
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      lineHeight: 1.5
    }
  }, h.aiReply)))))));
}
Object.assign(window, {
  AIHistoryScreen
});