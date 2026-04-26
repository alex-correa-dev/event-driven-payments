export const config = {
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672',
    queue: 'notification.queue',
    deadLetterQueue: 'notification.dead-letter',
  },
  service: {
    port: parseInt(process.env.PORT || '3003'),
  },
};
