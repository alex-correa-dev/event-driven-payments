import type { UpdateStockDTO } from '../types';

export interface InventoryService {
  reserveStock(
    dto: UpdateStockDTO
  ): Promise<{ success: boolean; orderId: string; message?: string }>;
}
