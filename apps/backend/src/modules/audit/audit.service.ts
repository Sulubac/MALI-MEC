import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    action: string; entity: string; entityId?: string; userId?: string;
    dossierId?: string; documentId?: string; ipAddress?: string; userAgent?: string;
    oldData?: any; newData?: any; description?: string;
  }) {
    return this.prisma.auditLog.create({ data: data as any });
  }

  async findAll(query?: { entity?: string; userId?: string; action?: string; page?: number; limit?: number }) {
    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const where: any = {};
    if (query?.entity) where.entity = query.entity;
    if (query?.userId) where.userId = query.userId;
    if (query?.action) where.action = query.action;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, skip: (page - 1) * limit, take: limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }
}
