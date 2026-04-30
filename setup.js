#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 *  СтройСмета — Автоматическая установка
 *  Запуск: node setup.js
 *
 *  Что делает:
 *  1. Проверяет и устанавливает нужные инструменты
 *  2. Создаёт Firebase проект (Auth + Firestore)
 *  3. Создаёт GitHub репозиторий и включает Pages
 *  4. Загружает файлы приложения
 *  5. Вставляет Firebase-ключи в HTML
 *  6. Выводит готовые ссылки
 *
 *  Нужно от вас: 2 входа в браузере (Google + GitHub)
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { execSync, spawnSync } = require("child_process");
const fs   = require("fs");
const path = require("path");
const os   = require("os");
const readline = require("readline");

// ── Цвета для терминала ──────────────────────────────────────────
const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
  blue:   "\x1b[34m",
  grey:   "\x1b[90m",
};
const ok  = (s) => console.log(`${C.green}✅ ${s}${C.reset}`);
const err = (s) => console.log(`${C.red}❌ ${s}${C.reset}`);
const inf = (s) => console.log(`${C.cyan}ℹ️  ${s}${C.reset}`);
const hdr = (s) => console.log(`\n${C.bold}${C.blue}━━━ ${s} ━━━${C.reset}\n`);
const warn= (s) => console.log(`${C.yellow}⚠️  ${s}${C.reset}`);

// ── Утилиты ──────────────────────────────────────────────────────
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${C.yellow}❓ ${question}${C.reset} `, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: opts.silent ? "pipe" : "inherit", ...opts });
  } catch (e) {
    if (opts.ok) return "";
    throw e;
  }
}

function runSilent(cmd) {
  return run(cmd, { silent: true });
}

function commandExists(cmd) {
  try {
    execSync(`${os.platform() === "win32" ? "where" : "which"} ${cmd}`, { stdio: "pipe" });
    return true;
  } catch { return false; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── ШАГИ ─────────────────────────────────────────────────────────

async function checkNode() {
  hdr("ШАГ 1 / 7 — Проверка инструментов");
  const ver = process.version;
  const major = parseInt(ver.slice(1));
  if (major < 18) {
    err(`Node.js ${ver} слишком старый. Нужен v18+.`);
    inf("Скачайте: https://nodejs.org → LTS версия");
    process.exit(1);
  }
  ok(`Node.js ${ver}`);
  return true;
}

async function installFirebaseCLI() {
  if (!commandExists("firebase")) {
    inf("Устанавливаем Firebase CLI...");
    run("npm install -g firebase-tools");
    ok("Firebase CLI установлен");
  } else {
    ok("Firebase CLI уже установлен: " + runSilent("firebase --version").trim());
  }
}

async function installGitHubCLI() {
  if (!commandExists("gh")) {
    warn("GitHub CLI не установлен.");
    inf("Инструкция по установке: https://cli.github.com/manual/installation");
    inf("Windows: winget install --id GitHub.cli");
    inf("Mac:     brew install gh");
    inf("Linux:   sudo apt install gh  или  snap install gh");
    const ans = await ask("Установили gh? Нажмите Enter чтобы продолжить (или 'skip' чтобы пропустить GitHub):");
    if (ans.toLowerCase() === "skip") return false;
    if (!commandExists("gh")) { err("gh всё ещё не найден."); return false; }
  }
  ok("GitHub CLI: " + runSilent("gh --version").split("\n")[0].trim());
  return true;
}

async function checkAppFiles() {
  hdr("ШАГ 2 / 7 — Проверка файлов приложения");
  const required = ["StroySmetaApp.html", "manifest.json", "sw.js"];
  const missing = required.filter(f => !fs.existsSync(path.join(process.cwd(), f)));
  if (missing.length > 0) {
    err(`Не найдены файлы: ${missing.join(", ")}`);
    inf("Убедитесь что запускаете setup.js из папки с файлами приложения.");
    inf("Нужны файлы: StroySmetaApp.html, manifest.json, sw.js, privacy-policy.html");
    inf("Также нужна папка icons/ с иконками.");
    process.exit(1);
  }
  ok("Все файлы приложения найдены");

  // Create icons dir if missing
  if (!fs.existsSync("icons")) {
    warn("Папка icons/ не найдена — создаём пустую");
    fs.mkdirSync("icons");
  }

  // Rename HTML to index.html for hosting
  if (fs.existsSync("StroySmetaApp.html") && !fs.existsSync("index.html")) {
    fs.copyFileSync("StroySmetaApp.html", "index.html");
    ok("StroySmetaApp.html скопирован как index.html");
  }

  return true;
}

async function setupFirebase() {
  hdr("ШАГ 3 / 7 — Настройка Firebase");

  inf("Сейчас откроется браузер для входа в Google.");
  inf("Войдите в аккаунт Google → разрешите доступ Firebase CLI.");
  await ask("Нажмите Enter чтобы открыть браузер для входа в Google...");

  run("firebase login");

  // Get project name
  const projectName = await ask("Введите имя проекта Firebase (только латинские буквы и цифры, например stroismeta-app):");
  const projectId = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  inf(`Создаём Firebase проект: ${projectId} ...`);
  try {
    run(`firebase projects:create ${projectId} --display-name "СтройСмета"`);
    ok(`Проект ${projectId} создан`);
  } catch(e) {
    warn("Возможно проект уже существует — продолжаем...");
  }

  // Initialize firebase in current dir
  inf("Настраиваем Firestore и Hosting...");
  
  // Create firebase.json
  fs.writeFileSync("firebase.json", JSON.stringify({
    hosting: {
      public: ".",
      ignore: ["firebase.json", "**/.*", "**/node_modules/**", "setup.js", "*.md"],
      rewrites: [{ source: "**", destination: "/index.html" }],
      headers: [{
        source: "**",
        headers: [
          { key: "Cache-Control", value: "no-cache" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" }
        ]
      }]
    },
    firestore: { rules: "firestore.rules", indexes: "firestore.indexes.json" }
  }, null, 2));

  // Create Firestore rules
  fs.writeFileSync("firestore.rules", `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`);

  fs.writeFileSync("firestore.indexes.json", JSON.stringify({ indexes: [], fieldOverrides: [] }, null, 2));

  ok("Конфигурация Firebase создана");

  // Set project as default
  run(`firebase use ${projectId}`);

  // Deploy Firestore rules
  inf("Публикуем правила Firestore...");
  try {
    run("firebase deploy --only firestore:rules");
    ok("Правила Firestore опубликованы");
  } catch(e) {
    warn("Не удалось опубликовать правила — сделайте это вручную в Console");
  }

  // Get Web App config
  inf("Получаем Firebase конфигурацию...");
  let configJson = null;
  try {
    // Create web app
    const createResult = runSilent(`firebase apps:create WEB "СтройСмета" --project ${projectId}`);
    await sleep(2000);

    // List apps to get the app ID
    const appsResult = runSilent(`firebase apps:list --project ${projectId}`);
    const appIdMatch = appsResult.match(/\d+:\d+:web:[a-zA-Z0-9]+/);
    if (appIdMatch) {
      const appId = appIdMatch[0];
      const sdkConfig = runSilent(`firebase apps:sdkconfig WEB ${appId} --project ${projectId}`);
      const configMatch = sdkConfig.match(/const firebaseConfig = ({[\s\S]+?});/);
      if (configMatch) {
        configJson = configMatch[1].replace(/\n/g, " ").replace(/\s+/g, " ").trim();
        ok("Firebase config получен автоматически");
      }
    }
  } catch(e) {
    warn("Не удалось получить config автоматически");
  }

  if (!configJson) {
    console.log(`\n${C.yellow}Нужно скопировать Firebase config вручную:${C.reset}`);
    console.log(`1. Откройте https://console.firebase.google.com/project/${projectId}/settings/general`);
    console.log(`2. Прокрутите до "Ваши приложения" → "</>" → Создать веб-приложение`);
    console.log(`3. Скопируйте объект firebaseConfig и вставьте ниже:\n`);
    configJson = await ask("Вставьте firebaseConfig JSON (всё от { до }): ");
  }

  // Insert config into index.html
  if (configJson && fs.existsSync("index.html")) {
    let html = fs.readFileSync("index.html", "utf8");
    
    // Replace placeholder config
    const placeholder = `const firebaseConfig = {
    apiKey:            "ВАШ_API_KEY",
    authDomain:        "ВАШ_ПРОЕКТ.firebaseapp.com",
    projectId:         "ВАШ_ПРОЕКТ",
    storageBucket:     "ВАШ_ПРОЕКТ.appspot.com",
    messagingSenderId: "ВАШ_SENDER_ID",
    appId:             "ВАШ_APP_ID"
  };`;

    // Try to parse and reformat the config
    try {
      const evalFn = new Function(`return ${configJson}`);
      const cfg = evalFn();
      const formatted = `const firebaseConfig = {
    apiKey:            "${cfg.apiKey || ""}",
    authDomain:        "${cfg.authDomain || ""}",
    projectId:         "${cfg.projectId || ""}",
    storageBucket:     "${cfg.storageBucket || ""}",
    messagingSenderId: "${cfg.messagingSenderId || ""}",
    appId:             "${cfg.appId || ""}"
  };`;
      html = html.replace(placeholder, formatted);
      fs.writeFileSync("index.html", html);
      ok("Firebase config вставлен в index.html");
    } catch(e) {
      warn("Не удалось автоматически вставить config. Вставьте вручную в index.html.");
    }
  }

  return projectId;
}

async function enableFirebaseAuth(projectId) {
  hdr("ШАГ 4 / 7 — Включение авторизации Firebase");

  // Firebase CLI doesn't directly enable auth providers via CLI
  // We use the REST API with the current auth token
  inf("Получаем токен доступа...");
  let token = "";
  try {
    token = runSilent("firebase login:ci --no-localhost 2>/dev/null || firebase auth:print-access-token 2>/dev/null").trim().split("\n").pop();
  } catch(e) {}

  console.log(`\n${C.yellow}Включите авторизацию вручную (занимает 1 минуту):${C.reset}`);
  console.log(`1. Откройте: ${C.cyan}https://console.firebase.google.com/project/${projectId}/authentication/providers${C.reset}`);
  console.log(`2. Нажмите "Email/Password" → включите первый тумблер → Сохранить`);
  console.log(`3. Нажмите "Phone" → включите тумблер → Сохранить`);
  await ask("\nСделали? Нажмите Enter чтобы продолжить...");
  ok("Авторизация настроена");
}

async function setupGitHub(projectId) {
  hdr("ШАГ 5 / 7 — GitHub Pages");

  inf("Сейчас откроется браузер для входа в GitHub.");
  await ask("Нажмите Enter чтобы войти в GitHub...");
  
  try {
    run("gh auth login --web");
  } catch(e) {
    warn("Ошибка входа в GitHub. Попробуйте вручную: gh auth login");
    const skip = await ask("Пропустить GitHub? (y/n): ");
    if (skip.toLowerCase() === "y") return null;
  }

  const repoName = await ask("Имя репозитория GitHub (например stroismeta-app): ") || "stroismeta-app";
  
  inf(`Создаём репозиторий ${repoName}...`);
  try {
    // Check if repo exists
    const existing = runSilent(`gh repo view ${repoName} --json name 2>/dev/null`);
    if (existing) {
      warn(`Репозиторий ${repoName} уже существует — используем его`);
    }
  } catch(e) {
    run(`gh repo create ${repoName} --public --description "СтройСмета — приложение для смет"`);
    ok(`Репозиторий ${repoName} создан`);
  }

  // Initialize git and push
  inf("Инициализируем git и загружаем файлы...");
  
  if (!fs.existsSync(".git")) {
    run("git init");
    run("git branch -M main");
  }

  // Create .gitignore
  fs.writeFileSync(".gitignore", `node_modules/
.firebase/
*.log
.env
setup.js
`);

  run("git add -A");
  try {
    run(`git commit -m "СтройСмета v1.0 — первый релиз"`);
  } catch(e) {
    // Commit might fail if nothing to commit
  }

  // Get GitHub username
  const ghUser = runSilent("gh api user --jq .login").trim();
  
  // Set remote and push
  try {
    run(`git remote add origin https://github.com/${ghUser}/${repoName}.git`);
  } catch(e) {
    run(`git remote set-url origin https://github.com/${ghUser}/${repoName}.git`);
  }
  
  run("git push -u origin main --force");
  ok("Файлы загружены на GitHub");

  // Enable GitHub Pages
  inf("Включаем GitHub Pages...");
  try {
    run(`gh api repos/${ghUser}/${repoName}/pages --method POST -f source[branch]=main -f source[path]=/ --silent`, { ok: true });
    await sleep(3000);
    ok("GitHub Pages включён");
  } catch(e) {
    // Might already be enabled
  }

  const siteUrl = `https://${ghUser}.github.io/${repoName}`;
  const policyUrl = `${siteUrl}/privacy-policy.html`;

  return { ghUser, repoName, siteUrl, policyUrl };
}

async function addDomainToFirebase(projectId, siteUrl) {
  hdr("ШАГ 6 / 7 — Авторизованный домен Firebase");
  
  const domain = new URL(siteUrl).hostname;
  console.log(`\n${C.yellow}Добавьте домен в Firebase (нужно вручную):${C.reset}`);
  console.log(`1. Откройте: ${C.cyan}https://console.firebase.google.com/project/${projectId}/authentication/settings${C.reset}`);
  console.log(`2. Вкладка "Авторизованные домены"`);
  console.log(`3. Нажмите "Добавить домен"`);
  console.log(`4. Введите: ${C.bold}${domain}${C.reset}`);
  console.log(`5. Нажмите "Добавить"`);
  
  await ask("\nСделали? Нажмите Enter...");
  ok(`Домен ${domain} добавлен в Firebase`);
}

async function printResults(projectId, github) {
  hdr("ШАГ 7 / 7 — Готово! 🎉");

  console.log(`\n${C.bold}${C.green}╔══════════════════════════════════════════════════════╗`);
  console.log(`║         УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО! 🚀              ║`);
  console.log(`╚══════════════════════════════════════════════════════╝${C.reset}\n`);

  if (github) {
    console.log(`${C.bold}📱 Приложение:${C.reset}`);
    console.log(`   ${C.cyan}${github.siteUrl}${C.reset}`);
    console.log(`\n${C.bold}📋 Политика конфиденциальности:${C.reset}`);
    console.log(`   ${C.cyan}${github.policyUrl}${C.reset}`);
    console.log(`   ${C.grey}← Вставьте эту ссылку в Google Play Console${C.reset}`);
  }

  console.log(`\n${C.bold}🔥 Firebase Console:${C.reset}`);
  console.log(`   ${C.cyan}https://console.firebase.google.com/project/${projectId}${C.reset}`);

  console.log(`\n${C.bold}📋 Следующие шаги:${C.reset}`);
  console.log(`   1. Откройте приложение по ссылке и проверьте вход через SMS`);
  console.log(`   2. Зайдите на pwabuilder.com → введите URL → скачайте .aab`);
  console.log(`   3. Загрузите .aab в Google Play Console`);
  console.log(`   4. Вставьте ссылку на политику конфиденциальности в Play Console`);

  console.log(`\n${C.bold}${C.yellow}⚠️  Важно сохранить:${C.reset}`);
  console.log(`   • Файл android.keystore (для обновлений в Play Store)`);
  console.log(`   • Логин/пароль Firebase и GitHub аккаунтов`);

  // Save results to file
  const results = {
    appUrl: github ? github.siteUrl : null,
    policyUrl: github ? github.policyUrl : null,
    firebaseProject: projectId,
    firebaseConsole: `https://console.firebase.google.com/project/${projectId}`,
    github: github ? `https://github.com/${github.ghUser}/${github.repoName}` : null,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync("setup-results.json", JSON.stringify(results, null, 2));
  ok("Результаты сохранены в setup-results.json");
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(`${C.bold}${C.blue}`);
  console.log(`╔══════════════════════════════════════════════════════╗`);
  console.log(`║   🏠 СтройСмета — Автоматическая установка           ║`);
  console.log(`║   Firebase + GitHub Pages за ~10 минут               ║`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`${C.reset}`);
  console.log(`${C.grey}Вам потребуется:`);
  console.log(`  • Войти в Google аккаунт (один раз)`);
  console.log(`  • Войти в GitHub аккаунт (один раз)`);
  console.log(`  • Вручную включить Auth в Firebase Console (1 мин)${C.reset}\n`);

  const confirmed = await ask("Начать установку? (y/n): ");
  if (confirmed.toLowerCase() !== "y" && confirmed !== "") {
    console.log("Отменено.");
    process.exit(0);
  }

  try {
    await checkNode();
    await installFirebaseCLI();
    const hasGH = await installGitHubCLI();
    await checkAppFiles();
    const projectId = await setupFirebase();
    await enableFirebaseAuth(projectId);
    let github = null;
    if (hasGH) {
      github = await setupGitHub(projectId);
      if (github) await addDomainToFirebase(projectId, github.siteUrl);
    } else {
      warn("GitHub пропущен. Загрузите файлы на хостинг вручную.");
    }
    await printResults(projectId, github);
  } catch(e) {
    console.error(`\n${C.red}Ошибка: ${e.message}${C.reset}`);
    console.error(`${C.grey}${e.stack}${C.reset}`);
    console.log(`\nЕсли проблема не решается — напишите на sstroysmeta@gmail.com`);
    process.exit(1);
  }
}

main();
