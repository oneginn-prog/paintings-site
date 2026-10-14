// Небольшие улучшения страницы: FAQ, копирование текста для Telegram,
// увеличение фото по клику и карусель интерьеров.
(function () {
  "use strict";

  // ----- Уведомление внизу экрана -----
  var toastEl = document.querySelector(".toast");
  var toastTimer;
  function toast(text) {
    if (!toastEl) return;
    // поверх открытого окна (например, примерки) уведомление тоже должно быть видно
    (document.querySelector("dialog[open]") || document.body).appendChild(toastEl);
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4000);
  }
  window.siteToast = toast;

  // ----- «Как заказать»: открыть нужный вопрос FAQ -----
  function openFaqFromHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    if (!id) return;
    var el = document.getElementById(id);
    if (el && el.tagName === "DETAILS") el.open = true;
  }
  window.addEventListener("hashchange", openFaqFromHash);
  openFaqFromHash();
  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href*='#faq-']");
    if (!a) return;
    var id = a.getAttribute("href").split("#")[1];
    var el = document.getElementById(id);
    if (el && el.tagName === "DETAILS") el.open = true;
  });

  // ----- «Написать в Telegram»: копируем готовый текст и открываем чат -----
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  }
  var copiedText = document.documentElement.lang === "en" ? "Text copied — paste it into the chat" : "Текст скопирован — вставьте его в чат";
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-copy]");
    if (!a) return;
    // Ссылка открывается сама (без задержки, чтобы браузер не заблокировал окно)
    copyText(a.getAttribute("data-copy")).then(function (ok) { if (ok) toast(copiedText); });
  });

  // ----- Увеличение по клику -----
  var box = document.querySelector(".lightbox");
  if (box && typeof box.showModal === "function") {
    var img = box.querySelector("img");
    var prevBtn = box.querySelector(".lightbox__nav--prev");
    var nextBtn = box.querySelector(".lightbox__nav--next");
    var group = [];
    var index = 0;

    function show(i) {
      index = (i + group.length) % group.length;
      var link = group[index];
      var thumb = link.querySelector("img");
      img.src = link.href;
      img.alt = thumb ? thumb.alt : "";
      var many = group.length > 1;
      prevBtn.hidden = nextBtn.hidden = !many;
    }
    document.addEventListener("click", function (e) {
      var link = e.target.closest("a[data-lightbox]");
      if (!link || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      group = Array.prototype.slice.call(document.querySelectorAll('a[data-lightbox="' + link.dataset.lightbox + '"]'));
      show(group.indexOf(link));
      box.showModal();
    });
    prevBtn.addEventListener("click", function () { show(index - 1); });
    nextBtn.addEventListener("click", function () { show(index + 1); });
    box.querySelector(".lightbox__close").addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.tagName === "FIGURE") box.close(); });
    box.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(index - 1);
      if (e.key === "ArrowRight") show(index + 1);
    });
    box.addEventListener("close", function () { img.removeAttribute("src"); });
    // свайп на телефоне
    var startX = null;
    box.addEventListener("touchstart", function (e) { startX = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    box.addEventListener("touchend", function (e) {
      if (startX === null || group.length < 2) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }

  // ----- Карусель интерьеров (свайп работает сам, стрелки — для компьютера) -----
  document.querySelectorAll("[data-carousel]").forEach(function (c) {
    var track = c.querySelector(".carousel__track");
    var btns = c.querySelectorAll(".carousel__btn");
    if (!btns.length) return;
    var nav = c.querySelector(".carousel__nav");
    function update() {
      nav.hidden = track.scrollWidth <= track.clientWidth + 2;
      var max = track.scrollWidth - track.clientWidth - 2;
      btns[0].disabled = track.scrollLeft <= 2;
      btns[1].disabled = track.scrollLeft >= max;
    }
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        var slide = track.querySelector(".carousel__slide");
        var step = slide ? slide.getBoundingClientRect().width + 20 : track.clientWidth;
        track.scrollBy({ left: step * Number(b.dataset.dir), behavior: "smooth" });
      });
    });
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  });
})();
