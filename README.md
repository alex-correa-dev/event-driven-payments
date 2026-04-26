Sistema de pagamentos orientado a eventos com RabbitMQ, Node.js, TypeScript e Clean Architecture.

## Arquitetura

```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Order       │────▶│ RabbitMQ    │────▶│ Payment     │
│ Script      │     │ Events      │     │ Service     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │ PostgreSQL  │
                                        └─────────────┘
```

## Tecnologias

- **Message Broker:** RabbitMQ
- **Database:** PostgreSQL
- **Language:** Node.js + TypeScript
- **Architecture:** Clean Architecture
- **Logging:** Pino
- **Testing:** Vitest

## Como Executar

```bash
# Subir infraestrutura
docker compose up -d

# Iniciar serviço de pagamento
./scripts/start-payment.sh

# Enviar pedidos de teste
npx tsx scripts/send-payment-orders.ts 10
```
