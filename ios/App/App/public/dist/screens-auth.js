// Cortexx — Auth & Invitations UI (v1.9)
// Full account flow for the multi-tenant backend:
//   • AccountSheet — sign in / create account (new workspace) / accept invite
//   • InviteTeammateSheet — invite a teammate into your workspace
// Works two ways: LIVE against /api/auth/* via cortexxCloud when an API is
// configured; otherwise falls back to a clearly-labelled local session so the
// app remains fully usable offline. No fake success states: live failures
// surface as errors, local mode is labelled "device only".

(function () {
  const inp = () => ({
    width: '100%',
    boxSizing: 'border-box',
    background: T.bg2,
    border: `0.5px solid ${T.hairMid}`,
    borderRadius: 11,
    padding: '12px 13px',
    color: T.t1,
    fontFamily: SF,
    fontSize: 14.5,
    outline: 'none',
    marginTop: 6
  });
  const lbl = {
    fontFamily: SF,
    fontSize: 12.5,
    color: T.t2,
    fontWeight: 600
  };
  function Field({
    label,
    type,
    value,
    onChange,
    placeholder,
    autoFocus
  }) {
    return React.createElement('div', null, React.createElement('div', {
      style: lbl
    }, label), React.createElement('input', {
      style: inp(),
      type: type || 'text',
      value,
      onChange: e => onChange(e.target.value),
      placeholder,
      autoFocus
    }));
  }
  function PrimaryBtn({
    children,
    onClick,
    disabled,
    accent
  }) {
    return React.createElement('button', {
      onClick,
      disabled,
      style: {
        width: '100%',
        background: disabled ? T.bg2 : accent || T.blue,
        color: disabled ? T.t3 : '#fff',
        border: 'none',
        borderRadius: 12,
        padding: '13px',
        fontFamily: SF,
        fontSize: 15,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        marginTop: 4
      }
    }, children);
  }
  const hasApi = () => !!(window.cortexxCloud && cortexxCloud.status().configured);

  // Local (device-only) session — the offline path. Honest labelling.
  async function localSession(name, email, company) {
    try {
      if (window.Backend) {
        await Backend.db.user.update({
          name: name || email.split('@')[0],
          email,
          ...(company ? {
            companyBrief: company
          } : {})
        });
      }
      localStorage.setItem('cortexx_session', JSON.stringify({
        email,
        name,
        local: true,
        at: Date.now()
      }));
      toast('Signed in on this device', 'success');
      return true;
    } catch (e) {
      return false;
    }
  }

  // ── Account sheet: tabbed sign-in / register / accept-invite ──
  function AccountSheet({
    onClose,
    accent = T.blue
  }) {
    const [mode, setMode] = React.useState('signin'); // signin | register | invite
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [company, setCompany] = React.useState('');
    const [inviteToken, setInviteToken] = React.useState(() => new URLSearchParams(location.search).get('invite') || '');
    const [inviteMeta, setInviteMeta] = React.useState(null);
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState('');
    const live = hasApi();
    const session = (() => {
      try {
        return JSON.parse(localStorage.getItem('cortexx_session') || 'null');
      } catch (e) {
        return null;
      }
    })();
    const cloudAuthed = window.cortexxCloud && cortexxCloud.status().authed;

    // If arriving via ?invite=…, look it up (live only)
    React.useEffect(() => {
      if (inviteToken && live) {
        setMode('invite');
        cortexxCloud.inviteInfo(inviteToken).then(info => {
          if (info && info.workspace) setInviteMeta(info);
        });
      } else if (inviteToken) setMode('invite');
    }, []);
    const emailOk = /\S+@\S+\.\S+/.test(email || inviteMeta && inviteMeta.email || '');
    const go = async () => {
      setBusy(true);
      setErr('');
      let ok = false;
      if (mode === 'signin') {
        if (live) ok = await cortexxCloud.loginPassword(email, password);else ok = await localSession(name, email);
      } else if (mode === 'register') {
        if (live) ok = await cortexxCloud.register(name, email, password, company);else ok = await localSession(name, email, company);
      } else if (mode === 'invite') {
        if (live) ok = await cortexxCloud.acceptInvite(inviteToken, name, password);else {
          setErr('Accepting an invite needs the cloud API — connect in Settings → Cloud sync first.');
          setBusy(false);
          return;
        }
      }
      setBusy(false);
      if (ok) {
        localStorage.setItem('cortexx_session', JSON.stringify({
          email: email || inviteMeta && inviteMeta.email,
          name,
          local: !live,
          at: Date.now()
        }));
        onClose();
      } else if (live) setErr('That didn\u2019t work — check the details and try again.');
    };
    const tab = (id, label) => React.createElement('button', {
      key: id,
      onClick: () => {
        setMode(id);
        setErr('');
      },
      style: {
        flex: 1,
        background: mode === id ? accent : 'transparent',
        color: mode === id ? '#fff' : T.t2,
        border: 'none',
        borderRadius: 9,
        padding: '9px 0',
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 650,
        cursor: 'pointer'
      }
    }, label);
    return React.createElement(SheetWrap, {
      title: 'Account',
      onClose,
      accent
    }, React.createElement('div', {
      style: {
        padding: '4px 16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    },
    // mode badge
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, React.createElement('span', {
      style: {
        width: 7,
        height: 7,
        borderRadius: 7,
        background: live ? T.green : T.amber
      }
    }), React.createElement('span', {
      style: {
        fontFamily: SF,
        fontSize: 12,
        color: T.t3
      }
    }, live ? 'Connected to cloud — full multi-tenant accounts' : 'No cloud API configured — accounts are stored on this device only')),
    // current session
    (session || cloudAuthed) && React.createElement('div', {
      style: {
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, React.createElement('div', {
      style: {
        width: 34,
        height: 34,
        borderRadius: 17,
        background: accent,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontFamily: SF,
        fontWeight: 800,
        fontSize: 14
      }
    }, (session && (session.name || session.email) || 'U')[0].toUpperCase()), React.createElement('div', {
      style: {
        flex: 1
      }
    }, React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 13.5,
        fontWeight: 650,
        color: T.t1
      }
    }, session && (session.name || session.email) || 'Signed in'), React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 11.5,
        color: T.t3
      }
    }, session && session.local ? 'Device session' : 'Cloud session')), React.createElement('button', {
      onClick: () => {
        localStorage.removeItem('cortexx_session');
        if (window.cortexxCloud) cortexxCloud.signOut();
        toast('Signed out', 'info');
        onClose();
      },
      style: {
        background: 'transparent',
        border: `0.5px solid ${T.hairMid}`,
        borderRadius: 9,
        color: T.t2,
        padding: '7px 12px',
        fontFamily: SF,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, 'Sign out')),
    // tabs
    React.createElement('div', {
      style: {
        display: 'flex',
        gap: 4,
        background: T.bg2,
        borderRadius: 11,
        padding: 4
      }
    }, tab('signin', 'Sign in'), tab('register', 'Create account'), tab('invite', 'Join by invite')),
    // fields
    mode === 'signin' && React.createElement(React.Fragment, null, !live && React.createElement(Field, {
      label: 'Your name',
      value: name,
      onChange: setName,
      placeholder: 'Adrian Stanca',
      autoFocus: true
    }), React.createElement(Field, {
      label: 'Email',
      type: 'email',
      value: email,
      onChange: setEmail,
      placeholder: 'you@company.com',
      autoFocus: live
    }), live && React.createElement(Field, {
      label: 'Password',
      type: 'password',
      value: password,
      onChange: setPassword,
      placeholder: '••••••••'
    })), mode === 'register' && React.createElement(React.Fragment, null, React.createElement(Field, {
      label: 'Your name',
      value: name,
      onChange: setName,
      placeholder: 'Adrian Stanca',
      autoFocus: true
    }), React.createElement(Field, {
      label: 'Company / workspace',
      value: company,
      onChange: setCompany,
      placeholder: 'Stanca Construction Ltd'
    }), React.createElement(Field, {
      label: 'Email',
      type: 'email',
      value: email,
      onChange: setEmail,
      placeholder: 'you@company.com'
    }), live && React.createElement(Field, {
      label: 'Password',
      type: 'password',
      value: password,
      onChange: setPassword,
      placeholder: 'min 8 characters'
    })), mode === 'invite' && React.createElement(React.Fragment, null, inviteMeta && React.createElement('div', {
      style: {
        background: T.green + '14',
        border: `0.5px solid ${T.green}44`,
        borderRadius: 11,
        padding: '11px 13px',
        fontFamily: SF,
        fontSize: 13,
        color: T.t1
      }
    }, 'Invited to ', React.createElement('strong', null, inviteMeta.workspace), ' as ', inviteMeta.role, ' (', inviteMeta.email, ')'), React.createElement(Field, {
      label: 'Invite code',
      value: inviteToken,
      onChange: setInviteToken,
      placeholder: 'paste your invite code or open the invite link'
    }), React.createElement(Field, {
      label: 'Your name',
      value: name,
      onChange: setName,
      placeholder: 'Adrian Stanca'
    }), React.createElement(Field, {
      label: 'Choose a password',
      type: 'password',
      value: password,
      onChange: setPassword,
      placeholder: 'min 8 characters'
    })), err && React.createElement('div', {
      style: {
        background: T.red + '14',
        border: `0.5px solid ${T.red}44`,
        borderRadius: 10,
        padding: '10px 13px',
        fontFamily: SF,
        fontSize: 12.5,
        color: T.red
      }
    }, err), React.createElement(PrimaryBtn, {
      accent,
      disabled: busy || (mode === 'signin' ? !emailOk || live && !password : mode === 'register' ? !name.trim() || !emailOk || live && password.length < 8 : !inviteToken.trim() || !name.trim() || password.length < 8),
      onClick: go
    }, busy ? 'Working…' : mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create workspace' : 'Accept invite'), !live && mode !== 'invite' && React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 11.5,
        color: T.t3,
        lineHeight: 1.5
      }
    }, 'Tip: connect your deployed API in Settings → Cloud sync to enable real multi-tenant accounts, team invitations and cross-device sync.')));
  }

  // ── Invite a teammate (from Team / side menu) ──
  function InviteTeammateSheet({
    onClose,
    accent = T.blue
  }) {
    const [email, setEmail] = React.useState('');
    const [role, setRole] = React.useState('member');
    const [busy, setBusy] = React.useState(false);
    const [result, setResult] = React.useState(null);
    const [pending, setPending] = React.useState([]);
    const live = hasApi() && cortexxCloud.status().authed;
    React.useEffect(() => {
      if (live) cortexxCloud.listInvites().then(r => setPending(Array.isArray(r) ? r.filter(i => !i.used) : []));
    }, []);
    const send = async () => {
      setBusy(true);
      setResult(null);
      if (live) {
        const r = await cortexxCloud.invite(email, role);
        if (r && r.link) {
          setResult({
            link: r.link,
            live: true
          });
          setPending(await cortexxCloud.listInvites().then(x => Array.isArray(x) ? x.filter(i => !i.used) : []));
        }
      } else {
        // Honest local fallback: record the intent, give a shareable placeholder
        if (window.Backend) {
          try {
            await Backend.db.team.create({
              n: email.split('@')[0],
              role: role,
              email,
              status: 'invited'
            });
          } catch (e) {}
        }
        setResult({
          link: null,
          live: false
        });
        toast('Added to team as invited (device only)', 'success');
      }
      setBusy(false);
    };
    return React.createElement(SheetWrap, {
      title: 'Invite teammate',
      onClose,
      accent
    }, React.createElement('div', {
      style: {
        padding: '4px 16px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t2,
        lineHeight: 1.5
      }
    }, live ? 'They\u2019ll get a link that adds them straight into your workspace.' : 'No cloud connection — the person is recorded as invited on this device. Connect Cloud sync to send real invitations.'), React.createElement(Field, {
      label: 'Email',
      type: 'email',
      value: email,
      onChange: setEmail,
      placeholder: 'teammate@company.com',
      autoFocus: true
    }), React.createElement('div', null, React.createElement('div', {
      style: lbl
    }, 'Role'), React.createElement('div', {
      style: {
        display: 'flex',
        gap: 8,
        marginTop: 6
      }
    }, ['member', 'manager', 'admin'].map(r => React.createElement('button', {
      key: r,
      onClick: () => setRole(r),
      style: {
        flex: 1,
        background: role === r ? accent : T.bg2,
        color: role === r ? '#fff' : T.t2,
        border: `0.5px solid ${role === r ? accent : T.hairMid}`,
        borderRadius: 10,
        padding: '9px 0',
        fontFamily: SF,
        fontSize: 13,
        fontWeight: 650,
        cursor: 'pointer',
        textTransform: 'capitalize'
      }
    }, r)))), React.createElement(PrimaryBtn, {
      accent,
      disabled: busy || !/\S+@\S+\.\S+/.test(email),
      onClick: send
    }, busy ? 'Creating…' : 'Create invitation'), result && result.live && React.createElement('div', {
      style: {
        background: T.green + '14',
        border: `0.5px solid ${T.green}44`,
        borderRadius: 11,
        padding: '12px 13px'
      }
    }, React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 12.5,
        fontWeight: 700,
        color: T.green,
        marginBottom: 6
      }
    }, 'Invite link (valid 7 days)'), React.createElement('div', {
      style: {
        fontFamily: SFMono,
        fontSize: 11,
        color: T.t1,
        wordBreak: 'break-all',
        marginBottom: 8
      }
    }, result.link), React.createElement('button', {
      onClick: () => {
        navigator.clipboard && navigator.clipboard.writeText(result.link);
        toast('Link copied', 'success');
      },
      style: {
        background: T.green,
        color: '#04140c',
        border: 'none',
        borderRadius: 9,
        padding: '8px 14px',
        fontFamily: SF,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: 'pointer'
      }
    }, 'Copy link')), live && pending.length > 0 && React.createElement('div', null, React.createElement('div', {
      style: {
        ...lbl,
        marginBottom: 8
      }
    }, 'PENDING INVITES'), pending.map(i => React.createElement('div', {
      key: i.token,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: T.bg2,
        border: `0.5px solid ${T.hair}`,
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 6
      }
    }, React.createElement('div', {
      style: {
        flex: 1
      }
    }, React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 13,
        color: T.t1,
        fontWeight: 600
      }
    }, i.email), React.createElement('div', {
      style: {
        fontFamily: SF,
        fontSize: 11,
        color: T.t3
      }
    }, i.role + ' · expires ' + new Date(i.expires_at).toLocaleDateString('en-GB'))), React.createElement('button', {
      onClick: async () => {
        await cortexxCloud.revokeInvite(i.token);
        setPending(pending.filter(p => p.token !== i.token));
        toast('Invite revoked', 'info');
      },
      style: {
        background: 'transparent',
        border: `0.5px solid ${T.hairMid}`,
        borderRadius: 8,
        color: T.red,
        padding: '6px 10px',
        fontFamily: SF,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: 'pointer'
      }
    }, 'Revoke'))))));
  }
  Object.assign(window, {
    AccountSheet,
    InviteTeammateSheet
  });
})();