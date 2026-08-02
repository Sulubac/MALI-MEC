import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/create-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  private async generateClientNumber(): Promise<string> {
    const count = await this.prisma.client.count();
    const year = new Date().getFullYear();
    return `CLT-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(query?: {
    search?: string; type?: string; kycStatus?: string;
    riskLevel?: string; page?: number; limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (query?.type) where.type = query.type;
    if (query?.kycStatus) where.kycStatus = query.kycStatus;
    if (query?.riskLevel) where.riskLevel = query.riskLevel;
    if (query?.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { companyName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { nationalIdNumber: { contains: query.search, mode: 'insensitive' } },
        { clientNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where, skip, take: limit,
        include: {
          _count: { select: { dossiers: true, appointments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        dossiers: {
          include: { dossier: { select: { id: true, dossierNumber: true, title: true, status: true, type: true } } },
          take: 10,
        },
        appointments: { take: 5, orderBy: { startTime: 'desc' } },
        invoices: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: { select: { dossiers: true, appointments: true, invoices: true } },
      },
    });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async create(dto: CreateClientDto) {
    const clientNumber = await this.generateClientNumber();
    return this.prisma.client.create({
      data: { ...dto, clientNumber },
    });
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);
    return this.prisma.client.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.client.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async updateKyc(id: string, status: string) {
    return this.prisma.client.update({
      where: { id },
      data: { kycStatus: status, kycDate: status === 'VERIFIED' ? new Date() : undefined },
    });
  }

  async updateRisk(id: string, riskScore: number, riskLevel: string) {
    return this.prisma.client.update({
      where: { id },
      data: { riskScore, riskLevel: riskLevel as any },
    });
  }

  async getDossiers(clientId: string) {
    return this.prisma.dossierClient.findMany({
      where: { clientId },
      include: {
        dossier: {
          include: { assignedNotary: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async getStats() {
    const [total, byType, byKyc, byRisk] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.client.groupBy({ by: ['type'], _count: { type: true }, where: { isActive: true } }),
      this.prisma.client.groupBy({ by: ['kycStatus'], _count: { kycStatus: true } }),
      this.prisma.client.groupBy({ by: ['riskLevel'], _count: { riskLevel: true } }),
    ]);
    return { total, byType, byKyc, byRisk };
  }
}
