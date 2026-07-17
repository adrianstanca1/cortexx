function InlineField({
  value,
  onSave,
  placeholder,
  type = 'text',
  size = 'md',
  accent
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value || '');
  const ref = React.useRef(null);
  React.useEffect(() => setDraft(value || ''), [value]);
  React.useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  const commit = async () => {
    if (draft !== value) await onSave(draft);
    setEditing(false);
  };
  const fontSize = size === 'lg' ? 22 : size === 'sm' ? 12 : 14;
  if (editing) {
    return React.createElement("input", {
      ref: ref,
      value: draft,
      type: type,
      onChange: e => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: e => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(value);
          setEditing(false);
        }
      },
      style: {
        background: T.bg3,
        border: `1px solid ${accent || T.blue}`,
        borderRadius: 6,
        padding: '4px 8px',
        color: T.t1,
        fontFamily: SF,
        fontSize,
        fontWeight: 600,
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box'
      }
    });
  }
  return React.createElement("span", {
    onClick: () => setEditing(true),
    style: {
      cursor: 'text',
      borderRadius: 4,
      padding: '4px 6px',
      margin: '-4px -6px',
      transition: 'background 0.12s',
      display: 'inline-block'
    },
    onMouseEnter: e => e.currentTarget.style.background = T.bg3,
    onMouseLeave: e => e.currentTarget.style.background = 'transparent'
  }, value || React.createElement("span", {
    style: {
      color: T.t3,
      fontStyle: 'italic'
    }
  }, placeholder || 'tap to edit'));
}
function ResponsiveSidebar({
  tab,
  setTab,
  accent
}) {
  const [wide, setWide] = React.useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  React.useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (!wide) return null;
  const tabs = [{
    k: 'dashboard',
    l: 'Dashboard',
    i: Ic.dashboard
  }, {
    k: 'projects',
    l: 'Projects',
    i: Ic.projects
  }, {
    k: 'tasks',
    l: 'Tasks',
    i: Ic.tasks
  }, {
    k: 'team',
    l: 'Team',
    i: Ic.team
  }];
  return React.createElement("div", {
    style: {
      position: 'fixed',
      left: 0,
      top: 0,
      bottom: 0,
      width: 220,
      zIndex: 5,
      background: T.bg1,
      borderRight: `0.5px solid ${T.hair}`,
      padding: '24px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '0 8px 24px'
    }
  }, React.createElement("div", {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: `linear-gradient(135deg, ${accent}, ${T.purple})`,
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.cloneElement(Ic.spark, {
    size: 17
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 16,
      fontWeight: 700,
      color: T.t1,
      letterSpacing: -0.3
    }
  }, "Cortexx")), tabs.map(t => React.createElement("button", {
    key: t.k,
    onClick: () => setTab(t.k),
    style: {
      background: tab === t.k ? `${accent}22` : 'transparent',
      border: 'none',
      color: tab === t.k ? accent : T.t2,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      padding: '10px 12px',
      borderRadius: 8,
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.cloneElement(t.i, {
    size: 17
  }), " ", t.l)), React.createElement("div", {
    style: {
      flex: 1
    }
  }), React.createElement("button", {
    onClick: () => window.cortexxNav('cmdk'),
    style: {
      background: T.bg3,
      border: 'none',
      color: T.t1,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      padding: '8px 12px',
      borderRadius: 8,
      cursor: 'pointer',
      textAlign: 'left',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.search, {
    size: 14
  }), " ", React.createElement("span", {
    style: {
      flex: 1
    }
  }, "Quick jump"), " ", React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 9,
      background: T.bg2,
      padding: '2px 5px',
      borderRadius: 3
    }
  }, "\u2318K")));
}
Object.assign(window, {
  InlineField,
  ResponsiveSidebar
});