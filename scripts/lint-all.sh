#!/bin/bash

echo "🔍 Running ESLint and Prettier on all services..."

echo "📦 Root project..."
npm run lint && npm run format

for service in services/*/; do
  echo ""
  echo "📦 Service: $(basename $service)"
  cd $service
  npm run lint 2>/dev/null || echo "   ⚠️  No lint script found"
  npm run format 2>/dev/null || echo "   ⚠️  No format script found"
  cd ../..
done

echo ""
echo "✅ Linting and formatting complete!"
