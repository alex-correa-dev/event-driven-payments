import type { InvoiceService } from '../../domain/interfaces/InvoiceService';
import type { GenerateInvoiceDTO, InvoiceResult } from '../../domain/types';
import { logger } from '../../infrastructure/logger';

export class MockInvoiceService implements InvoiceService {
  async generate(dto: GenerateInvoiceDTO): Promise<InvoiceResult> {
    const delay = Math.floor(Math.random() * 200) + 100;
    await new Promise((resolve) => setTimeout(resolve, delay));

    const success = Math.random() < 0.9;

    if (!success) {
      logger.error(
        { orderId: dto.orderId, totalAmount: dto.totalAmount },
        'Invoice generation failed'
      );
      return {
        success: false,
        message: 'Error generating invoice: SEFAZ unavailable',
      };
    }

    const invoiceNumber = `NF-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const accessKey = `${Date.now()}${Math.floor(Math.random() * 1000000000000)}`;

    logger.info(
      {
        orderId: dto.orderId,
        invoiceNumber,
        accessKey,
        totalAmount: dto.totalAmount,
        itemsCount: dto.items.length,
      },
      'Invoice generated successfully'
    );

    return {
      success: true,
      invoiceNumber,
      accessKey,
      pdfUrl: `https://storage.example.com/invoices/${invoiceNumber}.pdf`,
    };
  }
}
