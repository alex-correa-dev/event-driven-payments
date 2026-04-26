export interface PaymentMethod {
  type: 'CREDIT_CARD' | 'DEBIT_CARD' | 'PIX' | 'BOLETO';
  lastDigits?: string;
  cardBrand?: 'VISA' | 'MASTERCARD' | 'ELO' | 'AMEX';
}

export interface PaymentResult {
  transactionId: string;
  status: string;
  method: PaymentMethod;
}

export interface PaymentGateway {
  charge(orderId: string, amount: number): Promise<PaymentResult>;
}
