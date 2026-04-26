export const config = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672',
  },
  service: {
    port: parseInt(process.env.PORT || '3000'),
  },
};
