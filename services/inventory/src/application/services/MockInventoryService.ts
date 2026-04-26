import type { InventoryService } from '../../domain/interfaces/InventoryService';
import type { InventoryRepository } from '../../domain/interfaces/InventoryRepository';
import type { UpdateStockDTO, InventoryReservation } from '../../domain/types';
import { logger } from '../../infrastructure/logger';

export class MockInventoryService implements InventoryService {
  constructor(private inventoryRepository: InventoryRepository) {}

  async reserveStock(
    dto: UpdateStockDTO
  ): Promise<{ success: boolean; orderId: string; message?: string }> {
    logger.debug({ orderId: dto.orderId, items: dto.items }, 'Reserving stock');

    for (const item of dto.items) {
      const product = await this.inventoryRepository.findProductById(item.productId);

      if (!product) {
        logger.error({ productId: item.productId }, 'Product not found');
        return {
          success: false,
          orderId: dto.orderId,
          message: `Product ${item.productId} not found`,
        };
      }

      if (product.quantity < item.quantity) {
        logger.warn(
          { productId: item.productId, available: product.quantity, requested: item.quantity },
          'Insufficient stock'
        );
        return {
          success: false,
          orderId: dto.orderId,
          message: `Insufficient stock for product ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}`,
        };
      }
    }

    const success = Math.random() < 0.85;

    if (success) {
      for (const item of dto.items) {
        const product = await this.inventoryRepository.findProductById(item.productId);
        if (product) {
          const newQuantity = product.quantity - item.quantity;
          await this.inventoryRepository.updateStock(item.productId, newQuantity);
          logger.info(
            { productId: item.productId, oldQuantity: product.quantity, newQuantity },
            'Stock updated'
          );
        }
      }

      const reservation: InventoryReservation = {
        id: crypto.randomUUID(),
        orderId: dto.orderId,
        items: dto.items,
        status: 'RESERVED',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.inventoryRepository.createReservation(reservation);
      logger.info(
        { orderId: dto.orderId, reservationId: reservation.id },
        'Stock reserved successfully'
      );

      return { success: true, orderId: dto.orderId };
    } else {
      logger.error({ orderId: dto.orderId }, 'Stock reservation failed');
      return {
        success: false,
        orderId: dto.orderId,
        message: 'Inventory service temporarily unavailable',
      };
    }
  }
}
