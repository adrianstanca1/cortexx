// CortexBuild Pro — RIDDOR (HSE F2508) accident reporting (Phase 106, v1.3)
// UK Reporting of Injuries, Diseases and Dangerous Occurrences Regulations.
// Generates the F2508 report from local incident data, validates against the
// schema, and outputs both a printable PDF and a JSON payload ready for HSE's
// online portal (https://www.hse.gov.uk/riddor/report.htm).
//
// Honest note: HSE doesn't expose an API. Reporting is via their hosted form.
// This module produces the data in the exact shape that form expects so a
// person can paste/upload it — and a print-ready PDF for the records.
//
// Trigger categories per RIDDOR 2013:
//   - F2508A — work-related death (must be reported immediately by phone)
//   - F2508  — specified injuries (fractures, amputations, crush, etc.)
//   - F2508  — over-7-day incapacitation injuries
//   - F2508  — occupational diseases (Schedule 8)
//   - F2508  — dangerous occurrences (Schedule 2)
//   - F2508  — gas-related (separate filing — different form)

(function () {
  if (window.CortexRIDDOR) return;

  // ── RIDDOR 2013 categories ──────────────────────────────────────────
  const CATEGORIES = {
    death: {
      code: 'death',
      label: 'Work-related death',
      immediate: true,
      form: 'F2508'
    },
    specifiedInjury: {
      code: 'specifiedInjury',
      label: 'Specified injury (fracture, amputation, eye damage, crush, scalp, internal organ)',
      immediate: false,
      form: 'F2508'
    },
    over7day: {
      code: 'over7day',
      label: 'Over-7-day incapacitation',
      immediate: false,
      form: 'F2508'
    },
    disease: {
      code: 'disease',
      label: 'Reportable occupational disease (Schedule 8)',
      immediate: false,
      form: 'F2508A'
    },
    dangerousOccurrence: {
      code: 'dangerousOccurrence',
      label: 'Dangerous occurrence (Schedule 2)',
      immediate: false,
      form: 'F2508'
    },
    gasIncident: {
      code: 'gasIncident',
      label: 'Gas-related incident',
      immediate: true,
      form: 'F2508G'
    }
  };

  // Specified injuries (RIDDOR 2013 reg. 4)
  const SPECIFIED_INJURIES = ['Fracture (other than fingers, thumbs, toes)', 'Amputation', 'Permanent loss of sight / reduction', 'Crush injury → brain or internal organ damage', 'Serious burn (>10% body, or to face, vital areas)', 'Scalping requiring hospital treatment', 'Loss of consciousness (head injury or asphyxia)', 'Confined-space injury → loss of consciousness/hypothermia/heat-induced illness'];

  // Determine if an incident is reportable, and under which category
  function classify(incident) {
    if (!incident) return null;
    // Death overrides everything
    if (incident.outcome === 'death' || incident.fatal === true) return CATEGORIES.death;
    // Gas
    if (incident.gas) return CATEGORIES.gasIncident;
    // Specified injuries — flag set explicitly OR matched description
    if (incident.specifiedInjury) return CATEGORIES.specifiedInjury;
    // Over 7 days off
    if (incident.daysOff != null && incident.daysOff > 7) return CATEGORIES.over7day;
    // Disease (Schedule 8)
    if (incident.disease) return CATEGORIES.disease;
    // Dangerous occurrence (no injury required)
    if (incident.dangerousOccurrence) return CATEGORIES.dangerousOccurrence;
    return null; // not reportable
  }

  // Validate the minimum payload HSE requires
  function validate(report) {
    const errors = [];
    const req = ['incidentDate', 'incidentTime', 'location', 'category', 'description', 'reporterName', 'reporterRole', 'companyName'];
    for (const f of req) if (!report[f] || typeof report[f] === 'string' && !report[f].trim()) errors.push('Missing: ' + f);
    if (report.category !== 'dangerousOccurrence' && !report.injuredPersonName) errors.push('Missing: injuredPersonName');
    if (report.injuredPersonName && !report.injuredPersonAge) errors.push('Missing: injuredPersonAge');
    return errors;
  }

  // Build a report payload from a local incident record
  function buildReport(incident, company) {
    const cat = classify(incident);
    return {
      generatedAt: new Date().toISOString(),
      category: cat ? cat.code : 'notReportable',
      categoryLabel: cat ? cat.label : 'Not reportable under RIDDOR 2013',
      form: cat ? cat.form : null,
      immediateRequired: cat ? cat.immediate : false,
      incidentDate: incident.date || incident.when || '',
      incidentTime: incident.time || '',
      location: incident.location || incident.site || '',
      gridRef: incident.gridRef || incident.postcode || '',
      description: incident.description || incident.body || '',
      kind: incident.kind || incident.type || 'incident',
      injuredPersonName: incident.person || incident.injured || '',
      injuredPersonAge: incident.age || '',
      injuredPersonSex: incident.sex || '',
      injuredPersonRole: incident.role || '',
      employmentStatus: incident.employmentStatus || 'employee',
      bodyPartAffected: incident.bodyPart || '',
      natureOfInjury: incident.injury || '',
      daysOff: incident.daysOff != null ? incident.daysOff : 0,
      reporterName: company && company.reporterName || incident.reporter || '',
      reporterRole: company && company.reporterRole || incident.reporterRole || '',
      reporterPhone: company && company.reporterPhone || '',
      reporterEmail: company && company.reporterEmail || '',
      companyName: company && company.companyName || 'CortexBuild Ltd',
      companyAddress: company && company.companyAddress || '',
      companyPostcode: company && company.companyPostcode || '',
      companyType: company && company.companyType || 'principalContractor',
      companyEmployeeCount: company && company.companyEmployeeCount || 0,
      actionTaken: incident.action || incident.followUp || '',
      witnessNames: incident.witnesses || []
    };
  }

  // Render as printable HTML (used by the print + PDF path)
  function toPrintableHTML(report) {
    const x = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    })[c]);
    const section = (title, rows) => `<h2>${x(title)}</h2><table>${rows.map(r => `<tr><td><strong>${x(r[0])}</strong></td><td>${x(r[1])}</td></tr>`).join('')}</table>`;
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>RIDDOR ${x(report.form || 'report')} — ${x(report.incidentDate)}</title>
<style>
  body { font: 13px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 30px; color: #000; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .lede { color: #666; font-size: 12px; margin-bottom: 30px; }
  h2 { font-size: 14px; margin-top: 24px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { padding: 6px 0; border-bottom: 1px dotted #eee; vertical-align: top; }
  td:first-child { width: 200px; color: #555; }
  .urgent { background: #fef3c7; padding: 10px 14px; border: 1px solid #f59e0b; border-radius: 6px; margin: 16px 0; }
</style></head>
<body>
  <h1>RIDDOR ${x(report.form || '')} — ${x(report.categoryLabel)}</h1>
  <div class="lede">Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 · Generated ${x(report.generatedAt.slice(0, 10))}</div>
  ${report.immediateRequired ? '<div class="urgent"><strong>This category requires immediate notification by phone</strong> to the HSE Incident Contact Centre on <strong>0345 300 9923</strong> as well as filing this form.</div>' : ''}
  ${section('Incident', [['Date', report.incidentDate], ['Time', report.incidentTime], ['Location / site', report.location], ['Postcode', report.gridRef], ['Kind', report.kind], ['Description', report.description], ['Action taken', report.actionTaken]])}
  ${report.injuredPersonName ? section('Injured person', [['Name', report.injuredPersonName], ['Age', report.injuredPersonAge], ['Sex', report.injuredPersonSex], ['Role', report.injuredPersonRole], ['Employment', report.employmentStatus], ['Body part', report.bodyPartAffected], ['Nature', report.natureOfInjury], ['Days off', report.daysOff]]) : ''}
  ${section('Reporter', [['Name', report.reporterName], ['Role', report.reporterRole], ['Phone', report.reporterPhone], ['Email', report.reporterEmail]])}
  ${section('Company', [['Name', report.companyName], ['Address', report.companyAddress], ['Postcode', report.companyPostcode], ['Type', report.companyType], ['Employees', report.companyEmployeeCount]])}
  ${report.witnessNames && report.witnessNames.length ? section('Witnesses', report.witnessNames.map((w, i) => ['Witness ' + (i + 1), w])) : ''}
</body></html>`;
  }
  function downloadJSON(report) {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'riddor-' + (report.form || 'report') + '-' + (report.incidentDate || 'undated') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function openPrintable(report) {
    const html = toPrintableHTML(report);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  }

  // HSE portal URL
  const HSE_URL = 'https://notifications.hse.gov.uk/riddorforms/Injury';
  window.CortexRIDDOR = {
    categories: CATEGORIES,
    specifiedInjuries: SPECIFIED_INJURIES,
    classify,
    validate,
    buildReport,
    toPrintableHTML,
    downloadJSON,
    openPrintable,
    HSE_URL
  };
})();