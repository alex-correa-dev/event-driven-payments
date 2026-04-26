import type {
  PaymentGateway,
  PaymentResult,
  PaymentMethod,
} from '../../domain/interfaces/PaymentGateway';
import { logger } from '../logger';

export class MockPaymentGateway implements PaymentGateway {
  private paymentMethods: PaymentMethod[] = [
    { type: 'CREDIT_CARD', lastDigits: '1234', cardBrand: 'VISA' },
    { type: 'CREDIT_CARD', lastDigits: '5678', cardBrand: 'MASTERCARD' },
    { type: 'DEBIT_CARD', lastDigits: '9012', cardBrand: 'VISA' },
    { type: 'PIX' },
    { type: 'BOLETO' },
  ];

  async charge(orderId: string, amount: number): Promise<PaymentResult> {
    const randomDelay = Math.floor(Math.random() * 200) + 50;
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    const selectedMethod =
      this.paymentMethods[Math.floor(Math.random() * this.paymentMethods.length)];
    const transactionId = `TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    logger.info(
      {
        orderId,
        amount,
        transactionId,
        method: selectedMethod.type,
        cardBrand: selectedMethod.cardBrand,
        lastDigits: selectedMethod.lastDigits,
      },
      'Payment processed via mock gateway'
    );

    return {
      transactionId,
      status: 'AUTHORIZED',
      method: selectedMethod,
    };
  }
}
