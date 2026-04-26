import type { PaymentGateway } from '../../domain/interfaces/PaymentGateway';

export class MockPaymentGateway implements PaymentGateway {
  async charge(orderId: string, amount: number): Promise<void> {
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log(`💳 Payment charged for order ${orderId}: $${amount}`);

    return;
  }
}
