import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async globalSearch(query: string) {
    if (!query || query.length < 2) return { clients: [], dossiers: [], documents: [], properties: [] };

    const searchOptions = { contains: query, mode: 'insensitive' as const };

    const [clients, dossiers, documents, properties] = await Promise.all([
      this.prisma.client.findMany({
        where: {
          isActive: true,
          OR: [
            { firstName: searchOptions }, { lastName: searchOptions },
            { companyName: searchOptions }, { email: searchOptions },
            { nationalIdNumber: searchOptions }, { clientNumber: searchOptions },
          ],
        },
        select: { id: true, firstName: true, lastName: true, companyName: true, type: true, clientNumber: true },
        take: 5,
      }),
      this.prisma.dossier.findMany({
        where: {
          OR: [
            { title: searchOptions }, { dossierNumber: searchOptions }, { description: searchOptions },
          ],
        },
        select: { id: true, title: true, dossierNumber: true, type: true, status: true },
        take: 5,
      }),
      this.prisma.document.findMany({
        where: {
          OR: [
            { title: searchOptions }, { documentNumber: searchOptions },
          ],
        },
        select: { id: true, title: true, documentNumber: true, type: true, status: true },
        take: 5,
      }),
      this.prisma.property.findMany({
        where: {
          OR: [
            { title: searchOptions }, { address: searchOptions },
            { cadastralNumber: searchOptions }, { propertyNumber: searchOptions },
          ],
        },
        select: { id: true, title: true, propertyNumber: true, type: true, address: true },
        take: 5,
      }),
    ]);

    return { clients, dossiers, documents, properties, query };
  }
}
