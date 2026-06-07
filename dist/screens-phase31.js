// Cortexx — Phase 31: Sticky AI assistant pill across the app

(function () {
  if (!window.cortexxAIPill) {
    window.cortexxAIPill = true;
  }
})();

// A floating universal AI access button — installed once, surfaces on every screen
// Wires into existing 'ai' navigation
function FloatingAIPill({
  accent
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => window.cortexxNav && window.cortexxNav('ai'),
    style: {
      position: 'absolute',
      bottom: 100,
      right: 14,
      zIndex: 8,
      width: collapsed ? 44 : 'auto',
      height: 44,
      borderRadius: 22,
      padding: collapsed ? 0 : '0 14px 0 12px',
      background: `linear-gradient(135deg, ${T.purple}, ${accent || T.blue})`,
      border: 'none',
      color: '#fff',
      cursor: 'pointer',
      boxShadow: `0 8px 24px ${T.purple}66`,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontFamily: SF,
      fontSize: 13,
      fontWeight: 700
    }
  }, React.cloneElement(Ic.spark, {
    size: 20
  }), !collapsed && /*#__PURE__*/React.createElement("span", null, "Ask Cortex"));
}
Object.assign(window, {
  FloatingAIPill
});