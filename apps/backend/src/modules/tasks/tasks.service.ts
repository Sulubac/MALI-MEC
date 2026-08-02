import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskStatus, TaskPriority } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: any) {
    const { assigneeId, dossierId, status, priority, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (assigneeId) where.assigneeId = assigneeId;
    if (dossierId) where.dossierId = dossierId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({ where, skip, take: limit, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          dossier: { select: { id: true, dossierNumber: true, title: true } },
          _count: { select: { subTasks: true } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async create(data: any, createdById: string) {
    return this.prisma.task.create({ data: { ...data, createdById } });
  }

  async update(id: string, data: any) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Tâche introuvable');
    return this.prisma.task.update({
      where: { id },
      data: { ...data, completedAt: data.status === TaskStatus.COMPLETED ? new Date() : task.completedAt },
    });
  }

  async getMyTasks(userId: string) {
    return this.prisma.task.findMany({
      where: { assigneeId: userId, status: { not: TaskStatus.COMPLETED } },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
      include: { dossier: { select: { id: true, dossierNumber: true, title: true } } },
      take: 20,
    });
  }

  async getOverdueTasks() {
    return this.prisma.task.findMany({
      where: { dueDate: { lt: new Date() }, status: { notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } },
      include: {
        assignee: { select: { firstName: true, lastName: true, email: true } },
        dossier: { select: { dossierNumber: true, title: true } },
      },
    });
  }
}
