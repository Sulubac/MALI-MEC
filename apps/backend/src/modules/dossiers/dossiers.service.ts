import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDossierDto, UpdateDossierDto, AddClientToDossierDto } from './dto/create-dossier.dto';

@Injectable()
export class DossiersService {
  constructor(private prisma: PrismaService) {}

  private async generateDossierNumber(type: string): Promise<string> {
    const count = await this.prisma.dossier.count();
    const year = new Date().getFullYear();
    const prefix = type.substring(0, 3).toUpperCase();
    return `DOS-${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(query?: {
    search?: string; status?: string; type?: string; assignedNotaryId?: string;
    page?: number; limit?: number; priority?: string;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = {};

    if (query?.status) where.status = query.status;
    if (query?.type) where.type = query.type;
    if (query?.priority) where.priority = query.priority;
    if (query?.assignedNotaryId) where.assignedNotaryId = query.assignedNotaryId;
    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { dossierNumber: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.dossier.findMany({
        where, skip, take: limit,
        include: {
          assignedNotary: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          clients: {
            include: { client: { select: { id: true, firstName: true, lastName: true, companyName: true, type: true } } },
            take: 3,
          },
          _count: { select: { documents: true, tasks: true } },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.dossier.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const dossier = await this.prisma.dossier.findUnique({
      where: { id },
      include: {
        assignedNotary: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        clients: {
          include: { client: true },
        },
        documents: {
          select: { id: true, documentNumber: true, title: true, type: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        tasks: {
          include: { assignee: { select: { firstName: true, lastName: true } } },
          orderBy: { dueDate: 'asc' },
        },
        appointments: {
          orderBy: { startTime: 'desc' },
          take: 5,
        },
        timeline: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        property: true,
        _count: { select: { documents: true, tasks: true, comments: true } },
      },
    });
    if (!dossier) throw new NotFoundException('Dossier not found');
    return dossier;
  }

  async create(dto: CreateDossierDto, createdById: string) {
    const dossierNumber = await this.generateDossierNumber(dto.type);
    const dossier = await this.prisma.dossier.create({
      data: {
        ...dto,
        dossierNumber,
        createdById,
      },
    });

    await this.prisma.timelineEntry.create({
      data: {
        dossierId: dossier.id,
        action: 'CREATED',
        description: `Dossier ${dossierNumber} créé`,
        userId: createdById,
      },
    });

    return dossier;
  }

  async update(id: string, dto: UpdateDossierDto, userId: string) {
    const dossier = await this.findOne(id);
    const updated = await this.prisma.dossier.update({ where: { id }, data: dto });

    if (dto.status && dto.status !== dossier.status) {
      await this.prisma.timelineEntry.create({
        data: {
          dossierId: id,
          action: 'STATUS_CHANGED',
          description: `Statut changé: ${dossier.status} → ${dto.status}`,
          userId,
          metadata: { from: dossier.status, to: dto.status },
        },
      });
    }

    return updated;
  }

  async addClient(dossierId: string, dto: AddClientToDossierDto) {
    await this.findOne(dossierId);
    return this.prisma.dossierClient.create({
      data: { dossierId, clientId: dto.clientId, role: dto.role },
    });
  }

  async removeClient(dossierId: string, clientId: string) {
    return this.prisma.dossierClient.deleteMany({
      where: { dossierId, clientId },
    });
  }

  async getTimeline(dossierId: string) {
    return this.prisma.timelineEntry.findMany({
      where: { dossierId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async addComment(dossierId: string, content: string, userId: string, isInternal = false) {
    return this.prisma.comment.create({
      data: { dossierId, content, userId, isInternal },
      include: { user: { select: { firstName: true, lastName: true, avatar: true } } },
    });
  }

  async getComments(dossierId: string) {
    return this.prisma.comment.findMany({
      where: { dossierId },
      include: { user: { select: { firstName: true, lastName: true, avatar: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async archive(id: string, userId: string) {
    return this.update(id, { status: 'ARCHIVED' as any }, userId);
  }

  async getStats() {
    const [total, byStatus, byType, overdue] = await Promise.all([
      this.prisma.dossier.count(),
      this.prisma.dossier.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.dossier.groupBy({ by: ['type'], _count: { type: true } }),
      this.prisma.dossier.count({
        where: {
          deadlineAt: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'ARCHIVED', 'CANCELLED'] },
        },
      }),
    ]);
    return { total, byStatus, byType, overdue };
  }
}
