(function () {
  if (window.cortexxPhotoStore) return;
  const DB_NAME = 'cortexx_photos';
  const STORE = 'photos';
  let dbPromise = null;
  const openDB = () => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, {
            keyPath: 'id',
            autoIncrement: true
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  };
  const tx = async (mode, fn) => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      const result = fn(store);
      t.oncomplete = () => resolve(result?.target?.result ?? result);
      t.onerror = () => reject(t.error);
    });
  };
  window.cortexxPhotoStore = {
    async save(file, meta = {}) {
      const blob = file instanceof Blob ? file : new Blob([file]);
      const record = {
        blob,
        name: meta.name || 'photo.jpg',
        type: blob.type || 'image/jpeg',
        size: blob.size,
        projectId: meta.projectId || null,
        when: new Date().toISOString().slice(0, 16),
        tags: meta.tags || []
      };
      return tx('readwrite', store => store.add(record));
    },
    async list() {
      return tx('readonly', store => {
        const req = store.getAll();
        return new Promise(r => {
          req.onsuccess = () => r(req.result || []);
        });
      }).then(res => res);
    },
    async listSync() {
      try {
        return await this.list();
      } catch (e) {
        return [];
      }
    },
    async remove(id) {
      return tx('readwrite', store => store.delete(id));
    },
    async clear() {
      return tx('readwrite', store => store.clear());
    },
    blobURL(blob) {
      return URL.createObjectURL(blob);
    }
  };
})();
function usePhotos() {
  const [photos, setPhotos] = React.useState([]);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const list = await window.cortexxPhotoStore.list();
      if (alive) setPhotos(list.reverse());
    })();
    return () => {
      alive = false;
    };
  }, []);
  const refresh = async () => {
    const list = await window.cortexxPhotoStore.list();
    setPhotos(list.reverse());
  };
  return [photos, refresh];
}
function PhotosV2Screen({
  accent
}) {
  const [photos, refresh] = usePhotos();
  const fileInput = React.useRef(null);
  const [viewing, setViewing] = React.useState(null);
  const handleFile = async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      await window.cortexxPhotoStore.save(f, {
        name: f.name,
        projectId: 1
      });
    }
    await refresh();
    if (files.length > 0) toast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`, 'success');
    e.target.value = '';
  };
  return React.createElement(ScreenBg, {
    accent: accent
  }, React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      paddingBottom: 30
    }
  }, React.createElement(MobileHeader, {
    title: "Photos",
    subtitle: `${photos.length} stored locally · IndexedDB`,
    right: React.createElement("button", {
      onClick: () => fileInput.current?.click(),
      style: {
        width: 36,
        height: 36,
        borderRadius: 18,
        background: accent,
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.cloneElement(Ic.camera, {
      size: 18
    }))
  }), React.createElement("input", {
    ref: fileInput,
    type: "file",
    accept: "image/*",
    multiple: true,
    capture: "environment",
    onChange: handleFile,
    style: {
      display: 'none'
    }
  }), photos.length === 0 ? React.createElement("div", {
    onClick: () => fileInput.current?.click(),
    style: {
      margin: '4px 16px',
      padding: '40px 20px',
      border: `1.5px dashed ${T.hairStrong}`,
      background: T.bg2,
      borderRadius: 14,
      textAlign: 'center',
      cursor: 'pointer'
    }
  }, React.createElement("div", {
    style: {
      color: accent,
      fontSize: 36,
      marginBottom: 8
    }
  }, React.cloneElement(Ic.camera, {
    size: 36
  })), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 14,
      color: T.t1,
      fontWeight: 600
    }
  }, "Tap to take or pick photos"), React.createElement("div", {
    style: {
      fontFamily: SF,
      fontSize: 11,
      color: T.t2,
      marginTop: 4
    }
  }, "Stored locally \xB7 works offline")) : React.createElement("div", {
    style: {
      padding: '0 16px'
    }
  }, React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: 4
    }
  }, photos.map(p => {
    const url = window.cortexxPhotoStore.blobURL(p.blob);
    return React.createElement("div", {
      key: p.id,
      onClick: () => setViewing({
        ...p,
        url
      }),
      style: {
        aspectRatio: '1',
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        background: `url(${url}) center/cover`,
        border: `0.5px solid ${T.hair}`,
        position: 'relative'
      }
    }, React.createElement("div", {
      style: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        fontFamily: SFMono,
        fontSize: 8,
        padding: '1px 4px',
        borderRadius: 3
      }
    }, Math.round(p.size / 1024), "kb"));
  }))), viewing && React.createElement("div", {
    onClick: () => setViewing(null),
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.95)',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      justifyContent: 'space-between'
    }
  }, React.createElement("button", {
    onClick: () => setViewing(null),
    style: {
      background: 'none',
      border: 'none',
      color: '#fff',
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer'
    }
  }, "Close"), React.createElement("button", {
    onClick: async e => {
      e.stopPropagation();
      await window.cortexxPhotoStore.remove(viewing.id);
      await refresh();
      setViewing(null);
      toast('Photo deleted', 'success');
    },
    style: {
      background: 'none',
      border: 'none',
      color: T.red,
      fontFamily: SF,
      fontSize: 15,
      cursor: 'pointer'
    }
  }, "Delete")), React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16
    }
  }, React.createElement("img", {
    src: viewing.url,
    style: {
      maxWidth: '100%',
      maxHeight: '100%',
      borderRadius: 12
    }
  })), React.createElement("div", {
    onClick: e => e.stopPropagation()
  }, window.PhotoVisionAction && React.createElement(PhotoVisionAction, {
    blob: viewing.blob,
    accent: accent
  })), React.createElement("div", {
    style: {
      padding: 16,
      color: '#fff',
      fontFamily: SF,
      fontSize: 12,
      textAlign: 'center'
    }
  }, viewing.name, " \xB7 ", new Date(viewing.when).toLocaleString('en-GB')))));
}
Object.assign(window, {
  usePhotos,
  PhotosV2Screen
});