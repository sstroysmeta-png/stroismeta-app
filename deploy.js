const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

const FIREBASE_CONFIG = `
  apiKey: "AIzaSyDbPXLB-eP4n6PryTeJi19eVnDZ-GvhCxU",
  authDomain: "stroismeta-39ae1.firebaseapp.com",
  projectId: "stroismeta-39ae1",
  storageBucket: "stroismeta-39ae1.firebasestorage.app",
  messagingSenderId: "304504642509",
  appId: "1:304504642509:web:f6ef4af08ccfc793010284"
`;

async function main() {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   СтройСмета — Публикация на GitHub  ║');
  console.log('╚══════════════════════════════════════╝\n');

  // 1. Найти HTML файл
  const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
  if (files.length === 0) {
    console.log('❌ HTML файл не найден в папке!');
    process.exit(1);
  }
  const htmlFile = files.find(f => f.toLowerCase().includes('stroysmeta') || f.toLowerCase().includes('stroismeta')) || files[0];
  console.log(`✅ Найден файл: ${htmlFile}`);

  // 2. Вставить Firebase config в HTML
  console.log('ℹ️  Вставляем Firebase config...');
  let html = fs.readFileSync(htmlFile, 'utf8');

  const configBlock = `const firebaseConfig = {\n${FIREBASE_CONFIG}\n};`;

  if (html.includes('ВАШ_API_KEY') || html.includes('YOUR_API_KEY')) {
    html = html.replace(/apiKey:\s*["'].*?["']/, `apiKey: "AIzaSyDbPXLB-eP4n6PryTeJi19eVnDZ-GvhCxU"`);
    html = html.replace(/authDomain:\s*["'].*?["']/, `authDomain: "stroismeta-39ae1.firebaseapp.com"`);
    html = html.replace(/projectId:\s*["'].*?["']/, `projectId: "stroismeta-39ae1"`);
    html = html.replace(/storageBucket:\s*["'].*?["']/, `storageBucket: "stroismeta-39ae1.firebasestorage.app"`);
    html = html.replace(/messagingSenderId:\s*["'].*?["']/, `messagingSenderId: "304504642509"`);
    html = html.replace(/appId:\s*["'].*?["']/, `appId: "1:304504642509:web:f6ef4af08ccfc793010284"`);
    console.log('✅ Firebase config вставлен (заменены placeholder значения)');
  } else if (html.includes('firebaseConfig')) {
    html = html.replace(/apiKey:\s*["'][^"']*["']/, `apiKey: "AIzaSyDbPXLB-eP4n6PryTeJi19eVnDZ-GvhCxU"`);
    html = html.replace(/authDomain:\s*["'][^"']*["']/, `authDomain: "stroismeta-39ae1.firebaseapp.com"`);
    html = html.replace(/projectId:\s*["'][^"']*["']/, `projectId: "stroismeta-39ae1"`);
    html = html.replace(/storageBucket:\s*["'][^"']*["']/, `storageBucket: "stroismeta-39ae1.firebasestorage.app"`);
    html = html.replace(/messagingSenderId:\s*["'][^"']*["']/, `messagingSenderId: "304504642509"`);
    html = html.replace(/appId:\s*["'][^"']*["']/, `appId: "1:304504642509:web:f6ef4af08ccfc793010284"`);
    console.log('✅ Firebase config обновлён');
  } else {
    console.log('⚠️  firebaseConfig не найден в HTML — добавляем перед </head>');
    html = html.replace('</head>', `<script>\nconst firebaseConfig = {\n${FIREBASE_CONFIG}\n};\n</script>\n</head>`);
  }

  fs.writeFileSync('index.html', html, 'utf8');
  console.log('✅ Сохранён как index.html\n');

  // 3. GitHub
  console.log('━━━ GitHub Pages ━━━\n');
  console.log('ℹ️  Сейчас откроется браузер для входа в GitHub.');
  await ask('❓ Нажмите Enter чтобы войти в GitHub...');

  try {
    execSync('gh auth login --web -h github.com', { stdio: 'inherit' });
  } catch(e) {
    console.log('⚠️  Возможно уже вошли в GitHub — продолжаем...');
  }

  const repoName = 'stroismeta-app';
  console.log(`\nℹ️  Создаём репозиторий: ${repoName} ...`);

  try {
    execSync(`gh repo create ${repoName} --public --confirm`, { stdio: 'inherit' });
    console.log('✅ Репозиторий создан');
  } catch(e) {
    console.log('⚠️  Репозиторий уже существует — используем его');
  }

  // 4. Git
  console.log('\nℹ️  Загружаем файлы...');
  const username = execSync('gh api user --jq .login').toString().trim();
  const repoUrl = `https://github.com/${username}/${repoName}.git`;

  if (!fs.existsSync('.git')) {
    execSync('git init', { stdio: 'inherit' });
  }

  execSync('git add index.html', { stdio: 'inherit' });

  // Добавить остальные файлы если есть
  ['privacy-policy.html', 'manifest.json', 'sw.js'].forEach(f => {
    if (fs.existsSync(f)) execSync(`git add ${f}`, { stdio: 'inherit' });
  });
  if (fs.existsSync('icons')) execSync('git add icons/', { stdio: 'inherit' });

  try {
    execSync('git commit -m "Deploy СтройСмета app"', { stdio: 'inherit' });
  } catch(e) {}

  try {
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'inherit' });
  } catch(e) {
    execSync(`git remote set-url origin ${repoUrl}`, { stdio: 'inherit' });
  }

  execSync('git branch -M main', { stdio: 'inherit' });
  execSync('git push -u origin main --force', { stdio: 'inherit' });
  console.log('✅ Файлы загружены');

  // 5. GitHub Pages
  console.log('\nℹ️  Включаем GitHub Pages...');
  try {
    execSync(`gh api repos/${username}/${repoName}/pages -X POST -f source[branch]=main -f source[path]=/`, { stdio: 'inherit' });
    console.log('✅ GitHub Pages включён');
  } catch(e) {
    console.log('⚠️  Pages уже включён или включается...');
  }

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║   ✅ ГОТОВО!                                  ║');
  console.log(`║   🌐 Ваш сайт: https://${username}.github.io/${repoName}/  ║`);
  console.log('║                                              ║');
  console.log('║   ⏳ Сайт появится через 2-5 минут           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  console.log('📌 Не забудьте включить Auth в Firebase:');
  console.log('   https://console.firebase.google.com/project/stroismeta-39ae1/authentication/providers');
  console.log('   → Email/Password → включить → Сохранить\n');

  rl.close();
}

main().catch(e => { console.error('Ошибка:', e.message); rl.close(); });