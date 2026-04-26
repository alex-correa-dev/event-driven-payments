import type { Product, InventoryReservation } from '../types';

export interface InventoryRepository {
  findProductById(productId: string): Promise<Product | null>;
  updateStock(productId: string, quantity: number): Promise<void>;
  createReservation(reservation: InventoryReservation): Promise<void>;
  findReservationByOrderId(orderId: string): Promise<InventoryReservation | null>;
}
