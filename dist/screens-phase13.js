// Cortexx — Phase 13: Photo annotation viewer for snags

function PhotoAnnotateSheet({
  snag,
  onClose,
  accent
}) {
  const [pins, setPins] = React.useState([]);
  const [adding, setAdding] = React.useState(false);
  const [activePin, setActivePin] = React.useState(null);
  const [pinNote, setPinNote] = React.useState('');
  const handleClick = e => {
    if (!adding) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 100;
    const y = (e.clientY - rect.top) / rect.height * 100;
    const newPin = {
      id: pins.length + 1,
      x,
      y,
      note: 'New annotation'
    };
    setPins([...pins, newPin]);
    setActivePin(newPin.id);
    setPinNote('');
    setAdding(false);
  };
  const savePin = () => {
    setPins(pins.map(p => p.id === activePin ? {
      ...p,
      note: pinNote || 'Annotation'
    } : p));
    setActivePin(null);
    setPinNote('');
    toast('Annotation saved', 'success');
  };
  const deletePin = id => {
    setPins(pins.filter(p => p.id !== id));
    setActivePin(null);
    toast('Annotation removed', 'info');
  };
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    fullscreen: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '12px 16px',
      borderBottom: `0.5px solid ${T.hair}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 2
    }
  }, Ic.chevL, " ", /*#__PURE__*/React.createElement("span", null, "Back")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      color: T.t1
    }
  }, snag?.title || 'Photo'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: SFMono,
      fontSize: 10,
      color: T.t3,
      marginTop: 1
    }
  }, pins.length, " annotation", pins.length !== 1 ? 's' : '')), /*#__PURE__*/React.createElement("button", {
    onClick: () => toast('Photo shared', 'success'),
    style: {
      background: 'none',
      border: 'none',
      color: accent,
      fontFamily: SF,
      fontSize: 14,
      cursor: 'pointer'
    }
  }, "Share")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#0a0e16',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: handleClick,
    style: {
      width: '100%',
      height: '100%',
      background: `linear-gradient(135deg, #1a3a5c, #2c3a5c, #3a2c5c)`,
      cursor: adding ? 'crosshair' : 'default',
      position: 'relative',
      backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(225deg, rgba(255,255,255,0.04) 25%, transparent 25%)',
      backgroundSize: '60px 60px'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "100%",
    height: "100%",
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "65%",
    width: "100%",
    height: "6%",
    fill: "rgba(60,40,20,0.4)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "71%",
    width: "100%",
    height: "3%",
    fill: "rgba(80,60,40,0.3)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "60%",
    y: "20%",
    width: "22%",
    height: "55%",
    fill: "none",
    stroke: "rgba(255,255,255,0.15)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "60%",
    y: "20%",
    width: "22%",
    height: "55%",
    fill: "rgba(80,60,40,0.2)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "10%",
    y: "22%",
    width: "20%",
    height: "30%",
    fill: "rgba(140,180,220,0.15)",
    stroke: "rgba(255,255,255,0.2)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "20%",
    y1: "22%",
    x2: "20%",
    y2: "52%",
    stroke: "rgba(255,255,255,0.15)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: "50%",
    y: "80%",
    textAnchor: "middle",
    fontSize: "9",
    fill: "rgba(255,255,255,0.3)",
    fontFamily: SFMono
  }, "SITE PHOTO \xB7 CAMDEN \xB7 ", new Date().toLocaleDateString('en-GB'))), pins.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    style: {
      position: 'absolute',
      left: `${p.x}%`,
      top: `${p.y}%`,
      transform: 'translate(-50%, -100%)',
      cursor: 'pointer'
    },
    onClick: e => {
      e.stopPropagation();
      setActivePin(p.id);
      setPinNote(p.note);
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "32",
    height: "42",
    viewBox: "0 0 32 42",
    style: {
      filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M16 0 C7 0 0 7 0 16 C0 28 16 42 16 42 C16 42 32 28 32 16 C32 7 25 0 16 0 Z",
    fill: T.amber
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "16",
    r: "9",
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("text", {
    x: "16",
    y: "20",
    textAnchor: "middle",
    fontSize: "12",
    fontWeight: "700",
    fontFamily: SF,
    fill: T.bg0
  }, i + 1)))), activePin && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 90,
      left: 16,
      right: 16,
      background: 'rgba(6,16,30,0.95)',
      backdropFilter: 'blur(20px)',
      border: `0.5px solid ${T.amber}66`,
      borderRadius: 14,
      padding: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 11,
      background: T.amber,
      color: T.bg0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 700
    }
  }, pins.findIndex(p => p.id === activePin) + 1), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.amber,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 0.4
    }
  }, "Annotation"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => deletePin(activePin),
    style: {
      background: 'none',
      border: 'none',
      color: T.red,
      cursor: 'pointer',
      fontFamily: SF,
      fontSize: 11,
      fontWeight: 600
    }
  }, "Remove")), /*#__PURE__*/React.createElement("input", {
    value: pinNote,
    onChange: e => setPinNote(e.target.value),
    autoFocus: true,
    placeholder: "Note (e.g. 'Touch up paint here')",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: T.bg2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 8,
      padding: '8px 10px',
      color: T.t1,
      fontFamily: SF,
      fontSize: 13,
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: savePin,
    style: {
      flex: 1,
      background: T.green,
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      padding: '8px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Save"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setActivePin(null),
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 8,
      padding: '8px 14px',
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Done"))), adding && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 16,
      left: 16,
      right: 16,
      background: `${T.amber}22`,
      border: `0.5px solid ${T.amber}66`,
      borderRadius: 10,
      padding: '8px 12px',
      fontFamily: SF,
      fontSize: 12,
      color: T.t1,
      textAlign: 'center',
      fontWeight: 600
    }
  }, "Tap the photo to drop a pin"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 12px 30px',
      borderTop: `0.5px solid ${T.hair}`,
      display: 'flex',
      gap: 8,
      background: T.bg0
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setAdding(!adding),
    style: {
      flex: 1,
      background: adding ? T.amber : T.bg2,
      color: adding ? T.bg0 : T.t1,
      border: adding ? 'none' : `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px',
      fontFamily: SF,
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6
    }
  }, React.cloneElement(Ic.pin, {
    size: 14
  }), " ", adding ? 'Cancel' : 'Add pin'), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setPins([]);
      toast('Cleared', 'info');
    },
    style: {
      background: 'transparent',
      color: T.t2,
      border: `0.5px solid ${T.hairMid}`,
      borderRadius: 12,
      padding: '12px 14px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Clear"), /*#__PURE__*/React.createElement("button", {
    onClick: async () => {
      await Backend.db.activity.create({
        who: 'You',
        what: `annotated photo with ${pins.length} pins`,
        where: snag?.area || 'Site',
        when: new Date().toISOString().slice(0, 16),
        icon: 'camera',
        color: '#8b5cf6'
      });
      toast(`Saved ${pins.length} annotation${pins.length !== 1 ? 's' : ''}`, 'success');
      onClose();
    },
    style: {
      background: accent,
      color: '#fff',
      border: 'none',
      borderRadius: 12,
      padding: '12px 16px',
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, "Done")));
}
Object.assign(window, {
  PhotoAnnotateSheet
});