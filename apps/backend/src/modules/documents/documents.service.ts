import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDocumentDto, UpdateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  private async generateDocumentNumber(): Promise<string> {
    const count = await this.prisma.document.count();
    const year = new Date().getFullYear();
    return `DOC-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  async findAll(query?: {
    search?: string; type?: string; status?: string; dossierId?: string;
    page?: number; limit?: number;
  }) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;
    const where: any = { parentDocumentId: null };

    if (query?.type) where.type = query.type;
    if (query?.status) where.status = query.status;
    if (query?.dossierId) where.dossierId = query.dossierId;
    if (query?.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { documentNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where, skip, take: limit,
        include: {
          createdBy: { select: { firstName: true, lastName: true } },
          dossier: { select: { id: true, dossierNumber: true, title: true } },
          _count: { select: { signatures: true, versions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        dossier: { select: { id: true, dossierNumber: true, title: true } },
        template: true,
        signatures: {
          include: { signer: { select: { firstName: true, lastName: true, role: true } } },
        },
        versions: {
          select: { id: true, version: true, createdAt: true },
          orderBy: { version: 'desc' },
        },
      },
    });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async create(dto: CreateDocumentDto, createdById: string) {
    const documentNumber = await this.generateDocumentNumber();
    return this.prisma.document.create({
      data: { ...dto, documentNumber, createdById },
    });
  }

  async update(id: string, dto: UpdateDocumentDto) {
    await this.findOne(id);
    return this.prisma.document.update({ where: { id }, data: dto });
  }

  async createVersion(id: string, createdById: string) {
    const original = await this.findOne(id);
    const documentNumber = await this.generateDocumentNumber();
    return this.prisma.document.create({
      data: {
        documentNumber,
        title: `${original.title} (v${original.version + 1})`,
        type: original.type,
        status: 'DRAFT',
        language: original.language,
        content: original.content,
        htmlContent: original.htmlContent,
        dossierId: original.dossierId,
        createdById,
        version: original.version + 1,
        parentDocumentId: original.id,
      },
    });
  }

  async requestSignature(documentId: string, signerIds: string[]) {
    const signatures = await Promise.all(
      signerIds.map((signerId, index) =>
        this.prisma.signature.create({
          data: { documentId, signerId, order: index + 1 },
        }),
      ),
    );
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'UNDER_REVIEW' },
    });
    return signatures;
  }

  async sign(documentId: string, signerId: string, signatureData?: string) {
    await this.prisma.signature.updateMany({
      where: { documentId, signerId },
      data: {
        status: 'SIGNED',
        signedAt: new Date(),
        signatureData,
      },
    });

    const pending = await this.prisma.signature.count({
      where: { documentId, status: 'PENDING' },
    });

    if (pending === 0) {
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'SIGNED', signedAt: new Date() },
      });
    }

    return { signed: true, allSigned: pending === 0 };
  }

  async getTemplates(type?: string) {
    const where: any = { isActive: true };
    if (type) where.type = type;
    return this.prisma.documentTemplate.findMany({ where });
  }

  async generateFromTemplate(templateId: string, variables: Record<string, string>, dossierId: string, createdById: string) {
    const template = await this.prisma.documentTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new NotFoundException('Template not found');

    let content = template.content;
    Object.entries(variables).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    await this.prisma.documentTemplate.update({
      where: { id: templateId },
      data: { usageCount: { increment: 1 } },
    });

    const documentNumber = await this.generateDocumentNumber();
    return this.prisma.document.create({
      data: {
        documentNumber,
        title: template.name,
        type: template.type,
        templateId,
        content,
        htmlContent: content,
        dossierId,
        createdById,
        language: template.language,
      },
    });
  }

  async getStats() {
    const [total, byType, byStatus] = await Promise.all([
      this.prisma.document.count(),
      this.prisma.document.groupBy({ by: ['type'], _count: { type: true } }),
      this.prisma.document.groupBy({ by: ['status'], _count: { status: true } }),
    ]);
    return { total, byType, byStatus };
  }
}
