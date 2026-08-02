import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getPublicSettings() {
    return this.prisma.setting.findMany({ where: { isPublic: true } });
  }

  async getAllSettings() {
    return this.prisma.setting.findMany();
  }

  async getSetting(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async setSetting(key: string, value: string, category: string, isPublic = false) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value, category, isPublic },
      create: { key, value, category, isPublic },
    });
  }

  async bulkUpdate(settings: Array<{ key: string; value: string; category: string }>) {
    return Promise.all(settings.map(s => this.setSetting(s.key, s.value, s.category)));
  }
}
