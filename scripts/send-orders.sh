#!/bin/bash

echo "════════════════════════════════════════════════════════════"
echo "🚀 Enviando pedidos via Order Service API"
echo "════════════════════════════════════════════════════════════"

NUM_ORDERS=${1:-5}

for i in $(seq 1 $NUM_ORDERS); do
  echo ""
  echo "📦 Criando pedido $i/$NUM_ORDERS..."
  
  RESPONSE=$(curl -s -X POST http://localhost:3000/orders \
    -H "Content-Type: application/json" \
    -d "{
      \"customer\": {
        \"name\": \"Cliente $i\",
        \"email\": \"cliente$i@email.com\"
      },
      \"items\": [
        {
          \"productId\": \"1\",
          \"productName\": \"Notebook\",
          \"quantity\": 1,
          \"price\": 2999.99
        },
        {
          \"productId\": \"2\",
          \"productName\": \"Mouse\",
          \"quantity\": $((RANDOM % 3 + 1)),
          \"price\": 49.99
        }
      ]
    }")
  
  ORDER_ID=$(echo $RESPONSE | grep -o '"orderId":"[^"]*"' | cut -d'"' -f4)
  echo "✅ Pedido criado: $ORDER_ID"
  
  sleep 0.5
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ $NUM_ORDERS pedidos enviados!"
echo ""
echo "🔍 Verificar status de um pedido:"
echo "   curl http://localhost:3000/orders/ORDER_ID"
echo ""
echo "📋 Ver todos os pedidos:"
echo "   curl http://localhost:3000/orders"
echo "════════════════════════════════════════════════════════════"
