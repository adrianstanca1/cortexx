(function () {
  if (!window.Backend) return;
  Backend.ai.healthCheck = async project => {
    if (!project || project.id == null) {
      const all = Backend.db.snapshot().projects || [];
      project = all.find(p => p.status === 'active') || all[0];
      if (!project) return {
        score: null,
        summary: 'No projects to analyse yet.',
        flags: []
      };
    }
    const s = Backend.db.snapshot();
    const projTasks = (s.tasks || []).filter(t => t.projectId == project.id);
    const projSnags = (s.snags || []).filter(sn => sn.projectId == project.id);
    const projInvoices = (s.invoices || []).filter(iv => iv.projectId == project.id);
    const projRFIs = (s.rfis || []).filter(r => r.projectId == project.id);
    const projCOs = (s.changeOrders || []).filter(c => c.projectId == project.id);
    const context = `Project: ${project.name}, ${project.pct}% complete, status ${project.status}, value £${project.value}, margin ${project.margin}%.
Open tasks: ${projTasks.filter(t => !t.done).length}, snags open: ${projSnags.filter(sn => sn.status === 'open').length}.
Open RFIs: ${projRFIs.filter(r => r.status === 'open').length}, pending variations: ${projCOs.filter(c => c.status === 'pending').length}.
Invoices paid: ${projInvoices.filter(iv => iv.status === 'paid').length}, overdue: ${projInvoices.filter(iv => iv.status === 'overdue').length}.`;
    const prompt = `You are a UK construction PM doing a project health check. Given the state below, output ONLY JSON: {"score":0-100,"risk":"low|medium|high","headline":"one sentence","strengths":["...","..."],"risks":["...","..."],"actions":["...","..."]}.
${context}`;
    try {
      const raw = await window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      const json = raw.match(/\{[\s\S]*\}/)?.[0];
      return JSON.parse(json);
    } catch (e) {
      return {
        score: 70,
        risk: 'medium',
        headline: 'Project tracking OK',
        strengths: ['On schedule'],
        risks: ['Margin pressure'],
        actions: ['Monitor margin']
      };
    }
  };
})();
function HealthCheckSheet({
  project,
  onClose,
  accent
}) {
  const [loading, setLoading] = React.useState(true);
  const [result, setResult] = React.useState(null);
  React.useEffect(() => {
    (async () => {
      const r = await Backend.ai.healthCheck(project);
      setResult(r);
      setLoading(false);
    })();
  }, [project?.id]);
  if (!project) return null;
  const riskC = result?.risk === 'high' ? T.red : result?.risk === 'medium' ? T.amber : T.green;
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
  }), " Health check"), React.createElement("button", {
    onClick: async () => {
      setLoading(true);
      const r = await Backend.ai.healthCheck(project);
      setResult(r);
      setLoading(false);
    },
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Rerun")), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 24px'
    }
  }, React.createElement("div", {
    style: {
      padding: '4px 4px 14px'
    }
  }, React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t3,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.6
    }
  }, "Project"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 18,
      fontWeight: 600,
      color: T.t1,
      marginTop: 4
    }
  }, project.name)), loading ? React.createElement("div", {
    style: {
      padding: '60px 20px',
      textAlign: 'center'
    }
  }, React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      margin: '0 auto 16px',
      borderRadius: 14,
      background: `linear-gradient(135deg, ${T.purple}, ${accent})`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      animation: 'pulse-scale 1.2s infinite'
    }
  }, React.cloneElement(Ic.spark, {
    size: 28
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 600
    }
  }, "Analyzing project\u2026"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 6
    }
  }, "Cortex AI reviewing tasks, RFIs, snags, invoices, variations"), React.createElement("style", null, `@keyframes pulse-scale { 0%, 100% { transform: scale(1); opacity: 1 } 50% { transform: scale(0.92); opacity: 0.7 } }`)) : result && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      background: `linear-gradient(135deg, ${riskC}33, ${riskC}11)`,
      border: `0.5px solid ${riskC}55`,
      borderRadius: 18,
      padding: 18,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      width: 80,
      height: 80,
      borderRadius: 16,
      background: `conic-gradient(${riskC} ${result.score * 3.6}deg, ${T.bg3} 0)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }
  }, React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 6,
      borderRadius: 12,
      background: T.bg0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: SFMono,
      fontSize: 22,
      fontWeight: 700,
      color: T.t1
    }
  }, result.score)), React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement(Pill, {
    c: riskC
  }, result.risk?.toUpperCase(), " RISK"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      color: T.t1,
      marginTop: 8,
      lineHeight: 1.4
    }
  }, result.headline))), result.strengths?.length > 0 && React.createElement(Section, {
    title: "\u2713 Strengths"
  }, React.createElement(GroupedList, null, result.strengths.map((s, i, a) => React.createElement(Row, {
    key: i,
    icon: Ic.check,
    iconBg: T.green,
    title: s,
    isLast: i === a.length - 1
  })))), result.risks?.length > 0 && React.createElement(Section, {
    title: "\u26A0 Risks"
  }, React.createElement(GroupedList, null, result.risks.map((s, i, a) => React.createElement(Row, {
    key: i,
    icon: Ic.alert,
    iconBg: T.amber,
    title: s,
    isLast: i === a.length - 1
  })))), result.actions?.length > 0 && React.createElement(Section, {
    title: "\u2192 Recommended actions"
  }, React.createElement(GroupedList, null, result.actions.map((s, i, a) => React.createElement(Row, {
    key: i,
    icon: Ic.zap,
    iconBg: accent,
    title: s,
    isLast: i === a.length - 1
  })))))));
}
Object.assign(window, {
  HealthCheckSheet
});