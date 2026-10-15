// Настройки генератора сайта Eleventy.
import { HtmlBasePlugin } from "@11ty/eleventy";

const NBSP = " ";

export default function (eleventyConfig) {
  // Сайт на GitHub Pages живёт в подпапке (/paintings-site/) — плагин сам допишет её ко всем ссылкам.
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ ".cache/img": "img" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Шрифт Inter (вариативный): русская и латинская части, прямой и курсив.
  for (const style of ["normal", "italic"]) {
    for (const sub of ["cyrillic", "latin"]) {
      const f = `inter-${sub}-wght-${style}.woff2`;
      eleventyConfig.addPassthroughCopy({ [`node_modules/@fontsource-variable/inter/files/${f}`]: `assets/fonts/${f}` });
    }
  }
  eleventyConfig.addWatchTarget("src/assets/");

  // 63000 → «63 000 ₽»
  eleventyConfig.addFilter("price", (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) + NBSP + "₽");
  // Подстановка {title} и т.п. в строку перевода
  eleventyConfig.addFilter("fill", (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? ""));
  eleventyConfig.addFilter("bySlug", (list, slug) => list.find((x) => x.slug === slug));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  // Адрес той же страницы на другом языке
  eleventyConfig.addFilter("otherLang", (url, lang) => {
    if (url === "/404.html") return "/en/";
    return lang === "ru" ? "/en" + url : url.replace(/^\/en/, "") || "/";
  });
  // 3–4 других работы: следующие по порядку после текущей
  eleventyConfig.addFilter("moreWorks", (works, exclude, n = 4) => {
    const start = Math.max(0, works.findIndex((w) => exclude.includes(w.slug)));
    const out = [];
    for (let i = 1; out.length < n && i <= works.length; i++) {
      const w = works[(start + i) % works.length];
      if (!exclude.includes(w.slug)) out.push(w);
    }
    return out;
  });

  // <picture> с WebP и запасным JPEG нескольких размеров.
  // img — запись из images.json; sizes — подсказка браузеру о ширине на экране.
  eleventyConfig.addShortcode("picture", function (img, alt, sizes, opts = {}) {
    const set = (ext) => img.widths.map((w) => `${img.src}-${w}.${ext} ${w}w`).join(", ");
    const fallbackW = img.widths.find((w) => w >= 800) ?? img.widths[img.widths.length - 1];
    const h = Math.round((img.height / img.width) * 1000);
    const esc = String(alt).replace(/"/g, "&quot;");
    return `<picture${opts.pictureClass ? ` class="${opts.pictureClass}"` : ""}><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img src="${img.src}-${fallbackW}.jpg" srcset="${set("jpg")}" sizes="${sizes}" width="1000" height="${h}" alt="${esc}"${opts.cls ? ` class="${opts.cls}"` : ""} ${opts.eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></picture>`;
  });
  // Адрес с учётом подпапки сайта на GitHub Pages — для ссылок внутри JSON/скриптов,
  // которые Eleventy сам не исправляет.
  const base = (process.env.PATH_PREFIX || "/").replace(/\/$/, "");
  eleventyConfig.addFilter("withBase", (u) => base + u);
  // Самый большой вариант — для увеличения по клику
  eleventyConfig.addFilter("full", (img) => `${img.src}-${img.widths[img.widths.length - 1]}.jpg`);
  eleventyConfig.addFilter("mid", (img) => `${img.src}-${img.widths.find((w) => w >= 1200) ?? img.widths[img.widths.length - 1]}.jpg`);

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    pathPrefix: process.env.PATH_PREFIX || "/",
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
