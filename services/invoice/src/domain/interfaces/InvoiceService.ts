import type { GenerateInvoiceDTO, InvoiceResult } from '../types';

export interface InvoiceService {
  generate(dto: GenerateInvoiceDTO): Promise<InvoiceResult>;
}
