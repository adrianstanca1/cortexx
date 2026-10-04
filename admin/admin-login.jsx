// CortexBuild Admin — Login gate
const AT_L = window.AT;

function LoginScreen({ onAuthed }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    if (e) e.preventDefault();
    setErr(''); setBusy(true);
    const res = await AdminAPI.login(email.trim(), password);
    setBusy(false);
    if (res.ok) onAuthed(res.mode);
    else setErr(res.error || 'Login failed');
  };

  const inp = { width: '100%', background: AT_L.card, border: `1px solid ${AT_L.hairMid}`, borderRadius: 10, padding: '12px 14px', color: AT_L.t1, fontSize: 14.5, fontFamily: AT_L.sans, outline: 'none', marginTop: 7 };
  const lbl = { fontSize: 12.5, color: AT_L.t2, fontWeight: 600, fontFamily: AT_L.sans };

  return React.createElement('div', { style: { height: '100vh', display: 'grid', placeItems: 'center', background: `radial-gradient(1200px 600px at 50% -10%, ${AT_L.card2}, ${AT_L.bg0})` } },
    React.createElement('form', { onSubmit: submit, style: { width: 380, maxWidth: '92vw', background: AT_L.bg1, border: `1px solid ${AT_L.hairMid}`, borderRadius: 18, padding: 32, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 } },
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${AT_L.blue}, ${AT_L.purple})`, display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 20, fontFamily: AT_L.sans } }, 'C'),
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 17, fontWeight: 760, color: AT_L.t1, fontFamily: AT_L.sans, lineHeight: 1.1 } }, 'CortexBuild'),
          React.createElement('div', { style: { fontSize: 10.5, color: AT_L.t3, fontFamily: AT_L.mono, letterSpacing: 0.5 } }, 'ADMIN CONSOLE'))),
      React.createElement('div', { style: { fontSize: 13.5, color: AT_L.t3, fontFamily: AT_L.sans, margin: '14px 0 22px' } }, 'Sign in to the platform operator console.'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Email'),
          React.createElement('input', { style: inp, type: 'email', value: email, onChange: (e) => setEmail(e.target.value), placeholder: 'admin@cortexbuildpro.com', autoFocus: true })),
        React.createElement('div', null, React.createElement('div', { style: lbl }, 'Password'),
          React.createElement('input', { style: inp, type: 'password', value: password, onChange: (e) => setPassword(e.target.value), placeholder: '••••••••' }))),
      err && React.createElement('div', { style: { marginTop: 14, padding: '10px 13px', background: AT_L.redDim, border: `1px solid ${AT_L.red}44`, borderRadius: 9, color: AT_L.red, fontSize: 12.5, fontFamily: AT_L.sans } }, err),
      React.createElement('button', { type: 'submit', disabled: busy || !email.trim() || !password, style: {
        width: '100%', marginTop: 20, background: AT_L.blue, color: '#fff', border: 'none', borderRadius: 11,
        padding: '13px', fontSize: 14.5, fontWeight: 680, fontFamily: AT_L.sans, cursor: busy ? 'wait' : 'pointer',
        opacity: (busy || !email.trim() || !password) ? 0.55 : 1,
      } }, busy ? 'Signing in…' : 'Sign in'),
      React.createElement('div', { style: { marginTop: 16, padding: '11px 13px', background: AT_L.card, borderRadius: 10, fontSize: 11.5, color: AT_L.t3, fontFamily: AT_L.sans, lineHeight: 1.5 } },
        React.createElement('strong', { style: { color: AT_L.t2 } }, 'Demo access: '),
        'admin@cortexbuildpro.com · password ', React.createElement('code', { style: { fontFamily: AT_L.mono, color: AT_L.blueL } }, 'cortexbuild'))));
}

window.LoginScreen = LoginScreen;
