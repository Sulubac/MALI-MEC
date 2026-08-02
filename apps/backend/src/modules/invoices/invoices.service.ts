import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/create-invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  private async generateInvoiceNumber(): Promise<string> {
    const count = await this.prisma.invoice.count();
    const year = new Date().getFullYear();
    return `INV-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(query?: { clientId?: string; dossierId?: string; status?: string; page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const where: any = {};
    if (query?.clientId) where.clientId = query.clientId;
    if (query?.dossierId) where.dossierId = query.dossierId;
    if (query?.status) where.status = query.status;
    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: {
          client: { select: { firstName: true, lastName: true, companyName: true } },
          dossier: { select: { dossierNumber: true, title: true } },
          _count: { select: { items: true, payments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        client: true,
        dossier: { select: { dossierNumber: true, title: true } },
        items: true,
        payments: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(dto: CreateInvoiceDto) {
    const invoiceNumber = await this.generateInvoiceNumber();
    const subtotal = dto.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxRate = dto.taxRate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const discount = dto.discount || 0;
    const total = subtotal + taxAmount - discount;

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        clientId: dto.clientId,
        dossierId: dto.dossierId,
        subtotal,
        taxRate,
        taxAmount,
        discount,
        total,
        balance: total,
        currency: dto.currency || 'DJF',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        items: {
          create: dto.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.quantity * item.unitPrice,
            taxRate: item.taxRate || 0,
          })),
        },
      },
      include: { items: true },
    });
  }

  async recordPayment(invoiceId: string, dto: RecordPaymentDto) {
    const invoice = await this.findOne(invoiceId);
    if (dto.amount > invoice.balance) {
      throw new BadRequestException('Payment exceeds balance');
    }

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount: dto.amount,
        method: dto.method,
        status: 'PAID',
        reference: dto.reference,
        notes: dto.notes,
        paidAt: new Date(),
      },
    });

    const newPaid = invoice.paid + dto.amount;
    const newBalance = invoice.total - newPaid;
    const status = newBalance <= 0 ? 'PAID' : 'PARTIAL';

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paid: newPaid,
        balance: newBalance,
        status: status as any,
        paidAt: status === 'PAID' ? new Date() : undefined,
      },
    });

    return payment;
  }

  async getRevenueSummary(year?: number) {
    const targetYear = year || new Date().getFullYear();
    const start = new Date(targetYear, 0, 1);
    const end = new Date(targetYear, 11, 31);

    const [totalRevenue, byMonth, byStatus] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { createdAt: { gte: start, lte: end }, status: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.$queryRaw`
        SELECT EXTRACT(MONTH FROM "created_at") as month, SUM(total) as revenue
        FROM invoices
        WHERE created_at >= ${start} AND created_at <= ${end} AND status = 'PAID'
        GROUP BY month ORDER BY month
      `,
      this.prisma.invoice.groupBy({
        by: ['status'],
        _count: { status: true },
        _sum: { total: true },
      }),
    ]);

    return { totalRevenue: totalRevenue._sum.total || 0, byMonth, byStatus };
  }
}
