export interface PaymentGateway {
  charge(orderId: string, amount: number): Promise<void>;
}
