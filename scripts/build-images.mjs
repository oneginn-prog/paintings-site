// Делает из исходников в materials/ оптимизированные копии для сайта (WebP + JPEG
// нескольких размеров) и пишет их список в src/_data/images.json.
// Исходники не меняются. Уже готовые копии повторно не пересчитываются.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const MATERIALS = path.join(ROOT, "materials");
const OUT = path.join(ROOT, ".cache", "img");
const MANIFEST = path.join(ROOT, "src", "_data", "images.json");
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "_data", "catalog.json"), "utf8"));

const WIDTHS = [600, 800, 1200, 2048];
const BG = { r: 246, g: 243, b: 238 };

// Имена файлов с Mac бывают в разложенной форме Unicode (й = и + ˘),
// поэтому ищем файлы, сравнивая нормализованные имена.
const nfc = (s) => s.normalize("NFC");
function resolve(rel) {
  let cur = MATERIALS;
  for (const part of nfc(rel).split("/")) {
    const hit = fs.readdirSync(cur).find((n) => nfc(n) === part);
    if (!hit) throw new Error(`Не найден файл: materials/${rel}`);
    cur = path.join(cur, hit);
  }
  return cur;
}
function listDir(rel) {
  const dir = resolve(rel);
  return fs
    .readdirSync(dir)
    .filter((n) => /\.(jpe?g|png)$/i.test(n))
    .sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b))
    .map((n) => ({ file: path.join(dir, n), name: nfc(n) }));
}

// Отпечатки исходников: если файл не менялся и копии уже есть — пропускаем.
// (По времени изменения судить нельзя: после git clone оно у всех файлов новое.)
const STAMPS = path.join(OUT, "sources.json");
const stamps = fs.existsSync(STAMPS) ? JSON.parse(fs.readFileSync(STAMPS, "utf8")) : {};
const hashOf = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");

async function variants(src, group, name, widths = WIDTHS) {
  const meta = await sharp(src).rotate().metadata();
  const srcW = meta.autoOrient?.width ?? meta.width;
  const srcH = meta.autoOrient?.height ?? meta.height;
  const dir = path.join(OUT, group);
  fs.mkdirSync(dir, { recursive: true });
  let list = widths.filter((w) => w < srcW);
  if (list.length < widths.length) list.push(Math.min(srcW, widths[widths.length - 1]));
  list = [...new Set(list)];
  const key = `${group}/${name}`;
  const hash = hashOf(src);
  const same = stamps[key] === hash;
  for (const w of list) {
    for (const fmt of ["webp", "jpg"]) {
      const out = path.join(dir, `${name}-${w}.${fmt}`);
      if (same && fs.existsSync(out)) continue;
      const img = sharp(src).rotate().resize({ width: w, withoutEnlargement: true });
      if (fmt === "webp") await img.webp({ quality: 80 }).toFile(out);
      else await img.jpeg({ quality: 82, mozjpeg: true, progressive: true }).toFile(out);
    }
  }
  stamps[key] = hash;
  return {
    src: `/img/${group}/${name}`,
    width: srcW,
    height: srcH,
    widths: list,
  };
}

async function og(out, compose, sources) {
  const key = "og:" + path.relative(OUT, out);
  const hash = sources.map(hashOf).join(",");
  if (stamps[key] === hash && fs.existsSync(out)) return;
  stamps[key] = hash;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await compose(out);
}

// Картинка для соцсетей 1200×630: одна или две работы на светлом фоне.
async function ogPaintings(out, files) {
  await og(out, async (out) => {
    const H = 470;
    const parts = await Promise.all(
      files.map((f) => sharp(f).rotate().resize({ height: H, width: files.length > 1 ? 480 : 1000, fit: "inside" }).toBuffer({ resolveWithObject: true }))
    );
    const gap = 40;
    const total = parts.reduce((s, p) => s + p.info.width, 0) + gap * (parts.length - 1);
    let x = Math.round((1200 - total) / 2);
    const layers = parts.map((p) => {
      const l = { input: p.data, left: x, top: Math.round((630 - p.info.height) / 2) };
      x += p.info.width + gap;
      return l;
    });
    await sharp({ create: { width: 1200, height: 630, channels: 3, background: BG } })
      .composite(layers)
      .jpeg({ quality: 85 })
      .toFile(out);
  }, files);
}

function kindOf(name) {
  if (/подпис/i.test(name)) return "signature";
  if (/рама/i.test(name)) return "frame";
  if (/торец/i.test(name)) return "edge";
  return "texture";
}

const manifest = { works: {}, diptychs: {} };
const t0 = Date.now();

for (const w of catalog.works) {
  const g = `works/${w.slug}`;
  const entry = { main: await variants(resolve(w.photo), g, "main"), interiors: [], details: [] };
  for (const [i, f] of listDir(w.interiors).entries()) entry.interiors.push(await variants(f.file, g, `interior-${i + 1}`));
  if (w.details) {
    for (const [i, f] of listDir(w.details).entries()) {
      entry.details.push({ ...(await variants(f.file, g, `detail-${i + 1}`)), kind: kindOf(f.name) });
    }
  }
  const ogFile = path.join(OUT, g, "og.jpg");
  await ogPaintings(ogFile, [resolve(w.photo)]);
  entry.og = `/img/${g}/og.jpg`;
  manifest.works[w.slug] = entry;
}

for (const d of catalog.diptychs) {
  const g = `works/${d.slug}`;
  const entry = { interiors: [] };
  for (const [i, f] of listDir(d.interiors).entries()) entry.interiors.push(await variants(f.file, g, `interior-${i + 1}`));
  const files = d.parts.map((s) => resolve(catalog.works.find((w) => w.slug === s).photo));
  await ogPaintings(path.join(OUT, g, "og.jpg"), files);
  entry.og = `/img/${g}/og.jpg`;
  manifest.diptychs[d.slug] = entry;
}

const heroSrc = resolve(catalog.hero);
manifest.hero = await variants(heroSrc, "site", "hero", [800, 1200, 1600, 2048]);
manifest.portrait = await variants(resolve(catalog.portrait), "site", "portrait", [600, 896]);
manifest.portraitQuote = await variants(resolve(catalog.portraitQuote), "site", "portrait-quote", [600, 896]);
manifest.portraitFull = await variants(resolve(catalog.portraitFull), "site", "portrait-full", [600, 896]);

// Обложка главной для соцсетей: кадр с диваном и растениями.
await og(path.join(OUT, "site", "og.jpg"), async (out) => {
  const m = await sharp(heroSrc).metadata();
  const h = Math.round((m.width * 630) / 1200);
  await sharp(heroSrc)
    .extract({ left: 0, top: Math.round(m.height * 0.47), width: m.width, height: h })
    .resize(1200, 630)
    .jpeg({ quality: 85 })
    .toFile(out);
}, [heroSrc]);
manifest.og = "/img/site/og.jpg";

fs.writeFileSync(STAMPS, JSON.stringify(stamps));
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`[images] готово за ${((Date.now() - t0) / 1000).toFixed(1)} с`);
