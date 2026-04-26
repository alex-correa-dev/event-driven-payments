#!/usr/bin/env node

const amqp = require('amqplib');

const RABBITMQ_URL = 'amqp://admin:admin123@localhost:5672';
const EXCHANGE = 'payment.events';

function generateOrder() {
  const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const amount = Math.floor(Math.random() * 10000) / 100;
  const products = [
    'Notebook', 'Mouse', 'Teclado', 'Monitor', 'Webcam',
    'Headset', 'SSD', 'HD Externo', 'Impressora', 'Tablet',
  ];

  const numProducts = Math.floor(Math.random() * 3) + 1;
  const selectedProducts = [];
  for (let i = 0; i < numProducts; i++) {
    selectedProducts.push({
      name: products[Math.floor(Math.random() * products.length)],
      quantity: Math.floor(Math.random() * 3) + 1,
      price: Math.floor(Math.random() * 50000) / 100,
    });
  }

  return {
    orderId,
    amount,
    products: selectedProducts,
    customer: {
      name: `Cliente ${Math.floor(Math.random() * 1000)}`,
      email: `cliente${Math.floor(Math.random() * 1000)}@teste.com`,
    },
  };
}

async function sendPaymentOrders() {
  let connection;
  let channel;

  try {
    console.log('🔌 Conectando ao RabbitMQ...');
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    console.log('✅ Conectado ao RabbitMQ\n');

    const numOrders = process.argv[2] ? parseInt(process.argv[2]) : 10;

    console.log(`📦 Enviando ${numOrders} pedidos de pagamento...\n`);
    console.log('='.repeat(60));

    let successCount = 0;
    const startTime = Date.now();

    for (let i = 1; i <= numOrders; i++) {
      const order = generateOrder();

      const paymentEvent = {
        eventName: 'payment.create',
        data: {
          orderId: order.orderId,
          amount: order.amount,
          customer: order.customer,
          products: order.products,
        },
        timestamp: new Date().toISOString(),
        metadata: {
          eventId: `${Date.now()}-${i}`,
          version: '1.0',
          source: 'order-service',
        },
      };

      const published = channel.publish(
        EXCHANGE,
        'payment.create',
        Buffer.from(JSON.stringify(paymentEvent)),
        {
          persistent: true,
          contentEncoding: 'utf-8',
          contentType: 'application/json',
        }
      );

      if (published) {
        successCount++;
        console.log(`✅ [${i}/${numOrders}] Pedido enviado`);
        console.log(`   Order ID: ${order.orderId}`);
        console.log(`   Cliente: ${order.customer.email}`);
        console.log(`   Valor: R$ ${order.amount.toFixed(2)}`);
        console.log('-'.repeat(60));
      } else {
        console.log(`❌ [${i}/${numOrders}] Falha ao enviar pedido`);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESULTADO:`);
    console.log(`   Total enviado: ${numOrders}`);
    console.log(`   Sucesso: ${successCount}`);
    console.log(`   Falhas: ${numOrders - successCount}`);
    console.log(`   Tempo total: ${duration}s`);
    console.log('='.repeat(60));

    console.log('\n⏳ Aguardando processamento...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('\n👋 Desconectado do RabbitMQ');
  }
}

const numOrders = process.argv[2] ? parseInt(process.argv[2]) : 10;
sendPaymentOrders().catch(console.error);
