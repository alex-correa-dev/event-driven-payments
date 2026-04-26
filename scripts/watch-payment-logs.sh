#!/bin/bash

echo "📝 Acompanhando logs do Payment Service..."
echo "Pressione Ctrl+C para parar"
echo ""

PID=$(ps aux | grep "payment" | grep -v grep | awk '{print $2}')

if [ -z "$PID" ]; then
  echo "⚠️  Payment Service não está rodando!"
  echo "   Execute primeiro: ./scripts/start-payment.sh"
  exit 1
fi

echo "✅ Payment Service está rodando (PID: $PID)"
echo ""
echo "Para ver os logs completos, veja a saída do terminal onde executou:"
echo "./scripts/start-payment.sh"
