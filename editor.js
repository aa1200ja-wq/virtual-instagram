(() => {
  const R = window.VIEditorRender;
  const S = window.VIStore;
  let items = [], current = 0, selectedLayerId = null, editingId = null;
  let history = [], historyIndex = -1, drag = null, captionImages = [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function defaultItem(source) {
    return { source, crop: 'original', zoom: 1, rotation: 0, flipX: false, panX: 0, panY: 0,
      adjustments: { brightness: 100, contrast: 100, saturation: 100, grayscale: 0, sepia: 0, hue: 0, blur: 0, warmth: 0 }, layers: [] };
  }
  function currentItem() { return items[current] || null; }
  function selectedLayer() { return currentItem()?.layers.find((x) => x.id === selectedLayerId) || null; }
  function cleanItem(item) { return clone(item); }

  function openShell() { $('#composer').classList.add('active'); document.body.classList.add('no-scroll'); }
  function closeShell() { $('#composer').classList.remove('active'); document.body.classList.remove('no-scroll'); reset(); }
  function reset() {
    items = []; current = 0; selectedLayerId = null; editingId = null; captionImages = [];
    history = []; historyIndex = -1; $('#post-file').value = ''; $('#caption-input').value = '';
    $('#location-input').value = ''; $('#tags-input').value = ''; showEditStage(); render();
  }
  function showEditStage() {
    $('#edit-stage').classList.remove('hidden'); $('#caption-stage').classList.add('hidden');
    $('#publish-post').classList.add('hidden'); $('#composer-next').classList.remove('hidden'); $('#composer-title').textContent = editingId ? '編輯貼文' : '編輯';
  }

  async function openNew() { reset(); openShell(); $('#post-file').click(); }
  async function openExisting(post) {
    reset(); editingId = post.id; openShell();
    items = post.draft?.items?.length ? clone(post.draft.items) : (post.images || [post.image]).filter(Boolean).map(defaultItem);
    $('#caption-input').value = post.caption || ''; $('#location-input').value = post.location || ''; $('#tags-input').value = (post.tags || []).join(', ');
    selectItem(0); render();
  }

  async function importFiles(files) {
    const chosen = Array.from(files || []).filter((f) => f.type.startsWith('image/')).slice(0, Math.max(0, 10 - items.length));
    if (!chosen.length) return;
    showBusy(true, '處理照片…');
    try {
      for (const file of chosen) items.push(defaultItem(await R.fileToDataURL(file)));
      selectItem(items.length - chosen.length); render();
    } finally { showBusy(false); }
  }

  function selectItem(index) {
    current = clamp(index, 0, Math.max(0, items.length - 1)); selectedLayerId = currentItem()?.layers.at(-1)?.id || null;
    resetHistory(); render();
  }
  function resetHistory() { history = currentItem() ? [snapshot()] : []; historyIndex = history.length - 1; syncUndo(); }
  function snapshot() {
    const x = currentItem(); if (!x) return null;
    return JSON.stringify({ crop: x.crop, zoom: x.zoom, rotation: x.rotation, flipX: x.flipX, panX: x.panX, panY: x.panY, adjustments: x.adjustments, layers: x.layers });
  }
  function commit() {
    const snap = snapshot(); if (!snap || history[historyIndex] === snap) return;
    history = history.slice(0, historyIndex + 1); history.push(snap); if (history.length > 40) history.shift();
    historyIndex = history.length - 1; syncUndo();
  }
  function applySnapshot(snap) {
    if (!snap || !currentItem()) return; const x = JSON.parse(snap); Object.assign(currentItem(), x);
    selectedLayerId = currentItem().layers.at(-1)?.id || null; render();
  }
  function undo() { if (historyIndex > 0) applySnapshot(history[--historyIndex]); syncUndo(); }
  function redo() { if (historyIndex < history.length - 1) applySnapshot(history[++historyIndex]); syncUndo(); }
  function syncUndo() { $('#editor-undo').disabled = historyIndex <= 0; $('#editor-redo').disabled = historyIndex >= history.length - 1; }

  function render() {
    const item = currentItem();
    $('#editor-empty').classList.toggle('hidden', Boolean(item)); $('#editor-workspace').classList.toggle('hidden', !item);
    renderThumbs(); if (!item) return;
    const frame = $('#editor-frame'), image = $('#editor-image'), ratio = cropPreviewRatio(item);
    frame.style.aspectRatio = String(ratio); if (image.getAttribute('src') !== item.source) image.setAttribute('src', item.source); syncVisual(); renderLayers(); syncControls();
  }
  function cropPreviewRatio(item) {
    const map = { square: 1, portrait: 4 / 5, classic: 3 / 4, story: 9 / 16 };
    if (map[item.crop]) return map[item.crop];
    const img = $('#editor-image'); return img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 4 / 5;
  }
  function syncVisual() {
    const item = currentItem(); if (!item) return; const frame = $('#editor-frame'); const img = $('#editor-image');
    const rect = frame.getBoundingClientRect(); img.style.filter = R.filterString(item.adjustments);
    img.style.transform = `translate(calc(-50% + ${item.panX * rect.width}px),calc(-50% + ${item.panY * rect.height}px)) rotate(${item.rotation}deg) scale(${item.flipX ? -item.zoom : item.zoom},${item.zoom})`;
    const warmth = Number(item.adjustments.warmth || 0); const tint = $('#editor-tint');
    tint.style.background = warmth > 0 ? '#ff8a35' : '#3d7cff'; tint.style.opacity = String(Math.min(.28, Math.abs(warmth) / 350));
  }
  function renderThumbs() {
    const root = $('#editor-thumbs'); root.innerHTML = '';
    items.forEach((item, i) => { const b = document.createElement('button'); b.className = i === current ? 'active' : ''; b.innerHTML = `<img src="${item.source}" alt="第 ${i + 1} 張">`; b.onclick = () => selectItem(i); root.appendChild(b); });
    if (items.length < 10) { const add = document.createElement('button'); add.className = 'add-thumb'; add.textContent = '＋'; add.onclick = () => $('#post-file').click(); root.appendChild(add); }
  }
  function renderLayers() {
    const root = $('#layers-overlay'); root.innerHTML = ''; const item = currentItem(); if (!item) return;
    item.layers.forEach((layer) => {
      const el = document.createElement('div'); el.className = 'overlay-layer' + (layer.id === selectedLayerId ? ' selected' : ''); el.dataset.layerId = layer.id;
      el.textContent = layer.text; el.style.left = `${layer.x * 100}%`; el.style.top = `${layer.y * 100}%`; el.style.fontSize = `${layer.size}px`;
      el.style.color = layer.color; el.style.opacity = layer.opacity; el.style.fontFamily = layer.font; el.style.fontWeight = layer.bold === false ? '400' : '700';
      el.style.transform = `translate(-50%,-50%) rotate(${layer.rotation}deg)`; el.style.background = layer.bgEnabled ? layer.bg : 'transparent';
      el.onpointerdown = (e) => startLayerDrag(e, layer.id); el.onclick = (e) => { e.stopPropagation(); selectedLayerId = layer.id; renderLayers(); syncControls(); };
      root.appendChild(el);
    });
  }

  function addLayer(text, type = 'text') {
    const item = currentItem(); if (!item) return;
    const layer = { id: 'l-' + Date.now() + Math.random().toString(16).slice(2), type, text, x: .5, y: .5, size: type === 'emoji' ? 72 : 48,
      color: '#ffffff', bg: '#000000', bgEnabled: false, opacity: 1, rotation: 0, font: 'Arial', bold: true, shadow: true };
    item.layers.push(layer); selectedLayerId = layer.id; commit(); renderLayers(); syncControls(); showPanel('text');
  }
  function deleteLayer() { const item = currentItem(); if (!item || !selectedLayerId) return; item.layers = item.layers.filter((x) => x.id !== selectedLayerId); selectedLayerId = item.layers.at(-1)?.id || null; commit(); renderLayers(); syncControls(); }

  function syncControls() {
    const item = currentItem(); if (!item) return; const a = item.adjustments, layer = selectedLayer();
    setValue('#zoom-range', item.zoom); setValue('#photo-rotation', item.rotation); setValue('#brightness-range', a.brightness); setValue('#contrast-range', a.contrast);
    setValue('#saturation-range', a.saturation); setValue('#blur-range', a.blur); setValue('#warmth-range', a.warmth);
    $$('[data-crop]').forEach((b) => b.classList.toggle('active', b.dataset.crop === item.crop));
    $('#text-controls').classList.toggle('disabled', !layer); if (!layer) return;
    setValue('#text-content', layer.text); setValue('#text-size', layer.size); setValue('#text-color', layer.color); setValue('#text-opacity', layer.opacity);
    setValue('#text-rotation', layer.rotation); setValue('#text-font', layer.font); $('#text-bold').classList.toggle('active', layer.bold !== false);
    $('#text-bg-enabled').checked = Boolean(layer.bgEnabled); setValue('#text-bg', layer.bg || '#000000');
  }
  function setValue(sel, value) { const el = $(sel); if (el != null && value != null) el.value = value; }
  function showPanel(name) { $$('.tool-panel').forEach((p) => p.classList.add('hidden')); $('#' + name + '-panel')?.classList.remove('hidden'); $$('#editor-tools [data-tool]').forEach((b) => b.classList.toggle('active', b.dataset.tool === name)); }

  function changeAdjustment(key, value) { const item = currentItem(); if (!item) return; item.adjustments[key] = Number(value); syncVisual(); }
  function preset(name) {
    const item = currentItem(); if (!item) return; const p = {
      original: [100,100,100,0,0,0], vivid:[105,108,132,0,0,8], bw:[102,112,0,100,0,0], warm:[103,103,115,0,15,48], cool:[101,105,108,0,0,-48], fade:[110,88,80,0,8,0]
    }[name] || [100,100,100,0,0,0];
    Object.assign(item.adjustments, { brightness:p[0], contrast:p[1], saturation:p[2], grayscale:p[3], sepia:p[4], warmth:p[5], blur:0, hue:0 }); commit(); render();
  }

  function startLayerDrag(e, id) { e.preventDefault(); e.stopPropagation(); selectedLayerId = id; drag = { type:'layer', id }; e.currentTarget.setPointerCapture?.(e.pointerId); renderLayers(); syncControls(); }
  function startPhotoDrag(e) { if (!currentItem() || e.target.closest('.overlay-layer')) return; drag = { type:'photo', x:e.clientX, y:e.clientY, panX:currentItem().panX, panY:currentItem().panY }; }
  function pointerMove(e) {
    if (!drag) return; const frame = $('#editor-frame'), rect = frame.getBoundingClientRect(), item = currentItem(); if (!item) return;
    if (drag.type === 'layer') { const layer = item.layers.find((x) => x.id === drag.id); if (!layer) return; layer.x = clamp((e.clientX - rect.left) / rect.width, .03, .97); layer.y = clamp((e.clientY - rect.top) / rect.height, .03, .97); renderLayers(); }
    if (drag.type === 'photo') { item.panX = drag.panX + (e.clientX - drag.x) / rect.width; item.panY = drag.panY + (e.clientY - drag.y) / rect.height; syncVisual(); }
  }
  function pointerUp() { if (drag) commit(); drag = null; }

  async function next() {
    if (!items.length) return $('#post-file').click(); showBusy(true, '產生預覽…');
    try { captionImages = []; for (const item of items) captionImages.push(await R.renderItem(item)); renderCaptionPreview(); $('#edit-stage').classList.add('hidden'); $('#caption-stage').classList.remove('hidden'); $('#publish-post').classList.remove('hidden'); $('#composer-next').classList.add('hidden'); $('#composer-title').textContent = editingId ? '編輯貼文' : '新貼文'; }
    finally { showBusy(false); }
  }
  function renderCaptionPreview() { const root = $('#caption-preview'); root.innerHTML = ''; captionImages.forEach((src,i) => { const img=document.createElement('img'); img.src=src; img.className=i?'':'active'; img.onclick=()=>$$('#caption-preview img').forEach((x,j)=>x.classList.toggle('active',j===i)); root.appendChild(img); }); $('#caption-count').textContent = `${captionImages.length} 張`; }
  async function publish() {
    if (!items.length) return; showBusy(true, '發布中…');
    try {
      if (!captionImages.length) for (const item of items) captionImages.push(await R.renderItem(item));
      const old = editingId ? (await S.getMyPosts()).find((p) => p.id === editingId) : null;
      const post = { id: editingId || 'me-' + Date.now(), images: captionImages, image: captionImages[0], caption: $('#caption-input').value.trim(), location: $('#location-input').value.trim(), tags: $('#tags-input').value.split(',').map((x)=>x.trim()).filter(Boolean), likes: old?.likes || 0, createdAt: old?.createdAt || Date.now(), draft: { items: items.map(cleanItem) } };
      await S.putMyPost(post); const id = post.id; closeShell(); window.dispatchEvent(new CustomEvent('vi-editor-done', { detail:{ id } }));
    } finally { showBusy(false); }
  }
  function showBusy(on, text='處理中…') { const b=$('#editor-busy'); b.textContent=text; b.classList.toggle('show',on); }

  function bindRange(sel, fn) { $(sel).addEventListener('input', (e)=>fn(e.target.value)); $(sel).addEventListener('change', commit); }
  function init() {
    $('#post-file').multiple = true; $('#post-file').addEventListener('change', async (e)=>{ await importFiles(e.target.files); e.target.value=''; }); $('#pick-photo').onclick=()=>$('#post-file').click();
    $('#composer-close').onclick=closeShell; $('#composer-next').onclick=next; $('#publish-post').onclick=publish; $('#caption-back').onclick=()=>{ $('#caption-stage').classList.add('hidden'); $('#edit-stage').classList.remove('hidden'); $('#publish-post').classList.add('hidden'); $('#composer-next').classList.remove('hidden'); $('#composer-title').textContent='編輯'; };
    $$('#editor-tools [data-tool]').forEach((b)=>b.onclick=()=>showPanel(b.dataset.tool)); $('#editor-undo').onclick=undo; $('#editor-redo').onclick=redo;
    $('#add-text').onclick=()=>addLayer('輸入文字'); $('#delete-layer').onclick=deleteLayer; $$('#emoji-panel [data-emoji]').forEach((b)=>b.onclick=()=>addLayer(b.dataset.emoji,'emoji'));
    $('#text-content').addEventListener('input',(e)=>{const l=selectedLayer();if(l){l.text=e.target.value;renderLayers();}}); $('#text-content').addEventListener('change',commit);
    bindRange('#text-size',(v)=>{const l=selectedLayer();if(l){l.size=Number(v);renderLayers();}}); bindRange('#text-opacity',(v)=>{const l=selectedLayer();if(l){l.opacity=Number(v);renderLayers();}}); bindRange('#text-rotation',(v)=>{const l=selectedLayer();if(l){l.rotation=Number(v);renderLayers();}});
    $('#text-color').oninput=(e)=>{const l=selectedLayer();if(l){l.color=e.target.value;renderLayers();}}; $('#text-color').onchange=commit; $('#text-bg').oninput=(e)=>{const l=selectedLayer();if(l){l.bg=e.target.value;renderLayers();}}; $('#text-bg').onchange=commit;
    $('#text-bg-enabled').onchange=(e)=>{const l=selectedLayer();if(l){l.bgEnabled=e.target.checked;commit();renderLayers();}}; $('#text-font').onchange=(e)=>{const l=selectedLayer();if(l){l.font=e.target.value;commit();renderLayers();}}; $('#text-bold').onclick=()=>{const l=selectedLayer();if(l){l.bold=l.bold===false;commit();renderLayers();syncControls();}};
    $$('[data-preset]').forEach((b)=>b.onclick=()=>preset(b.dataset.preset)); bindRange('#brightness-range',(v)=>changeAdjustment('brightness',v)); bindRange('#contrast-range',(v)=>changeAdjustment('contrast',v)); bindRange('#saturation-range',(v)=>changeAdjustment('saturation',v)); bindRange('#blur-range',(v)=>changeAdjustment('blur',v)); bindRange('#warmth-range',(v)=>changeAdjustment('warmth',v));
    bindRange('#zoom-range',(v)=>{if(currentItem()){currentItem().zoom=Number(v);syncVisual();}}); bindRange('#photo-rotation',(v)=>{if(currentItem()){currentItem().rotation=Number(v);syncVisual();}}); $('#flip-x').onclick=()=>{if(currentItem()){currentItem().flipX=!currentItem().flipX;commit();syncVisual();}};
    $$('[data-crop]').forEach((b)=>b.onclick=()=>{if(currentItem()){currentItem().crop=b.dataset.crop;commit();render();}}); $('#reset-photo').onclick=()=>{const old=currentItem();if(!old)return;const fresh=defaultItem(old.source);fresh.layers=old.layers;items[current]=fresh;commit();render();};
    $('#editor-frame').addEventListener('pointerdown',startPhotoDrag); window.addEventListener('pointermove',pointerMove); window.addEventListener('pointerup',pointerUp); $('#editor-image').addEventListener('load',()=>{const item=currentItem();if(item?.crop==='original'){const img=$('#editor-image');if(img.naturalWidth&&img.naturalHeight)$('#editor-frame').style.aspectRatio=String(img.naturalWidth/img.naturalHeight);syncVisual();}});
  }

  window.VIEditor = { init, openNew, openExisting, close: closeShell };
})();
