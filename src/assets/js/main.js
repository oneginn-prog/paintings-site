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

  // ----- Меню на телефоне: полоски поворачиваются на 90° по часовой, панель — продолжение шапки -----
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("site-menu");
  if (burger && menu) {
    var setMenu = function (open) {
      burger.setAttribute("aria-expanded", String(open));
      burger.classList.toggle("is-open", open);
      menu.classList.toggle("is-open", open);
      menu.inert = !open;
    };
    var isOpen = function () { return burger.getAttribute("aria-expanded") === "true"; };
    burger.addEventListener("click", function () { setMenu(!isOpen()); });
    // пункт меню, нажатие вне панели, Escape, переход на широкий экран — закрывают меню
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
    document.addEventListener("click", function (e) {
      if (isOpen() && !e.target.closest(".menu") && !e.target.closest(".burger")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) { setMenu(false); burger.focus(); }
    });
    var wide = window.matchMedia("(min-width: 861px)");
    var onWide = function () { if (wide.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener("change", onWide); else wide.addListener(onWide);
  }

  // ----- Блок «Примерка»: выбор картины для окна примерки -----
  var pick = document.querySelector("[data-pick]");
  var tryonDlg = document.querySelector("dialog.tryon");
  if (pick && tryonDlg) {
    var radios = Array.prototype.slice.call(pick.querySelectorAll("[role=radio]"));
    var pickTitle = pick.querySelector("[data-pick-title]");
    var pickSize = pick.querySelector("[data-pick-size]");
    var select = function (btn, focus) {
      radios.forEach(function (r) {
        r.setAttribute("aria-checked", String(r === btn));
        r.tabIndex = r === btn ? 0 : -1;
      });
      if (focus) btn.focus();
      pickTitle.textContent = btn.dataset.title;
      pickSize.textContent = btn.dataset.size;
      // данные для окна примерки: размеры и глубина рамы берутся из каталога
      tryonDlg.dataset.items = JSON.stringify([{ src: btn.dataset.src, w: Number(btn.dataset.w), h: Number(btn.dataset.h), depth: Number(btn.dataset.depth) }]);
      tryonDlg.dataset.slug = btn.dataset.slug;
      tryonDlg.dataset.title = btn.dataset.title;
      tryonDlg.dataset.message = btn.dataset.message;
      var em = tryonDlg.querySelector(".tryon__title em");
      if (em) em.textContent = btn.dataset.title;
      tryonDlg.querySelectorAll("[data-copy]").forEach(function (a) { a.setAttribute("data-copy", btn.dataset.message); });
      tryonDlg.dispatchEvent(new Event("tryon:set"));
    };
    radios.forEach(function (r, i) {
      r.tabIndex = i === 0 ? 0 : -1;
      r.addEventListener("click", function () { select(r, false); });
      r.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        select(radios[(i + d + radios.length) % radios.length], true);
      });
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

// Яндекс Метрика (счётчик 113713345) и цели: клик в Telegram, клик по почте.
(function (m, e, t, r, i, k, a) {
  m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
  m[i].l = 1 * new Date();
  for (var j = 0; j < document.scripts.length; j++) { if (document.scripts[j].src === r) { return; } }
  k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a);
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js?id=113713345", "ym");
ym(113713345, "init", { ssr: true, webvisor: true, clickmap: true, ecommerce: "dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce: true, trackLinks: true });
document.addEventListener("click", function (ev) {
  var link = ev.target.closest && ev.target.closest("a[href]");
  if (!link) return;
  var href = link.getAttribute("href") || "";
  if (href.indexOf("t.me/") !== -1) ym(113713345, "reachGoal", "telegram");
  else if (href.indexOf("mailto:") === 0) ym(113713345, "reachGoal", "email");
}, true);
