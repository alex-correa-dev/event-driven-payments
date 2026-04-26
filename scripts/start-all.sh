#!/bin/bash

echo "🚀 Starting all services..."

echo "📦 Starting Docker containers..."
sudo docker compose up -d

sleep 5

echo "📦 Starting Order Service (port 3000)..."
cd services/order
npm run dev &
ORDER_PID=$!
cd ../..

sleep 3

echo "📦 Starting Payment Service..."
cd services/payment
npm run dev &
PAYMENT_PID=$!
cd ../..

sleep 3

echo "📦 Starting Inventory Service..."
cd services/inventory
npm run dev &
INVENTORY_PID=$!
cd ../..

sleep 3

echo "📦 Starting Notification Service..."
cd services/notification
npm run dev &
NOTIFICATION_PID=$!
cd ../..

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Service URLs:"
echo "   Order API: http://localhost:3000"
echo "   RabbitMQ Management: http://localhost:15672 (admin/admin123)"
echo "   Prometheus: http://localhost:9090"
echo ""
echo "📝 Test with:"
echo "   curl -X POST http://localhost:3000/orders \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"customer\":{\"name\":\"Teste\",\"email\":\"teste@email.com\"},\"items\":[{\"productId\":\"1\",\"productName\":\"Notebook\",\"quantity\":2,\"price\":2999.99}]}'"
echo ""
echo "🔍 Check order status:"
echo "   curl http://localhost:3000/orders/ORD-xxxxx"
echo ""
echo "Press Ctrl+C to stop all services"

wait
