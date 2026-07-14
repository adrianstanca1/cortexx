(function () {
  if (!window.Backend) return;
  const grabJSON = (raw, arr) => {
    try {
      const m = raw.match(arr ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
      return m ? JSON.parse(m[0]) : null;
    } catch (e) {
      return null;
    }
  };
  Backend.vera = Backend.vera || {};
  Backend.vera.estimateLead = async lead => {
    const brief = `${lead.inquiry || lead.name}. Indicative budget around £${lead.value || 'unknown'}. UK London SMB refurb/build contractor.`;
    const est = await Backend.ai.estimateQuote(brief);
    if (!est) return null;
    const quote = await Backend.db.quotes.create({
      client: lead.name,
      title: est.title || lead.inquiry || 'Estimate',
      total: est.total || 0,
      status: 'draft',
      issued: new Date().toISOString().slice(0, 10),
      items: est.items || [],
      leadId: lead.id,
      _draftedBy: 'Vera'
    });
    try {
      await Backend.db.leads.update(lead.id, {
        stage: 'quoted',
        value: est.total || lead.value,
        updated: new Date().toISOString().slice(0, 10)
      });
    } catch (e) {}
    if (window.CortexAudit) window.CortexAudit.log('Vera', `drafted a £${(est.total || 0).toLocaleString('en-GB')} quote for ${lead.name}`, 'Reports');
    return {
      quote,
      est
    };
  };
  Backend.vera.autoEstimateNewLeads = async onProgress => {
    const leads = (Backend.db.leads ? Backend.db.leads.listSync() : []).filter(l => ['new', 'qualified'].includes(l.stage));
    const out = [];
    for (let i = 0; i < leads.length; i++) {
      onProgress && onProgress(i, leads.length, leads[i]);
      const r = await Backend.vera.estimateLead(leads[i]);
      if (r) out.push({
        lead: leads[i],
        ...r
      });
    }
    return out;
  };
  const toImg = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(r.error);
    r.onload = () => res({
      media_type: blob.type || 'image/jpeg',
      data: String(r.result || '').split(',')[1] || ''
    });
    r.readAsDataURL(blob);
  });
  const downscale = (blob, maxDim = 1280) => new Promise(res => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * ratio);
        c.height = Math.round(img.naturalHeight * ratio);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(o => {
          URL.revokeObjectURL(url);
          res(o || blob);
        }, 'image/jpeg', 0.82);
      } catch (e) {
        URL.revokeObjectURL(url);
        res(blob);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      res(blob);
    };
    img.src = url;
  });
  Backend.vision = Backend.vision || {};
  Backend.vision.extractActions = async blob => {
    const scaled = await downscale(blob);
    const img = await toImg(scaled);
    const prompt = `You are a UK construction site manager reviewing this photo. Identify concrete follow-ups. Reply ONLY JSON: {"summary":"one sentence on what you see","items":[{"type":"task|snag|rfi","title":"short actionable title","priority":"low|med|high"}]}. Max 5 items. If nothing actionable, items:[].`;
    try {
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: [{
            type: 'text',
            text: prompt
          }, {
            type: 'image',
            source: {
              type: 'base64',
              media_type: img.media_type,
              data: img.data
            }
          }]
        }]
      });
      return grabJSON(raw) || {
        summary: '',
        items: []
      };
    } catch (e) {
      return {
        summary: '',
        items: []
      };
    }
  };
  Backend.ai.triageEmail = async text => {
    const prompt = `You triage inbound email for a UK SMB construction company. Classify the message and extract structured data.
Reply ONLY JSON: {"category":"lead|invoice|enquiry|supplier|complaint|other","confidence":0-1,"summary":"1 sentence","suggestedAction":"what to do","extract":{"name":"person/company or null","value":"GBP number or null","inquiry":"scope or null","due":"date or null"}}.
Email: """${text.slice(0, 4000)}"""`;
    try {
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      return grabJSON(raw);
    } catch (e) {
      return null;
    }
  };
  Backend.ai.fileTriage = async t => {
    const e = t.extract || {};
    const val = parseFloat(String(e.value || '').replace(/[^0-9.]/g, '')) || 0;
    if (t.category === 'lead' || t.category === 'enquiry') {
      const lead = await Backend.db.leads.create({
        name: e.name || 'New enquiry',
        inquiry: e.inquiry || t.summary,
        value: val,
        source: 'Email',
        stage: 'new',
        updated: new Date().toISOString().slice(0, 10)
      });
      if (window.CortexAudit) window.CortexAudit.log('You', `filed email as lead: ${lead.name}`, 'Inbox');
      return {
        kind: 'lead',
        record: lead
      };
    }
    if (t.category === 'invoice') {
      const task = await Backend.db.tasks.create({
        title: `Process invoice: ${e.name || t.summary}`,
        assignee: 'You',
        prio: 'high',
        due: e.due || null
      });
      return {
        kind: 'task',
        record: task
      };
    }
    const task = await Backend.db.tasks.create({
      title: t.suggestedAction || t.summary,
      assignee: 'You',
      prio: 'med'
    });
    return {
      kind: 'task',
      record: task
    };
  };
})();
function PhotoMentionSheet({
  onClose,
  accent
}) {
  const [preview, setPreview] = React.useState(null);
  const [blob, setBlob] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [filed, setFiled] = React.useState({});
  const fileRef = React.useRef(null);
  const pick = e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setBlob(f);
    setResult(null);
    setFiled({});
    setPreview(URL.createObjectURL(f));
  };
  const analyse = async () => {
    if (!blob) return;
    setBusy(true);
    const r = await Backend.vision.extractActions(blob);
    setResult(r);
    setBusy(false);
  };
  const file = async (item, i) => {
    if (filed[i]) return;
    if (item.type === 'snag') await Backend.db.snags?.create?.({
      title: item.title,
      priority: item.priority,
      status: 'open',
      created: new Date().toISOString().slice(0, 10)
    });else if (item.type === 'rfi') await Backend.db.rfis?.create?.({
      subject: item.title,
      status: 'open',
      priority: item.priority
    });else await Backend.db.tasks.create({
      title: item.title,
      prio: item.priority === 'high' ? 'high' : item.priority === 'low' ? 'low' : 'med',
      assignee: 'You'
    });
    setFiled(f => ({
      ...f,
      [i]: true
    }));
    if (window.cortexxToast) window.cortexxToast(`${item.type.toUpperCase()} created`, 'success');
  };
  const TYPE_C = {
    task: accent,
    snag: T.amber,
    rfi: T.purple
  };
  return React.createElement(Sheet, {
    onClose: onClose
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px 10px'
    }
  }, React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Close"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.camera, {
    size: 14
  }), " Photo \u2192 actions"), React.createElement("div", {
    style: {
      width: 50
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 24px'
    }
  }, React.createElement("input", {
    ref: fileRef,
    type: "file",
    accept: "image/*",
    onChange: pick,
    style: {
      display: 'none'
    }
  }), !preview ? React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    style: {
      width: '100%',
      aspectRatio: '4/3',
      background: T.bg2,
      border: `1.5px dashed ${T.hairMid}`,
      borderRadius: 14,
      color: T.t2,
      fontFamily: SF,
      fontSize: 14,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10
    }
  }, React.cloneElement(Ic.camera, {
    size: 30,
    color: T.t3
  }), "Tap to add a site photo") : React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("img", {
    src: preview,
    alt: "",
    style: {
      width: '100%',
      borderRadius: 14,
      display: 'block'
    }
  }), React.createElement("button", {
    onClick: () => fileRef.current && fileRef.current.click(),
    style: {
      position: 'absolute',
      top: 10,
      right: 10,
      background: 'rgba(0,0,0,.6)',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '6px 12px',
      fontFamily: SF,
      fontSize: 12,
      cursor: 'pointer'
    }
  }, "Change")), preview && !result && React.createElement("button", {
    onClick: analyse,
    disabled: busy,
    style: {
      width: '100%',
      marginTop: 12,
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: busy ? 'default' : 'pointer',
      opacity: busy ? 0.7 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.spark, {
    size: 16
  }), " ", busy ? 'Cortex is looking…' : 'Extract actions'), result && React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, result.summary && React.createElement("div", {
    style: {
      background: `${accent}11`,
      border: `0.5px solid ${accent}33`,
      borderRadius: 12,
      padding: 12,
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, React.cloneElement(Ic.spark, {
    size: 12,
    color: accent
  }), " ", result.summary), (result.items || []).length === 0 ? React.createElement("div", {
    style: {
      textAlign: 'center',
      fontFamily: SF,
      fontSize: 13,
      color: T.t3,
      padding: 20
    }
  }, "Nothing actionable spotted.") : (result.items || []).map((it, i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8
    }
  }, React.createElement(Pill, {
    c: TYPE_C[it.type] || accent,
    size: "xs"
  }, it.type), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1
    }
  }, it.title), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3
    }
  }, it.priority, " priority")), React.createElement("button", {
    onClick: () => file(it, i),
    disabled: filed[i],
    style: {
      background: filed[i] ? T.green : accent,
      color: '#fff',
      border: 'none',
      borderRadius: 9,
      padding: '8px 12px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 700,
      cursor: filed[i] ? 'default' : 'pointer'
    }
  }, filed[i] ? '✓ Added' : 'Create'))))));
}
function InboxTriageSheet({
  onClose,
  accent
}) {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [filed, setFiled] = React.useState(null);
  const triage = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setFiled(null);
    const r = await Backend.ai.triageEmail(text);
    setResult(r);
    setBusy(false);
  };
  const file = async () => {
    if (!result) return;
    const r = await Backend.ai.fileTriage(result);
    setFiled(r);
    if (window.cortexxToast) window.cortexxToast(`Filed as ${r.kind}`, 'success');
  };
  const CAT_C = {
    lead: T.green,
    enquiry: T.green,
    invoice: T.amber,
    supplier: T.blue,
    complaint: T.red,
    other: T.t2
  };
  return React.createElement(Sheet, {
    onClose: onClose
  }, React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 16px 10px'
    }
  }, React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 16,
      cursor: 'pointer'
    }
  }, "Close"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 600,
      color: T.t1,
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, React.cloneElement(Ic.spark, {
    size: 14
  }), " Inbox triage"), React.createElement("div", {
    style: {
      width: 50
    }
  })), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 24px'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginBottom: 10,
      lineHeight: 1.5
    }
  }, "Paste an inbound email (or a WhatsApp/voicemail transcript). Cortex categorises it and files the right record."), React.createElement("textarea", {
    value: text,
    onChange: e => setText(e.target.value),
    rows: 7,
    placeholder: "Paste email text here\u2026",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: 12,
      color: T.t1,
      fontFamily: SF,
      fontSize: 14,
      outline: 'none',
      resize: 'vertical'
    }
  }), React.createElement("button", {
    onClick: triage,
    disabled: busy || !text.trim(),
    style: {
      width: '100%',
      marginTop: 10,
      background: text.trim() ? accent : T.bg3,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '14px',
      fontFamily: SF,
      fontSize: 15,
      fontWeight: 700,
      cursor: busy || !text.trim() ? 'default' : 'pointer',
      opacity: text.trim() ? 1 : 0.5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8
    }
  }, React.cloneElement(Ic.spark, {
    size: 16
  }), " ", busy ? 'Triaging…' : 'Triage'), result && React.createElement("div", {
    style: {
      marginTop: 16,
      background: T.bg2,
      border: `0.5px solid ${T.hair}`,
      borderRadius: 14,
      padding: 16
    }
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, React.createElement(Pill, {
    c: CAT_C[result.category] || T.t2,
    size: "sm"
  }, result.category), React.createElement("span", {
    style: {
      fontFamily: SFMono,
      fontSize: 11,
      color: T.t3
    }
  }, Math.round((result.confidence || 0) * 100), "% confident")), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      lineHeight: 1.5,
      marginBottom: 8
    }
  }, result.summary), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 12,
      color: T.t2,
      marginBottom: 12
    }
  }, "\u2192 ", result.suggestedAction), result.extract && (result.extract.name || result.extract.value) && React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 12
    }
  }, result.extract.name && React.createElement(Pill, {
    c: T.bg3,
    size: "xs"
  }, result.extract.name), result.extract.value && React.createElement(Pill, {
    c: T.bg3,
    size: "xs"
  }, "\xA3", result.extract.value), result.extract.due && React.createElement(Pill, {
    c: T.bg3,
    size: "xs"
  }, "due ", result.extract.due)), filed ? React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.green,
      fontWeight: 600
    }
  }, "\u2713 Filed as ", filed.kind, ": ", filed.record.name || filed.record.title) : React.createElement("button", {
    onClick: file,
    style: {
      width: '100%',
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 11,
      padding: '13px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "File automatically"))));
}
Object.assign(window, {
  PhotoMentionSheet,
  InboxTriageSheet
});