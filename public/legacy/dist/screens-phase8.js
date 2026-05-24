function AddCustomerSheet({
  onClose,
  accent
}) {
  const [f, setF] = React.useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    tag: 'New',
    notes: ''
  });
  const save = async () => {
    if (!f.name) {
      toast('Name required', 'error');
      return;
    }
    await Backend.db.customers.create({
      ...f,
      projects: 0,
      totalValue: 0,
      lastContact: '2026-05-22'
    });
    toast(`${f.name} added`, 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "Add customer",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Name",
    v: f.name,
    onChange: v => setF({
      ...f,
      name: v
    }),
    placeholder: "J. Smith"
  }), React.createElement(FormInput, {
    label: "Email",
    v: f.email,
    onChange: v => setF({
      ...f,
      email: v
    }),
    placeholder: "email@example.com"
  }), React.createElement(FormInput, {
    label: "Phone",
    v: f.phone,
    onChange: v => setF({
      ...f,
      phone: v
    }),
    placeholder: "07700 900 000"
  }), React.createElement(FormInput, {
    label: "Address",
    v: f.address,
    onChange: v => setF({
      ...f,
      address: v
    }),
    placeholder: "District, postcode"
  }), React.createElement(FormSelect, {
    label: "Tag",
    v: f.tag,
    onChange: v => setF({
      ...f,
      tag: v
    }),
    options: [{
      v: 'New',
      l: 'New'
    }, {
      v: 'Active',
      l: 'Active'
    }, {
      v: 'Repeat',
      l: 'Repeat'
    }, {
      v: 'Commercial',
      l: 'Commercial'
    }]
  }), React.createElement(FormTextarea, {
    label: "Notes",
    v: f.notes,
    onChange: v => setF({
      ...f,
      notes: v
    }),
    placeholder: "Anything to remember"
  }));
}
function AddLeadSheet({
  onClose,
  accent
}) {
  const [f, setF] = React.useState({
    name: '',
    inquiry: '',
    value: '',
    source: 'Referral',
    stage: 'new'
  });
  const save = async () => {
    if (!f.name || !f.inquiry) {
      toast('Name and inquiry required', 'error');
      return;
    }
    await Backend.db.leads.create({
      ...f,
      value: parseInt(f.value) || 0,
      updated: '2026-05-22'
    });
    toast('Lead added', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "New lead",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Name",
    v: f.name,
    onChange: v => setF({
      ...f,
      name: v
    }),
    placeholder: "Prospect name"
  }), React.createElement(FormInput, {
    label: "Inquiry",
    v: f.inquiry,
    onChange: v => setF({
      ...f,
      inquiry: v
    }),
    placeholder: "What do they want?"
  }), React.createElement(FormInput, {
    label: "Estimated value (\xA3)",
    v: f.value,
    onChange: v => setF({
      ...f,
      value: v
    }),
    type: "number"
  }), React.createElement(FormSelect, {
    label: "Source",
    v: f.source,
    onChange: v => setF({
      ...f,
      source: v
    }),
    options: [{
      v: 'Referral',
      l: 'Referral'
    }, {
      v: 'Website',
      l: 'Website'
    }, {
      v: 'Linkedin',
      l: 'LinkedIn'
    }, {
      v: 'Walk-in',
      l: 'Walk-in'
    }, {
      v: 'Other',
      l: 'Other'
    }]
  }));
}
function AddPermitSheet({
  onClose,
  accent
}) {
  const projects = useDB('projects');
  const [f, setF] = React.useState({
    kind: 'Hot work',
    projectId: projects[0]?.id,
    area: '',
    expires: '2026-05-23'
  });
  const save = async () => {
    if (!f.area) {
      toast('Area required', 'error');
      return;
    }
    await Backend.db.permits.create({
      ...f,
      issued: '2026-05-22',
      issuer: 'You',
      signed: false
    });
    toast('Permit drafted', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "New permit",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormSelect, {
    label: "Type",
    v: f.kind,
    onChange: v => setF({
      ...f,
      kind: v
    }),
    options: [{
      v: 'Hot work',
      l: 'Hot work'
    }, {
      v: 'Working at height',
      l: 'Working at height'
    }, {
      v: 'Confined space',
      l: 'Confined space'
    }, {
      v: 'Electrical isolation',
      l: 'Electrical isolation'
    }, {
      v: 'Excavation',
      l: 'Excavation'
    }]
  }), React.createElement(FormSelect, {
    label: "Project",
    v: f.projectId,
    onChange: v => setF({
      ...f,
      projectId: parseInt(v)
    }),
    options: projects.map(p => ({
      v: p.id,
      l: p.name
    }))
  }), React.createElement(FormInput, {
    label: "Area / location",
    v: f.area,
    onChange: v => setF({
      ...f,
      area: v
    }),
    placeholder: "Roof / 2nd floor / basement"
  }), React.createElement(FormInput, {
    label: "Expires",
    v: f.expires,
    onChange: v => setF({
      ...f,
      expires: v
    }),
    placeholder: "YYYY-MM-DD"
  }));
}
function AddGoalSheet({
  onClose,
  accent
}) {
  const [f, setF] = React.useState({
    label: '',
    target: '',
    current: '0',
    unit: '£',
    period: 'Month'
  });
  const save = async () => {
    if (!f.label || !f.target) {
      toast('Label and target required', 'error');
      return;
    }
    await Backend.db.goals.create({
      ...f,
      target: parseFloat(f.target) || 0,
      current: parseFloat(f.current) || 0,
      c: '#10b981'
    });
    toast('Goal added', 'success');
    onClose();
  };
  return React.createElement(FormSheet, {
    title: "New goal",
    onClose: onClose,
    accent: accent,
    onSave: save
  }, React.createElement(FormInput, {
    label: "Label",
    v: f.label,
    onChange: v => setF({
      ...f,
      label: v
    }),
    placeholder: "e.g. Monthly revenue"
  }), React.createElement(FormInput, {
    label: "Target",
    v: f.target,
    onChange: v => setF({
      ...f,
      target: v
    }),
    type: "number"
  }), React.createElement(FormInput, {
    label: "Current",
    v: f.current,
    onChange: v => setF({
      ...f,
      current: v
    }),
    type: "number"
  }), React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, React.createElement(FormSelect, {
    label: "Unit",
    v: f.unit,
    onChange: v => setF({
      ...f,
      unit: v
    }),
    options: [{
      v: '£',
      l: '£'
    }, {
      v: '%',
      l: '%'
    }, {
      v: '',
      l: 'Count'
    }]
  }), React.createElement(FormSelect, {
    label: "Period",
    v: f.period,
    onChange: v => setF({
      ...f,
      period: v
    }),
    options: [{
      v: 'Week',
      l: 'Week'
    }, {
      v: 'Month',
      l: 'Month'
    }, {
      v: 'Quarter',
      l: 'Quarter'
    }, {
      v: 'Year',
      l: 'Year'
    }]
  })));
}
Object.assign(window, {
  AddCustomerSheet,
  AddLeadSheet,
  AddPermitSheet,
  AddGoalSheet
});