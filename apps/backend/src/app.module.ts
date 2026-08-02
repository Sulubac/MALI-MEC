import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DossiersModule } from './modules/dossiers/dossiers.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { AiModule } from './modules/ai/ai.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditModule } from './modules/audit/audit.module';
import { SearchModule } from './modules/search/search.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SettingsModule } from './modules/settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    DossiersModule,
    DocumentsModule,
    PropertiesModule,
    AppointmentsModule,
    TasksModule,
    InvoicesModule,
    AiModule,
    NotificationsModule,
    AuditModule,
    SearchModule,
    ReportsModule,
    SettingsModule,
  ],
})
export class AppModule {}
