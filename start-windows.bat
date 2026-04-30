@echo off
chcp 65001 >nul
title СтройСмета — Установка
color 0B

echo.
echo  ╔════════════════════════════════════════════════╗
echo  ║   СтройСмета — Автоматическая установка        ║
echo  ╚════════════════════════════════════════════════╝
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo  ❌ Node.js не установлен!
    echo.
    echo  Скачайте Node.js v18+ с сайта: https://nodejs.org
    echo  Выберите LTS версию, установите, затем запустите этот файл снова.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)

echo  ✅ Node.js найден: 
node --version
echo.

:: Run setup
node setup.js

if errorlevel 1 (
    echo.
    echo  ❌ Установка завершилась с ошибкой.
    echo  Прочитайте сообщение выше.
    pause
    exit /b 1
)

pause
