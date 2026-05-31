#!/bin/bash
# YOUNG HADENE — Daily Blog Post Cron Setup
# Run once: bash scripts/setup-cron.sh

SITE_DIR="$HOME/Projects/young-hadene"
NODE_PATH=$(which node)
CRON_LOG="$SITE_DIR/logs"
ENV_FILE="$SITE_DIR/.env"

# Create logs directory
mkdir -p "$CRON_LOG"

echo ""
echo "🎤 Young Hadene — Daily Cron & Server Setup"
echo "══════════════════════════════════════════════"
echo ""

# Check if .env exists with a key
if [ ! -f "$ENV_FILE" ] || [ -z "$(grep DEEPSEEK_API_KEY "$ENV_FILE" | grep -v '=$' | grep -v '#')" ]; then
  echo "⚠️  No API key found."
  read -sp "Enter your API key (OpenCode Zen / OpenAI compatible): " API_KEY
  echo ""
  if [ -n "$API_KEY" ]; then
    echo "DEEPSEEK_API_KEY=$API_KEY" > "$ENV_FILE"
    echo "DEEPSEEK_BASE_URL=https://opencode.ai/zen/v1" >> "$ENV_FILE"
    echo "DEEPSEEK_MODEL=deepseek-v4-flash-free" >> "$ENV_FILE"
    echo "✅ .env file created"
  else
    echo "⏭️  Skipping API key (you can edit .env later)"
  fi
else
  echo "✅ API key found in .env"
fi

# Remove old direct-generate cron if exists
(crontab -l 2>/dev/null | grep -v "generate-post" | crontab -) 2>/dev/null

# Add new cron: call the API server if running, else run generate directly
CRON_JOB="0 9 * * * curl -s -o /dev/null http://localhost:3456/api/generate?q=1 || (cd '$SITE_DIR' && $NODE_PATH scripts/generate-post.js >> '$CRON_LOG/blog-\$(date +\\%Y-\\%m-\\%d).log' 2>&1)"

(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
echo "✅ Cron job added — daily at 9:00 AM (tries API server first, falls back to direct)"

echo ""
echo "━━━ How to Use ━━━"
echo ""
echo "📡 Start the admin API server (keeps running):"
echo "   npm run server"
echo ""
echo "   Or run both server + site preview together:"
echo "   npm run dev"
echo ""
echo "🚀 Generate manually:"
echo "   npm run generate"
echo "   Or click 'Generate Now' in admin.html settings"
echo ""
echo "🌐 Open admin panel:"
echo "   http://localhost:3000/admin.html"
echo ""
echo "📂 Logs: $CRON_LOG"
echo ""
