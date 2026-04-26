export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface PaymentProps {
  id?: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Payment {
  public readonly id: string;
  public readonly orderId: string;
  public readonly amount: number;
  public status: PaymentStatus;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: PaymentProps) {
    this.id = props.id || crypto.randomUUID();
    this.orderId = props.orderId;
    this.amount = props.amount;
    this.status = props.status;
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = props.updatedAt || new Date();
  }

  public process(): void {
    if (this.status !== 'PENDING') {
      throw new Error(`Cannot process payment with status ${this.status}`);
    }
    this.status = 'PROCESSING';
    this.updatedAt = new Date();
  }

  public complete(): void {
    if (this.status !== 'PROCESSING') {
      throw new Error(`Cannot complete payment with status ${this.status}`);
    }
    this.status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  public fail(): void {
    if (this.status !== 'PROCESSING') {
      throw new Error(`Cannot fail payment with status ${this.status}`);
    }
    this.status = 'FAILED';
    this.updatedAt = new Date();
  }
}
