(function () {
  window.cortexxUniversalUpload = async (opts = {}) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = opts.accept || 'image/*,application/pdf,.dwg,.xlsx,.xls,.doc,.docx,.zip';
    input.multiple = opts.multiple !== false;
    input.style.display = 'none';
    document.body.appendChild(input);
    return new Promise(resolve => {
      input.onchange = async e => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
          resolve([]);
          document.body.removeChild(input);
          return;
        }
        const results = [];
        for (const f of files) {
          const ext = f.name.split('.').pop().toLowerCase();
          const isImage = f.type.startsWith('image/');
          const isDwg = ext === 'dwg';
          if (isImage && window.cortexxPhotoStore) {
            await window.cortexxPhotoStore.save(f, {
              name: f.name,
              projectId: opts.projectId || null
            });
            results.push({
              kind: 'photo',
              name: f.name
            });
          } else if (isDwg && window.Backend?.db?.drawings) {
            await Backend.db.drawings.create({
              name: f.name.replace(/\.[a-z]+$/i, ''),
              projectId: opts.projectId || 1,
              version: 'v1',
              updated: new Date().toISOString().slice(0, 10),
              markups: 0,
              type: 'plan'
            });
            results.push({
              kind: 'drawing',
              name: f.name
            });
          } else if (window.Backend?.db?.documents) {
            await Backend.db.documents.create({
              name: f.name,
              type: ext,
              size: Math.round(f.size / 1024),
              projectId: opts.projectId || 1,
              folder: opts.folder || 'Uploads',
              uploaded: new Date().toISOString().slice(0, 10),
              updatedBy: 'You'
            });
            results.push({
              kind: 'document',
              name: f.name
            });
          }
        }
        if (window.cortexxToast) {
          const grouped = results.reduce((a, r) => ({
            ...a,
            [r.kind]: (a[r.kind] || 0) + 1
          }), {});
          const summary = Object.entries(grouped).map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(', ');
          window.cortexxToast(`Uploaded ${summary}`, 'success');
        }
        document.body.removeChild(input);
        resolve(results);
      };
      input.oncancel = () => {
        document.body.removeChild(input);
        resolve([]);
      };
      input.click();
    });
  };
})();
function FloatingUploadPill({
  accent,
  bottom = 158
}) {
  return React.createElement("button", {
    onClick: () => window.cortexxUniversalUpload(),
    style: {
      position: 'absolute',
      left: 14,
      bottom,
      zIndex: 8,
      width: 'auto',
      height: 38,
      borderRadius: 19,
      padding: '0 12px 0 10px',
      background: 'rgba(6,16,30,0.85)',
      backdropFilter: 'blur(20px) saturate(180%)',
      border: `0.5px solid ${T.hairMid}`,
      color: T.t1,
      cursor: 'pointer',
      boxShadow: `0 4px 14px rgba(0,0,0,0.4)`,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontFamily: SF,
      fontSize: 12,
      fontWeight: 600
    }
  }, React.createElement("span", {
    style: {
      color: accent || T.cyan
    }
  }, React.cloneElement(Ic.upload, {
    size: 14
  })), React.createElement("span", null, "Upload"));
}
Object.assign(window, {
  FloatingUploadPill
});