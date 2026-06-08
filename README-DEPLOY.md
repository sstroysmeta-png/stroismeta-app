# СтройСмета — Развёртывание и безопасность

Полный набор файлов для публикации приложения. Ниже — что в комплекте и что сделать по шагам.

## Что в папке

| Файл | Назначение |
|------|-----------|
| `index.html` | Само приложение (исправлено: добавлены иконки и PWA-метатеги). |
| `manifest.json` | Манифест PWA — имя, иконки, цвета. Раньше отсутствовал. |
| `sw.js` | Service worker — офлайн-режим и кэш. Раньше отсутствовал. |
| `icon-192.png`, `icon-512.png`, `icon-512-maskable.png` | Иконки приложения. |
| `apple-touch-icon.png`, `favicon.ico` | Иконки для iOS и вкладки браузера. |
| `worker.js` | Защищённый Cloudflare Worker (прокси к Claude). |
| `wrangler.toml` | Конфиг воркера. |
| `firestore.rules` | Правила безопасности базы данных. |
| `.gitignore` | Защита секретов от попадания в Git. |

> Все файлы, кроме `worker.js` / `wrangler.toml` / `firestore.rules`, должны лежать в **корне** сайта (рядом друг с другом).

---

## Шаг 1. Cloudflare Worker (прокси к Claude) — САМОЕ ВАЖНОЕ

Воркер прячет платный ключ Anthropic и пускает запросы только с вашего домена.

```bash
npm install -g wrangler
wrangler login

# 1) Впишите свой будущий домен в wrangler.toml → ALLOWED_ORIGINS
#    (после Шага 2 вернётесь и поставите точный адрес с Vercel)

# 2) Положите секретный ключ Anthropic (его берёте на console.anthropic.com):
wrangler secret put ANTHROPIC_API_KEY
#    вставьте ключ вида sk-ant-... и нажмите Enter

# 3) Опубликуйте воркер:
wrangler deploy
```

После деплоя адрес воркера должен совпадать с тем, что в `index.html`:
`https://stroismeta-proxy.sstroysmeta.workers.dev`
Если ваш аккаунт даёт другой поддомен — поправьте адрес в `index.html` (там два вызова `fetch(...)`).

**Проверка защиты:** запрос с чужого сайта вернёт 403, ключ Anthropic никуда не утекает.

---

## Шаг 2. Хостинг приложения (Vercel)

```bash
npm install -g vercel
cd <папка-с-index.html>
vercel --prod
```

Vercel выдаст адрес, например `https://stroismeta.vercel.app`.
Возьмите его и:
1. Впишите в `wrangler.toml` → `ALLOWED_ORIGINS`, затем снова `wrangler deploy`.
2. Добавьте в Firebase (Шаг 3, Authorized domains).

> Альтернатива: Firebase Hosting (`firebase deploy`) или GitHub Pages — тоже подойдут, главное обслуживать файлы из корня.

---

## Шаг 3. Firebase Console (console.firebase.google.com → проект `stroismeta-39ae1`)

1. **Authentication → Sign-in method:** включить **Phone** и **Email/Password**.
2. **Authentication → Settings → Authorized domains:** добавить ваш домен
   (`stroismeta.vercel.app`). Без этого вход по телефону и reCAPTCHA НЕ работают.
3. **Firestore Database:** если базы нет — создать (в режиме Production).
4. **Firestore → Rules:** вставить содержимое `firestore.rules` и опубликовать.
   Можно из консоли командой:
   ```bash
   firebase deploy --only firestore:rules
   ```

> Про ключ `AIzaSy...` в `index.html`: это нормально. Веб-ключ Firebase —
> публичный идентификатор, а не секрет. Защита обеспечивается правилами
> Firestore (Шаг 3.4) и списком разрешённых доменов (Шаг 3.2).

---

## Шаг 4. Проверка, что всё работает

Откройте сайт, нажмите F12 (консоль):
- должно появиться `[СтройСмета] Firebase подключён ✅`;
- проверьте регистрацию/вход по телефону (придёт SMS-код);
- проверьте распознавание планировки по фото (идёт через воркер к Claude);
- в адресной строке должна появиться возможность «Установить приложение» (PWA).

---

## Сводка по безопасности (что сделано)

- ✅ Ключ Anthropic скрыт в воркере, во фронтенде его нет.
- ✅ Воркер принимает запросы только с разрешённых доменов (`ALLOWED_ORIGINS`).
- ✅ Воркер ограничивает модель и `max_tokens` — нельзя заказать дорогой запрос.
- ✅ Ограничение размера тела запроса (8 МБ).
- ✅ Правила Firestore: пользователь видит только свои данные.
- ✅ `.gitignore` не даёт залить секреты в Git.
- ✅ Service worker не кэширует запросы к Firebase и к прокси (живые данные).

### Рекомендации на будущее (не обязательно для запуска)
- Включить **Firebase App Check** и проверять его токен в воркере — это закроет
  воркер от автоматических ботов ещё надёжнее, чем проверка Origin.
- Добавить лимит запросов на пользователя (Rate Limiting) в Cloudflare.
