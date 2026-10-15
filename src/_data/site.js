// Общие настройки сайта. Адрес сайта при публикации подставляет GitHub Actions.
export default {
  url: (process.env.SITE_URL || "http://localhost:8080").replace(/\/$/, ""),
  telegram: "https://t.me/goodery",
  telegramHandle: "@goodery",
  email: "vadim.gusef@gmail.com",
  year: 2026,
};
