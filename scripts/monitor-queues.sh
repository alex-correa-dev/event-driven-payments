#!/bin/bash

echo "📊 Monitorando filas do RabbitMQ..."
echo "Pressione Ctrl+C para parar"
echo ""

while true; do
  clear
  echo "════════════════════════════════════════════════════════════════"
  echo "📊 STATUS DAS FILAS - $(date '+%Y-%m-%d %H:%M:%S')"
  echo "════════════════════════════════════════════════════════════════"
  
  echo ""
  echo "🎯 FILA DE PAGAMENTOS:"
  sudo docker exec edp-rabbitmq rabbitmqctl list_queues -q name messages_ready messages_unacknowledged | grep "payment.queue" | while read line; do
    echo "   $line"
  done
  
  echo ""
  echo "💀 DEAD LETTER QUEUE:"
  sudo docker exec edp-rabbitmq rabbitmqctl list_queues -q name messages_ready messages_unacknowledged | grep "payment.dead-letter" | while read line; do
    echo "   $line"
  done
  
  echo ""
  echo "📈 MÉTRICAS RABBITMQ:"
  sudo docker exec edp-rabbitmq rabbitmqctl list_queues -q name messages messages_ready messages_unacknowledged | head -5
  
  echo ""
  echo "────────────────────────────────────────────────────────────────"
  echo "💡 Para enviar pedidos, execute em outro terminal:"
  echo "   npx tsx scripts/send-payment-orders.ts [quantidade]"
  echo ""
  echo "   Exemplo: npx tsx scripts/send-payment-orders.ts 20"
  echo "════════════════════════════════════════════════════════════════"
  
  sleep 3
done
