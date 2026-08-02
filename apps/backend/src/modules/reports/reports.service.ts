import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalClients, totalDossiers, activeDossiers, totalDocuments,
      dossiersByStatus, dossiersByType, revenueThisMonth, revenueThisYear,
      upcomingAppointments, pendingTasks, newClientsThisMonth, completedDossiers
    ] = await Promise.all([
      this.prisma.client.count({ where: { isActive: true } }),
      this.prisma.dossier.count(),
      this.prisma.dossier.count({ where: { status: 'ACTIVE' } }),
      this.prisma.document.count(),
      this.prisma.dossier.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.dossier.groupBy({ by: ['type'], _count: { type: true } }),
      this.prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { status: 'PAID', paidAt: { gte: startOfYear } },
        _sum: { total: true },
      }),
      this.prisma.appointment.count({
        where: { startTime: { gte: now }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
      }),
      this.prisma.task.count({
        where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
      }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.dossier.count({
        where: { status: 'COMPLETED', completedAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      overview: {
        totalClients,
        totalDossiers,
        activeDossiers,
        totalDocuments,
        upcomingAppointments,
        pendingTasks,
        newClientsThisMonth,
        completedDossiers,
      },
      financial: {
        revenueThisMonth: revenueThisMonth._sum.total || 0,
        revenueThisYear: revenueThisYear._sum.total || 0,
      },
      dossiersByStatus,
      dossiersByType,
    };
  }

  async getMonthlyReport(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const [newDossiers, completedDossiers, newClients, invoiced, collected] = await Promise.all([
      this.prisma.dossier.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.dossier.count({ where: { completedAt: { gte: start, lte: end } } }),
      this.prisma.client.count({ where: { createdAt: { gte: start, lte: end } } }),
      this.prisma.invoice.aggregate({
        where: { issueDate: { gte: start, lte: end } },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { paidAt: { gte: start, lte: end }, status: 'PAID' },
        _sum: { total: true },
      }),
    ]);

    return {
      period: { year, month },
      dossiers: { new: newDossiers, completed: completedDossiers },
      clients: { new: newClients },
      financial: {
        invoiced: invoiced._sum.total || 0,
        collected: collected._sum.total || 0,
      },
    };
  }

  async getActivityFeed(limit = 20) {
    return this.prisma.auditLog.findMany({
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
