// Список страниц работ (картины и диптихи) на обоих языках — из catalog.json.
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("./catalog.json", import.meta.url), "utf8"));
const LANGS = ["ru", "en"];

export default function () {
  const list = [];
  for (const lang of LANGS) {
    for (const work of catalog.works) list.push({ lang, type: "work", slug: work.slug, item: work });
    for (const d of catalog.diptychs) list.push({ lang, type: "diptych", slug: d.slug, item: d });
  }
  return list;
}
