import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PropertiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(params: any) {
    const { search, type, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (type) where.type = type;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { address: { contains: search, mode: 'insensitive' } },
      { cadastralNumber: { contains: search, mode: 'insensitive' } },
      { propertyNumber: { contains: search, mode: 'insensitive' } },
    ];
    const [data, total] = await Promise.all([
      this.prisma.property.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: { owners: { include: { client: { select: { id: true, firstName: true, lastName: true, companyName: true } } } } } }),
      this.prisma.property.count({ where }),
    ]);
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const p = await this.prisma.property.findUnique({
      where: { id },
      include: {
        owners: { include: { client: true } },
        mortgages: true,
        transfers: { orderBy: { transferDate: 'desc' } },
        dossiers: { select: { id: true, dossierNumber: true, title: true, type: true, status: true } },
      },
    });
    if (!p) throw new NotFoundException('Bien immobilier introuvable');
    return p;
  }

  async create(data: any) {
    const count = await this.prisma.property.count();
    const propertyNumber = `PROP-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;
    return this.prisma.property.create({ data: { ...data, propertyNumber } });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.property.update({ where: { id }, data });
  }

  async addOwner(propertyId: string, clientId: string, sharePercent: number) {
    return this.prisma.propertyOwner.create({ data: { propertyId, clientId, sharePercent, since: new Date() } });
  }

  async search(q: string) {
    return this.prisma.property.findMany({
      where: { OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { cadastralNumber: { contains: q, mode: 'insensitive' } },
        { address: { contains: q, mode: 'insensitive' } },
      ]},
      take: 10,
      select: { id: true, propertyNumber: true, title: true, address: true, type: true, cadastralNumber: true },
    });
  }
}
