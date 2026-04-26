import type { InventoryRepository } from '../../domain/interfaces/InventoryRepository';
import type { Product, InventoryReservation } from '../../domain/types';
import { logger } from '../logger';

export class InMemoryInventoryRepository implements InventoryRepository {
  private products: Map<string, Product> = new Map();
  private reservations: Map<string, InventoryReservation> = new Map();

  constructor() {
    this.initializeProducts();
  }

  private initializeProducts(): void {
    const products: Product[] = [
      { id: '1', name: 'Notebook', sku: 'NB-001', quantity: 50, reserved: 0, price: 2999.99 },
      { id: '2', name: 'Mouse', sku: 'MS-001', quantity: 200, reserved: 0, price: 49.99 },
      { id: '3', name: 'Teclado', sku: 'KB-001', quantity: 150, reserved: 0, price: 199.99 },
      { id: '4', name: 'Monitor', sku: 'MN-001', quantity: 80, reserved: 0, price: 899.99 },
      { id: '5', name: 'Webcam', sku: 'WC-001', quantity: 60, reserved: 0, price: 299.99 },
      { id: '6', name: 'Headset', sku: 'HS-001', quantity: 120, reserved: 0, price: 159.99 },
      { id: '7', name: 'SSD', sku: 'SSD-001', quantity: 100, reserved: 0, price: 349.99 },
      { id: '8', name: 'HD Externo', sku: 'HD-001', quantity: 90, reserved: 0, price: 499.99 },
      { id: '9', name: 'Impressora', sku: 'PR-001', quantity: 40, reserved: 0, price: 799.99 },
      { id: '10', name: 'Tablet', sku: 'TB-001', quantity: 70, reserved: 0, price: 1299.99 },
    ];

    products.forEach((product) => {
      this.products.set(product.id, product);
    });

    logger.info({ productCount: products.length }, 'Inventory initialized');
  }

  async findProductById(productId: string): Promise<Product | null> {
    return this.products.get(productId) || null;
  }

  async updateStock(productId: string, quantity: number): Promise<void> {
    const product = this.products.get(productId);
    if (product) {
      product.quantity = quantity;
      this.products.set(productId, product);
    }
  }

  async createReservation(reservation: InventoryReservation): Promise<void> {
    this.reservations.set(reservation.orderId, reservation);
  }

  async findReservationByOrderId(orderId: string): Promise<InventoryReservation | null> {
    return this.reservations.get(orderId) || null;
  }
}
