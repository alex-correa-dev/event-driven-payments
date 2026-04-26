# Event-Driven Payments - Sistema de Pagamentos Orientado a Eventos

> 🎯 **Projeto de portfólio para aprendizado de Arquitetura Orientada a Eventos (EDA)**  
> Este projeto foi desenvolvido como parte dos meus estudos sobre arquitetura de software, mensageria e microsserviços. O objetivo foi colocar em prática conceitos de EDA utilizando RabbitMQ, Node.js, TypeScript e Clean Architecture.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Fluxo Completo do Pedido](#fluxo-completo-do-pedido)
- [Tecnologias Utilizadas](#tecnologias-utilizadas)
- [Decisões Técnicas](#decisões-técnicas)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Como Executar](#como-executar)
- [Testando o Sistema](#testando-o-sistema)
- [O que Aprendi](#o-que-aprendi)
- [O que Faltou (Limitações e Melhorias Futuras)](#o-que-faltou-limitações-e-melhorias-futuras)
- [Licença](#licença)

---

## 🎯 Visão Geral

Este é um sistema de pagamentos distribuído baseado em **Arquitetura Orientada a Eventos (EDA)** onde cada etapa do processamento é desacoplada e se comunica através de mensagens assíncronas via **RabbitMQ**.

**Motivação:** Colocar em prática conceitos de EDA que estudei, entendendo na prática como eventos fluem entre microsserviços, como lidar com falhas, retries, dead letter queues e como orquestrar um fluxo complexo de forma assíncrona.

---

## 🏗️ Arquitetura

```text
Cliente
   │
   ▼
Order Service (Porta 3000)
   │
   │ publica payment.create
   │
   ├──────────────────┬──────────────────┐
   ▼                  ▼                  ▼
RabbitMQ           RabbitMQ           RabbitMQ
payment.events     payment.events     payment.events
   │                  │                  │
   ▼                  ▼                  ▼
Payment Service   Notification Svc   Inventory Svc
(Porta 3001)      (Porta 3003)      (Porta 3002)
   │                                    │
   │ publica payment.processed          │ publica inventory.reserved
   │                                    │
   ▼                                    ▼
RabbitMQ                              RabbitMQ
invoice.events                        inventory.events
   │                                    │
   ▼                                    ▼
Invoice Service                       Order Service
(Porta 3004)                          (Consumer)
```

## 🔄 Fluxo Completo do Pedido

| Etapa | Serviço                  | Ação                                                                | Evento Publicado                           |
| ----- | ------------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| 1     | **Order Service**        | Cliente POST /orders, cria pedido com status PENDING                | `payment.create`                           |
| 2     | **Payment Service**      | Cria registro de pagamento, processa com gateway mock (95% sucesso) | `payment.processed` ou `payment.failed`    |
| 3     | **Notification Service** | Envia email mock para o cliente sobre recebimento do pedido         | -                                          |
| 4     | **Inventory Service**    | Reserva estoque dos produtos (85% sucesso)                          | `inventory.reserved` ou `inventory.failed` |
| 5     | **Invoice Service**      | Gera nota fiscal mock (NF-e simulada)                               | `invoice.generated` ou `invoice.failed`    |
| 6     | **Notification Service** | Envia email mock com confirmação final de pagamento                 | -                                          |
| 7     | **Order Service**        | Atualiza status do pedido para COMPLETED                            | -                                          |

---

## 🛠️ Tecnologias Utilizadas

| Categoria           | Tecnologia               | Motivo                                                                     |
| ------------------- | ------------------------ | -------------------------------------------------------------------------- |
| **Message Broker**  | RabbitMQ 3.12            | Leve, confiável e com bom suporte a padrões de mensageria                  |
| **Banco de Dados**  | PostgreSQL 15            | Banco relacional robusto para persistência                                 |
| **Linguagem**       | Node.js + TypeScript 5.x | Tipagem estática e boa experiência de desenvolvimento                      |
| **Arquitetura**     | Clean Architecture       | Separação clara de responsabilidades (Domain, Application, Infrastructure) |
| **Logging**         | Pino + pino-pretty       | Logging estruturado e performático                                         |
| **Testes**          | Vitest                   | Rápido, compatível com Jest e boa integração com TypeScript                |
| **Containerização** | Docker + Docker Compose  | Facilidade de setup e reprodutibilidade                                    |
| **Monitoramento**   | Prometheus               | Coleta de métricas (em desenvolvimento)                                    |

---

## 🧠 Decisões Técnicas

### 1. **Por que Arquitetura Orientada a Eventos?**

- Desacoplamento entre os serviços
- Tolerância a falhas (se um serviço cair, as mensagens ficam na fila)
- Escalabilidade (cada serviço pode ser escalado independentemente)
- Rastreabilidade (cada evento fica registrado)

### 2. **Clean Architecture**

- **Domain Layer:** Entidades puras, regras de negócio (ex: Payment, Order)
- **Application Layer:** Casos de uso orquestrando o fluxo (ex: ProcessPaymentUseCase)
- **Infrastructure Layer:** Implementações concretas (RabbitMQ, PostgreSQL, Mocks)

### 3. **RabbitMQ - Exchanges e Filas**

- `topic exchange` para roteamento flexível (`payment.*`, `inventory.*`, `invoice.*`)
- Filas duráveis para não perder mensagens em caso de falha
- Dead Letter Queue para mensagens que falham após 3 tentativas

### 4. **Tratamento de Falhas (Retry e DLQ)**

- Cada serviço tem seu próprio mecanismo de retry (3 tentativas)
- Após 3 falhas, a mensagem vai para uma DLQ para análise posterior
- 50% de chance de erro simulada (para demonstrar resiliência)

### 5. **Mocks Estratégicos**

- `MockPaymentGateway`: Simula gateway de pagamento (Stripe, PagSeguro)
- `MockNotificationService`: Simula envio de email (SendGrid, AWS SES)
- `MockInventoryService`: Simula reserva de estoque
- `MockInvoiceService`: Simula geração de NF-e (SEFAZ)

**Por que mocks?** Para focar no aprendizado de EDA sem depender de serviços externos pagos.

### 6. **Monorepo com Workspaces**

- Facilita gerenciamento de múltiplos serviços
- Compartilhamento de configurações (ESLint, Prettier, TypeScript)
- Scripts centralizados (`./scripts/start-*.sh`)

## 📁 Estrutura do Projeto

```text
event-driven-payments/
├── services/
│ ├── order/ # Order Service (orquestrador)
│ │ ├── src/
│ │ │ ├── application/ # Use cases
│ │ │ ├── domain/ # Entities, interfaces
│ │ │ └── infrastructure/# Repositories, API, consumer
│ │ └── tests/ # Testes unitários
│ ├── payment/ # Payment Service
│ ├── inventory/ # Inventory Service
│ ├── notification/ # Notification Service
│ └── invoice/ # Invoice Service
├── infra/
│ ├── postgres/ # Configuração do banco
│ ├── prometheus/ # Métricas
│ └── rabbitmq/ # Configuração do broker
├── scripts/ # Scripts de inicialização e teste
├── docker-compose.yml # Orquestração dos containers
└── README.md
```

## 🚀 Como Executar

### Pré-requisitos

- Docker e Docker Compose
- Node.js 20+ e npm
- Linux, macOS ou WSL (Windows)

### Passo a passo

```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/event-driven-payments.git
cd event-driven-payments

# 2. Instalar dependências
npm install
cd services/order && npm install
cd ../payment && npm install
cd ../inventory && npm install
cd ../notification && npm install
cd ../invoice && npm install
cd ../..

# 3. Subir a infraestrutura (RabbitMQ, PostgreSQL, Prometheus)
sudo docker compose up -d

# 4. Iniciar os serviços (em terminais separados)
./scripts/start-order.sh        # Terminal 1
./scripts/start-payment.sh      # Terminal 2
./scripts/start-inventory.sh    # Terminal 3
./scripts/start-notification.sh # Terminal 4
./scripts/start-invoice.sh      # Terminal 5
```

## 🧪 Testando o Sistema

### Criar um pedido via API

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "name": "João Silva",
      "email": "joao@email.com"
    },
    "items": [
      {"productId": "1", "productName": "Notebook", "quantity": 1, "price": 2999.99}
    ]
  }'
```

Resposta esperada:

```json
{
  "orderId": "ORD-1735123456789-123",
  "status": "PENDING",
  "totalAmount": 2999.99
}
```

### Verificar status do pedido

```bash
curl http://localhost:3000/orders/ORD-1735123456789-123
```

### Enviar múltiplos pedidos

```bash
./scripts/send-orders.sh 10
```

### Monitorar filas do RabbitMQ

```bash
sudo docker exec edp-rabbitmq rabbitmqctl list_queues
```

## 🌐 Acessar Interfaces

| Serviço             | URL                    | Credenciais      |
| ------------------- | ---------------------- | ---------------- |
| RabbitMQ Management | http://localhost:15672 | admin / admin123 |
| Prometheus          | http://localhost:9090  | -                |

## 📚 O que Aprendi

### Conceitos de EDA que pratiquei:

✅ **Event-driven communication** entre microsserviços

✅ **Message Broker (RabbitMQ)** - exchanges, queues, bindings

✅ **Dead Letter Queue (DLQ)** para mensagens com falha

✅ **Retry policies** com backoff exponencial

✅ **Idempotência** - processamento de mensagens duplicadas

✅ **Event sourcing indireto** (rastreabilidade via logs)

✅ **Orquestração vs Coreografia** (usei orquestração via Order Service)

### Clean Architecture na prática:

✅ **Separação de camadas** (Domain, Application, Infrastructure)

✅ **Inversão de dependência** (interfaces na domain)

✅ **Testes unitários** focados nas regras de negócio

### Desafios enfrentados:

🔥 Configurar o RabbitMQ corretamente (exchanges, filas, bindings)

🔥 Evitar loops infinitos com `nack` sem retry controlado

🔥 Garantir que eventos incluam todos os dados necessários (`customer`, `items`)

🔥 Gerenciar múltiplos serviços rodando simultaneamente

## ⚠️ O que Faltou (Limitações e Melhorias Futuras)

### Não implementado (importante saber):

| Item                     | Descrição                                         | Prioridade |
| ------------------------ | ------------------------------------------------- | ---------- |
| **Segurança**            | Autenticação/JWT entre serviços, TLS no RabbitMQ  | 🔴 Alta    |
| **Idempotência**         | Prevenção de processamento duplicado de mensagens | 🔴 Alta    |
| **Circuit Breaker**      | Proteger serviços contra falhas em cascata        | 🟡 Média   |
| **Distributed Tracing**  | Correlacionar requisições (OpenTelemetry, Jaeger) | 🟡 Média   |
| **API Gateway**          | Ponto único de entrada, rate limiting             | 🟡 Média   |
| **Dashboard**            | Grafana para visualizar métricas em tempo real    | 🟢 Baixa   |
| **Dados Persistentes**   | Orders salvos em PostgreSQL (hoje em memória)     | 🟢 Baixa   |
| **Testes de Integração** | End-to-end com containers reais                   | 🟢 Baixa   |
| **CI/CD**                | Pipeline automatizado de testes e deploy          | 🟢 Baixa   |

### Para levar para produção, seria necessário:

🔐 **Autenticação e Autorização** (JWT, OAuth2, API Keys)

🔒 **Criptografia** de dados sensíveis (PGP para mensagens)

📊 **Observabilidade** (logs estruturados, métricas, tracing)

🏥 **Health Checks** e readiness probes

📦 **Kubernetes** para orquestração dos containers

🧪 **Testes de carga** e chaos engineering

## 🎓 Conclusão

Este projeto foi uma jornada de aprendizado em **Arquitetura Orientada a Eventos** e **microsserviços**. Coloquei em prática conceitos teóricos em um sistema real, lidando com desafios de mensageria, tratamento de falhas, retries e dead letter queues.

**O sistema está funcional e demonstra:**

- ✅ Comunicação assíncrona entre microsserviços
- ✅ Processamento de pagamentos com regras de negócio
- ✅ Simulação de falhas para testar resiliência
- ✅ Clean Architecture para organização do código
- ✅ Testes unitários para garantir qualidade

> [!IMPORTANT]
> Este projeto é **100% educacional** e não deve ser usado em produção sem as devidas adições de segurança e observabilidade mencionadas acima.

## 📄 Licença

Este projeto é open-source para fins educacionais. Use como referência para seus estudos, mas lembre-se de adaptar para suas necessidades.

## 🙏 Agradecimentos

- Comunidade RabbitMQ e Node.js
- Conteúdos sobre Clean Architecture (Uncle Bob, Martin Fowler)
- Cursos e tutoriais sobre EDA

_Desenvolvido como parte dos meus estudos em Arquitetura de Software | 2026_
