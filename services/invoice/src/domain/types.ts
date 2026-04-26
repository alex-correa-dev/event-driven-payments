export interface Invoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  customer: {
    name: string;
    email: string;
    document?: string;
  };
  items: InvoiceItem[];
  totalAmount: number;
  taxAmount: number;
  status: 'PENDING' | 'GENERATED' | 'FAILED';
  createdAt: Date;
  pdfUrl?: string;
  accessKey?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
}

export interface GenerateInvoiceDTO {
  orderId: string;
  customer: {
    name: string;
    email: string;
    document?: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
}

export interface InvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  accessKey?: string;
  pdfUrl?: string;
  message?: string;
}
