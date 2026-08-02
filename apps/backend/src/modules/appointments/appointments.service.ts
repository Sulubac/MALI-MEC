import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: any) {
    const { notaryId, clientId, status, startDate, endDate, page = 1, limit = 50 } = params;
    const where: any = {};
    if (notaryId) where.notaryId = notaryId;
    if (clientId) where.clientId = clientId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }
    return this.prisma.appointment.findMany({
      where, take: limit, skip: (page - 1) * limit,
      orderBy: { startTime: 'asc' },
      include: {
        notary: { select: { id: true, firstName: true, lastName: true } },
        client: { select: { id: true, firstName: true, lastName: true, companyName: true } },
        dossier: { select: { id: true, dossierNumber: true, title: true } },
      },
    });
  }

  async findOne(id: string) {
    const a = await this.prisma.appointment.findUnique({
      where: { id },
      include: { notary: true, client: true, dossier: true },
    });
    if (!a) throw new NotFoundException('Rendez-vous introuvable');
    return a;
  }

  async create(data: any) { return this.prisma.appointment.create({ data }); }
  async update(id: string, data: any) { return this.prisma.appointment.update({ where: { id }, data }); }
  async cancel(id: string) { return this.prisma.appointment.update({ where: { id }, data: { status: 'CANCELLED' } }); }

  async getTodayAppointments(notaryId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const where: any = { startTime: { gte: today, lt: tomorrow } };
    if (notaryId) where.notaryId = notaryId;
    return this.prisma.appointment.findMany({
      where, orderBy: { startTime: 'asc' },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, companyName: true, phone: true } },
        notary: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
