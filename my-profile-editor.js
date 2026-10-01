(function () {
  const api = {};
  const fileInput = document.querySelector('.me-file-input');
  const sheet = document.querySelector('.create-sheet');
  const editor = document.querySelector('.post-editor');
  const caption = document.querySelector('.post-caption');

  let file, previewUrl, filter = 'none', zoom = 1, rotation = 0, overlayText = '';

  api.init = function () {
    bindCreateSheet();
    bindFlow();
    bindTools();
  };

  function bindCreateSheet() {
    document.querySelector('[data-add-post]')?.addEventListener('click', openSheet);
    document.querySelector('.me-empty__add')?.addEventListener('click', openSheet);
    sheet.querySelector('.screen-backdrop').addEventListener('click', closeSheet);
    document.querySelector('[data-create-post]').addEventListener('click', () => {
      closeSheet();
      fileInput.click();
    });
    document.querySelector('[data-create-reel]').addEventListener('click', showReelToast);
    fileInput.addEventListener('change', handleFile);
  }

  function bindFlow() {
    document.querySelector('.flow-close').addEventListener('click', resetFlow);
    document.querySelector('.post-editor__next').addEventListener('click', openCaption);
    document.querySelector('.caption-back').addEventListener('click', backToEditor);
    document.querySelector('.caption-share').addEventListener('click', publish);
  }

  function bindTools() {
    document.querySelectorAll('[data-editor-tool]').forEach((button) => {
      button.addEventListener('click', () => togglePanel(button.dataset.editorTool));
    });
    document.querySelector('.editor-text-input').addEventListener('input', (event) => {
      overlayText = event.target.value;
      document.querySelector('.editor-text-overlay').textContent = overlayText;
    });
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.addEventListener('click', () => setFilter(button.dataset.filter, button));
    });
    document.querySelector('.editor-zoom').addEventListener('input', (event) => {
      zoom = Number(event.target.value);
      syncPreview();
    });
    document.querySelector('.editor-rotate').addEventListener('click', () => {
      rotation = (rotation + 90) % 360;
      syncPreview();
    });
    document.querySelector('.editor-reset').addEventListener('click', resetEdits);
  }

  function openSheet() {
    sheet.classList.add('create-sheet--open');
    sheet.setAttribute('aria-hidden','false');
  }
  function closeSheet() {
    sheet.classList.remove('create-sheet--open');
    sheet.setAttribute('aria-hidden','true');
  }
  function showReelToast() {
    closeSheet();
    const toast = document.querySelector('.reel-toast');
    toast.classList.add('reel-toast--show');
    setTimeout(() => toast.classList.remove('reel-toast--show'), 1400);
  }

  function handleFile() {
    const picked = fileInput.files?.[0];
    if (!picked || !picked.type.startsWith('image/')) return;
    file = picked;
    previewUrl = URL.createObjectURL(file);
    document.querySelector('.post-editor__image').src = previewUrl;
    editor.classList.add('post-editor--open');
    editor.setAttribute('aria-hidden','false');
    resetEdits();
  }

  function togglePanel(name) {
    document.querySelectorAll('.editor-panel').forEach((panel) => panel.hidden = true);
    const panel = document.querySelector('.editor-panel--' + name);
    if (panel) panel.hidden = false;
  }

  function setFilter(value, button) {
    filter = value;
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('is-active'));
    button.classList.add('is-active');
    syncPreview();
  }

  function syncPreview() {
    const image = document.querySelector('.post-editor__image');
    image.style.filter = filter;
    image.style.transform = 'rotate(' + rotation + 'deg) scale(' + zoom + ')';
  }

  function resetEdits() {
    filter = 'none';
    zoom = 1;
    rotation = 0;
    overlayText = '';
    document.querySelector('.editor-text-input').value = '';
    document.querySelector('.editor-text-overlay').textContent = '';
    document.querySelector('.editor-zoom').value = '1';
    document.querySelectorAll('.editor-panel').forEach((panel) => panel.hidden = true);
    document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('is-active'));
    document.querySelector('[data-filter="none"]').classList.add('is-active');
    syncPreview();
  }

  async function openCaption() {
    if (!file) return;
    const blob = await renderEditedBlob();
    caption.dataset.previewBlobUrl && URL.revokeObjectURL(caption.dataset.previewBlobUrl);
    const url = URL.createObjectURL(blob);
    caption.dataset.previewBlobUrl = url;
    document.querySelector('.post-caption__image').src = url;
    editor.classList.remove('post-editor--open');
    caption.classList.add('post-caption--open');
    caption.setAttribute('aria-hidden','false');
  }

  function backToEditor() {
    caption.classList.remove('post-caption--open');
    editor.classList.add('post-editor--open');
  }

  async function publish() {
    if (!file) return;
    const blob = await renderEditedBlob();
    const text = document.querySelector('.post-caption__text').value.trim();
    window.dispatchEvent(new CustomEvent('my-profile-publish', {
      detail: { blob, caption: text }
    }));
    resetFlow();
  }

  function resetFlow() {
    editor.classList.remove('post-editor--open');
    caption.classList.remove('post-caption--open');
    editor.setAttribute('aria-hidden','true');
    caption.setAttribute('aria-hidden','true');
    document.querySelector('.post-caption__text').value = '';
    fileInput.value = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (caption.dataset.previewBlobUrl) URL.revokeObjectURL(caption.dataset.previewBlobUrl);
    previewUrl = null;
    file = null;
    resetEdits();
  }

  async function renderEditedBlob() {
    const bitmap = await createImageBitmap(file);
    const rad = rotation * Math.PI / 180;
    const swap = rotation % 180 !== 0;
    const baseW = swap ? bitmap.height : bitmap.width;
    const baseH = swap ? bitmap.width : bitmap.height;
    const canvas = document.createElement('canvas');
    canvas.width = baseW;
    canvas.height = baseH;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(baseW / 2, baseH / 2);
    ctx.rotate(rad);
    ctx.scale(zoom, zoom);
    ctx.filter = filter;
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    ctx.restore();

    if (overlayText) {
      ctx.font = '700 ' + Math.max(28, Math.round(baseW * .055)) + 'px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(3, Math.round(baseW * .006));
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.fillStyle = '#fff';
      ctx.strokeText(overlayText, baseW / 2, baseH / 2, baseW * .82);
      ctx.fillText(overlayText, baseW / 2, baseH / 2, baseW * .82);
    }

    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .92));
  }

  window.MyProfileEditor = api;
})();
