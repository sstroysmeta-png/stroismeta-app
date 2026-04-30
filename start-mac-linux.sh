#!/bin/bash
# СтройСмета — Автоматическая установка (Mac / Linux)

echo ""
echo "╔════════════════════════════════════════════════╗"
echo "║   СтройСмета — Автоматическая установка        ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен!"
    echo ""
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Mac: установите через Homebrew:"
        echo "  brew install node"
        echo ""
        echo "Или скачайте с https://nodejs.org (LTS)"
        
        # Try to install via brew if available
        if command -v brew &> /dev/null; then
            read -p "Установить Node.js через Homebrew прямо сейчас? (y/n): " install_node
            if [[ "$install_node" == "y" ]]; then
                brew install node
            fi
        fi
    else
        echo "Linux: sudo apt install nodejs npm"
        echo "Или: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
        echo "     sudo apt-get install -y nodejs"
    fi
    exit 1
fi

node_version=$(node --version)
echo "✅ Node.js $node_version"
echo ""

# Make executable
chmod +x setup.js 2>/dev/null

# Run
node setup.js

exit_code=$?
if [ $exit_code -ne 0 ]; then
    echo ""
    echo "❌ Установка завершилась с ошибкой (код $exit_code)"
    echo "Прочитайте сообщение выше."
    exit $exit_code
fi
