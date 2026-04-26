import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockInvoiceService } from './MockInvoiceService';
import type { GenerateInvoiceDTO } from '../../domain/types';

vi.mock('../../infrastructure/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('MockInvoiceService', () => {
  let invoiceService: MockInvoiceService;

  beforeEach(() => {
    invoiceService = new MockInvoiceService();
  });

  const validDto: GenerateInvoiceDTO = {
    orderId: 'ORDER-123',
    customer: {
      name: 'João Silva',
      email: 'joao@email.com',
      document: '123.456.789-00',
    },
    items: [
      { productId: '1', productName: 'Notebook', quantity: 1, price: 2999.99 },
      { productId: '2', productName: 'Mouse', quantity: 2, price: 49.99 },
    ],
    totalAmount: 3099.97,
  };

  it('should generate invoice successfully', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const result = await invoiceService.generate(validDto);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBeDefined();
    expect(result.invoiceNumber).toMatch(/^NF-\d+-\d+$/);
    expect(result.accessKey).toBeDefined();
    expect(result.pdfUrl).toBeDefined();
    expect(result.pdfUrl).toContain('https://storage.example.com/invoices/');
  });

  it('should generate unique invoice numbers', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const result1 = await invoiceService.generate(validDto);
    const result2 = await invoiceService.generate(validDto);

    expect(result1.invoiceNumber).not.toBe(result2.invoiceNumber);
  });

  it('should fail when random fails', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95);

    const result = await invoiceService.generate(validDto);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Error generating invoice: SEFAZ unavailable');
    expect(result.invoiceNumber).toBeUndefined();
  });

  it('should handle different item quantities correctly', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const dtoWithMultipleItems: GenerateInvoiceDTO = {
      orderId: 'ORDER-456',
      customer: { name: 'Maria', email: 'maria@email.com' },
      items: [
        { productId: '1', productName: 'Notebook', quantity: 3, price: 2999.99 },
        { productId: '2', productName: 'Mouse', quantity: 5, price: 49.99 },
      ],
      totalAmount: 9249.92,
    };

    const result = await invoiceService.generate(dtoWithMultipleItems);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBeDefined();
  });

  it('should handle single item orders', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);

    const singleItemDto: GenerateInvoiceDTO = {
      orderId: 'ORDER-789',
      customer: { name: 'Pedro', email: 'pedro@email.com' },
      items: [{ productId: '1', productName: 'Notebook', quantity: 1, price: 2999.99 }],
      totalAmount: 2999.99,
    };

    const result = await invoiceService.generate(singleItemDto);

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBeDefined();
  });
});
