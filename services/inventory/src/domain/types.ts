export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reserved: number;
  price: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface InventoryReservation {
  id: string;
  orderId: string;
  items: OrderItem[];
  status: 'PENDING' | 'RESERVED' | 'RELEASED' | 'FAILED';
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateStockDTO {
  orderId: string;
  items: OrderItem[];
}
