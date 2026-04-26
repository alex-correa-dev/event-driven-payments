export interface Order {
  id: string;
  orderId: string;
  customer: {
    name: string;
    email: string;
  };
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_PROCESSING'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'INVENTORY_RESERVED'
  | 'INVENTORY_FAILED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreateOrderDTO {
  customer: {
    name: string;
    email: string;
  };
  items: OrderItem[];
}

export interface OrderEvent {
  eventName: string;
  data: {
    orderId: string;
    customer?: { name: string; email: string };
    items?: OrderItem[];
    totalAmount?: number;
    paymentId?: string;
    transactionId?: string;
    error?: string;
  };
  timestamp: string;
}
