// «Примерить на свою стену». Всё происходит в браузере: фото никуда не отправляется.
// Шаги: 1) фото стены, 2) картина с мягкой тенью — её можно двигать, подгонять размер и сохранить.
// Масштаб по умолчанию: ширина фото считается равной примерно 3 м стены; дальше размер подгоняют вручную.
(function () {
  "use strict";

  var dlg = document.querySelector("dialog.tryon");
  var openBtn = document.querySelector("[data-tryon]");
  if (!dlg || !openBtn || typeof dlg.showModal !== "function") {
    if (openBtn) openBtn.hidden = true;
    return;
  }

  var items, slug, paintingsReady;
  var stage = dlg.querySelector(".tryon__stage");
  var canvas = dlg.querySelector(".tryon__canvas");
  var ctx = canvas.getContext("2d");
  var steps = {};
  dlg.querySelectorAll("[data-step]").forEach(function (el) { steps[el.dataset.step] = el; });
  var softInput = dlg.querySelector("[data-softness]");
  var scaleInput = dlg.querySelector("[data-scale]");
  var gapInput = dlg.querySelector("[data-gap]");

  var MAX_SIDE = 2400; // фото уменьшаем до разумного размера
  var APPROX_WALL_CM = 300; // ширина фото ≈ 3 м стены

  var st = {
    mode: "upload",
    photo: null, // canvas с фото стены
    pxPerCm: 0,
    cx: 0, cy: 0,
    manual: 1,
    gap: Number(dlg.dataset.gap) || 0,
    light: "left",
    soft: Number(softInput.value),
    view: 1, // пикселей экрана на пиксель фото
  };

  // ----- картины -----
  // Читаем из data-атрибутов окна. На главной страницах картину выбирают в блоке «Примерка»:
  // скрипт меняет атрибуты и посылает окну событие tryon:set — тогда данные читаются заново.
  function loadItems() {
    items = JSON.parse(dlg.dataset.items);
    slug = dlg.dataset.slug;
    paintingsReady = Promise.all(items.map(function (it) {
      return new Promise(function (res) {
        var im = new Image();
        im.onload = function () { it.img = im; res(); };
        im.onerror = function () { res(); };
        im.src = it.src;
      });
    }));
    return paintingsReady;
  }
  loadItems();
  dlg.addEventListener("tryon:set", function () { loadItems().then(draw); });

  // ----- открыть / закрыть -----
  openBtn.addEventListener("click", function () { dlg.showModal(); fit(); });
  dlg.querySelector("[data-close]").addEventListener("click", function () { dlg.close(); });

  function setMode(m) {
    st.mode = m;
    Object.keys(steps).forEach(function (k) { steps[k].hidden = k !== m; });
    draw();
  }

  // ----- загрузка фото -----
  dlg.querySelectorAll('input[type="file"]').forEach(function (input) {
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      input.value = "";
      if (!file) return;
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, MAX_SIDE / Math.max(im.naturalWidth, im.naturalHeight));
        var c = document.createElement("canvas");
        c.width = Math.round(im.naturalWidth * k);
        c.height = Math.round(im.naturalHeight * k);
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        st.photo = c;
        st.pxPerCm = c.width / APPROX_WALL_CM;
        st.manual = 1;
        scaleInput.value = 100;
        st.cx = c.width / 2;
        st.cy = c.height * 0.4;
        dlg.classList.add("has-photo");
        stage.hidden = false;
        requestAnimationFrame(function () { fit(); setMode("place"); });
      };
      im.onerror = function () { URL.revokeObjectURL(url); };
      im.src = url;
    });
  });

  // ----- размер холста под экран -----
  function fit() {
    if (!st.photo) return;
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var k = Math.min(r.width / st.photo.width, r.height / st.photo.height);
    var w = Math.floor(st.photo.width * k);
    var h = Math.floor(st.photo.height * k);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    st.view = k;
    st.dpr = dpr;
    draw();
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(stage);
  else window.addEventListener("resize", fit);

  // ----- рисование -----
  function paintingRects() {
    var ppc = st.pxPerCm * st.manual;
    var total = 0;
    items.forEach(function (it, i) { total += it.w * ppc + (i ? st.gap * ppc : 0); });
    var maxH = Math.max.apply(null, items.map(function (it) { return it.h * ppc; }));
    var x = st.cx - total / 2;
    return items.map(function (it) {
      var w = it.w * ppc, h = it.h * ppc;
      var r = { it: it, x: x, y: st.cy - maxH / 2 + (maxH - h) / 2, w: w, h: h, depth: it.depth * ppc };
      x += w + st.gap * ppc;
      return r;
    });
  }

  function render(c, scale) {
    c.save();
    c.drawImage(st.photo, 0, 0, st.photo.width * scale, st.photo.height * scale);
    if (st.mode === "place") {
      var soft = st.soft / 100;
      var dir = st.light === "left" ? 1 : -1;
      paintingRects().forEach(function (r) {
        var x = r.x * scale, y = r.y * scale, w = r.w * scale, h = r.h * scale, d = r.depth * scale;
        // мягкая тень от подрамника/рамы: свет сбоку и чуть сверху
        c.save();
        c.shadowColor = "rgba(20, 16, 10, " + (0.5 - soft * 0.22) + ")";
        c.shadowBlur = d * (0.6 + soft * 2.6);
        c.shadowOffsetX = dir * d * 0.75;
        c.shadowOffsetY = d * 0.9;
        c.fillStyle = "#777";
        c.fillRect(x, y, w, h);
        c.restore();
        // плотная контактная тень у самой стены
        c.save();
        c.shadowColor = "rgba(20, 16, 10, .35)";
        c.shadowBlur = Math.max(1, d * 0.25);
        c.shadowOffsetX = dir * d * 0.12;
        c.shadowOffsetY = d * 0.15;
        c.fillStyle = "#777";
        c.fillRect(x, y, w, h);
        c.restore();
        if (r.it.img) c.drawImage(r.it.img, x, y, w, h);
        // лёгкий световой градиент по поверхности
        var g = c.createLinearGradient(x, y, x + w, y);
        g.addColorStop(dir > 0 ? 0 : 1, "rgba(255,255,255,0.05)");
        g.addColorStop(dir > 0 ? 1 : 0, "rgba(0,0,0,0.06)");
        c.fillStyle = g;
        c.fillRect(x, y, w, h);
      });
    }
    c.restore();
  }

  function draw() {
    if (!st.photo) return;
    var s = st.view * st.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    render(ctx, s);
  }

  // ----- касания и мышь -----
  var pointers = new Map();
  var drag = null;

  function toPhoto(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / st.view, y: (e.clientY - r.top) / st.view };
  }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  canvas.addEventListener("pointerdown", function (e) {
    if (!st.photo) return;
    canvas.setPointerCapture(e.pointerId);
    var p = toPhoto(e);
    pointers.set(e.pointerId, p);
    if (st.mode === "place") {
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        drag = { kind: "pinch", d0: dist(pts[0], pts[1]), m0: st.manual, mid: mid(pts), cx: st.cx, cy: st.cy };
      } else {
        drag = { kind: "move", p0: p, cx: st.cx, cy: st.cy };
        canvas.classList.add("is-dragging");
      }
    }
  });
  function mid(pts) { return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; }

  canvas.addEventListener("pointermove", function (e) {
    if (!pointers.has(e.pointerId) || !drag) return;
    var p = toPhoto(e);
    pointers.set(e.pointerId, p);
    if (drag.kind === "move") {
      st.cx = drag.cx + p.x - drag.p0.x;
      st.cy = drag.cy + p.y - drag.p0.y;
    } else if (drag.kind === "pinch" && pointers.size >= 2) {
      var pts = Array.from(pointers.values());
      setManual(drag.m0 * dist(pts[0], pts[1]) / drag.d0);
      var m = mid(pts);
      st.cx = drag.cx + m.x - drag.mid.x;
      st.cy = drag.cy + m.y - drag.mid.y;
    }
    draw();
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    canvas.classList.remove("is-dragging");
    if (drag && drag.kind === "pinch" && pointers.size === 1) {
      var rest = Array.from(pointers.values())[0];
      drag = { kind: "move", p0: rest, cx: st.cx, cy: st.cy };
    } else if (!pointers.size) drag = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", function (e) {
    if (st.mode !== "place") return;
    e.preventDefault();
    setManual(st.manual * Math.exp(-e.deltaY * 0.0015));
    draw();
  }, { passive: false });

  function setManual(v) {
    st.manual = Math.min(3, Math.max(0.2, v));
    scaleInput.value = Math.round(st.manual * 100);
  }

  // ----- настройки тени и размера -----
  dlg.querySelectorAll("[data-light]").forEach(function (b) {
    b.addEventListener("click", function () {
      st.light = b.dataset.light;
      dlg.querySelectorAll("[data-light]").forEach(function (x) { x.setAttribute("aria-checked", String(x === b)); });
      draw();
    });
  });
  softInput.addEventListener("input", function () { st.soft = Number(softInput.value); draw(); });
  scaleInput.addEventListener("input", function () { st.manual = Number(scaleInput.value) / 100; draw(); });
  if (gapInput) gapInput.addEventListener("input", function () { st.gap = Number(gapInput.value); draw(); });

  // ----- сохранить картинку -----
  dlg.querySelector("[data-save]").addEventListener("click", function () {
    var out = document.createElement("canvas");
    out.width = st.photo.width;
    out.height = st.photo.height;
    render(out.getContext("2d"), 1);
    out.toBlob(function (blob) {
      if (!blob) return;
      var name = "primerka-" + slug + ".jpg";
      var file = window.File ? new File([blob], name, { type: "image/jpeg" }) : null;
      var touch = matchMedia("(pointer: coarse)").matches;
      if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function () {});
        return;
      }
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }, "image/jpeg", 0.92);
  });

  paintingsReady.then(draw);
  setMode("upload");
})();
