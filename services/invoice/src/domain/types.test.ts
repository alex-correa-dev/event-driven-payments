import { describe, it, expect } from 'vitest';
import type { Invoice, InvoiceItem, GenerateInvoiceDTO, InvoiceResult } from './types';

describe('Invoice Types', () => {
  it('should have valid Invoice structure', () => {
    const invoice: Invoice = {
      id: 'inv-123',
      invoiceNumber: 'NF-12345',
      orderId: 'ORD-123',
      customer: { name: 'João', email: 'joao@email.com' },
      items: [],
      totalAmount: 100,
      taxAmount: 10,
      status: 'PENDING',
      createdAt: new Date(),
    };

    expect(invoice.id).toBe('inv-123');
    expect(invoice.status).toBe('PENDING');
  });

  it('should have optional fields in Invoice', () => {
    const invoice: Invoice = {
      id: 'inv-123',
      invoiceNumber: 'NF-12345',
      orderId: 'ORD-123',
      customer: { name: 'João', email: 'joao@email.com' },
      items: [],
      totalAmount: 100,
      taxAmount: 10,
      status: 'GENERATED',
      createdAt: new Date(),
      pdfUrl: 'https://example.com/invoice.pdf',
      accessKey: '12345678901234567890123456789012345678901234',
    };

    expect(invoice.pdfUrl).toBeDefined();
    expect(invoice.accessKey).toBeDefined();
  });

  it('should have valid InvoiceItem structure', () => {
    const item: InvoiceItem = {
      productId: '1',
      productName: 'Notebook',
      quantity: 2,
      price: 2999.99,
      total: 5999.98,
    };

    expect(item.productId).toBe('1');
    expect(item.total).toBe(5999.98);
  });

  it('should have valid GenerateInvoiceDTO structure', () => {
    const dto: GenerateInvoiceDTO = {
      orderId: 'ORD-123',
      customer: { name: 'João', email: 'joao@email.com', document: '123.456.789-00' },
      items: [{ productId: '1', productName: 'Notebook', quantity: 1, price: 2999.99 }],
      totalAmount: 2999.99,
    };

    expect(dto.customer.document).toBe('123.456.789-00');
    expect(dto.totalAmount).toBe(2999.99);
  });

  it('should have valid InvoiceResult structure', () => {
    const result: InvoiceResult = {
      success: true,
      invoiceNumber: 'NF-12345',
      accessKey: '1234567890',
      pdfUrl: 'https://example.com/invoice.pdf',
    };

    expect(result.success).toBe(true);
    expect(result.invoiceNumber).toBeDefined();
  });

  it('should have failed InvoiceResult', () => {
    const result: InvoiceResult = {
      success: false,
      message: 'SEFAZ unavailable',
    };

    expect(result.success).toBe(false);
    expect(result.message).toBe('SEFAZ unavailable');
  });
});
