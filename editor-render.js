(() => {
  const cropMap = { square: 1, portrait: 4 / 5, classic: 3 / 4, story: 9 / 16 };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src;
    });
  }

  async function fileToDataURL(file, maxSide = 1600, quality = .86) {
    const src = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
    const img = await loadImage(src);
    const ratio = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  }

  function filterString(a = {}) {
    const b = a.brightness ?? 100, c = a.contrast ?? 100, s = a.saturation ?? 100;
    const g = a.grayscale ?? 0, p = a.sepia ?? 0, h = a.hue ?? 0, blur = a.blur ?? 0;
    return `brightness(${b}%) contrast(${c}%) saturate(${s}%) grayscale(${g}%) sepia(${p}%) hue-rotate(${h}deg) blur(${blur}px)`;
  }

  function cropRatio(item, img) {
    return cropMap[item.crop] || img.naturalWidth / img.naturalHeight;
  }

  function outputSize(ratio) {
    if (ratio >= 1) return { width: 1080, height: Math.max(1, Math.round(1080 / ratio)) };
    return { width: Math.max(1, Math.round(1080 * ratio)), height: 1080 };
  }

  function drawLayer(ctx, layer, width, height) {
    const text = String(layer.text || ''); if (!text) return;
    const size = Math.max(12, width * Number(layer.size || 48) / 720);
    const family = layer.font || 'Arial';
    ctx.save();
    ctx.globalAlpha = Number(layer.opacity ?? 1);
    ctx.translate(width * Number(layer.x ?? .5), height * Number(layer.y ?? .5));
    ctx.rotate(Number(layer.rotation || 0) * Math.PI / 180);
    ctx.font = `${layer.bold === false ? 400 : 700} ${size}px ${family}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lines = text.split('\n').slice(0, 5);
    const lineH = size * 1.18;
    const widest = Math.max(...lines.map((line) => ctx.measureText(line).width), size);
    const boxH = lineH * lines.length;
    if (layer.bgEnabled) {
      ctx.fillStyle = layer.bg || '#000000';
      ctx.fillRect(-widest / 2 - size * .22, -boxH / 2 - size * .12, widest + size * .44, boxH + size * .24);
    }
    ctx.fillStyle = layer.color || '#ffffff';
    if (layer.shadow !== false) { ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = size * .12; ctx.shadowOffsetY = size * .05; }
    lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lineH, width * .86));
    ctx.restore();
  }

  async function renderItem(item, quality = .84) {
    const img = await loadImage(item.source);
    const ratio = cropRatio(item, img); const out = outputSize(ratio);
    const canvas = document.createElement('canvas'); canvas.width = out.width; canvas.height = out.height;
    const ctx = canvas.getContext('2d');
    const angle = Number(item.rotation || 0) * Math.PI / 180;
    const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
    const rotW = img.naturalWidth * cos + img.naturalHeight * sin;
    const rotH = img.naturalWidth * sin + img.naturalHeight * cos;
    const baseScale = Math.max(out.width / rotW, out.height / rotH) * Number(item.zoom || 1);
    ctx.save();
    ctx.translate(out.width * (.5 + Number(item.panX || 0)), out.height * (.5 + Number(item.panY || 0)));
    ctx.rotate(angle); ctx.scale((item.flipX ? -1 : 1) * baseScale, baseScale);
    ctx.filter = filterString(item.adjustments);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
    const warmth = Number(item.adjustments?.warmth || 0);
    if (warmth) {
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = Math.min(.28, Math.abs(warmth) / 350);
      ctx.fillStyle = warmth > 0 ? '#ff8a35' : '#3d7cff'; ctx.fillRect(0, 0, out.width, out.height); ctx.restore();
    }
    (item.layers || []).forEach((layer) => drawLayer(ctx, layer, out.width, out.height));
    return canvas.toDataURL('image/jpeg', quality);
  }

  window.VIEditorRender = { fileToDataURL, renderItem, filterString, cropRatio };
})();