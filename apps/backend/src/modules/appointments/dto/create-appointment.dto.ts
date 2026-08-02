import { IsString, IsOptional, IsDateString, IsBoolean, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppointmentType } from '@prisma/client';

export class CreateAppointmentDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ enum: AppointmentType }) @IsEnum(AppointmentType) type: AppointmentType;
  @ApiProperty() @IsDateString() startTime: string;
  @ApiProperty() @IsDateString() endTime: string;
  @ApiProperty() @IsNumber() duration: number;
  @ApiProperty() @IsString() notaryId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() clientId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() dossierId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isVirtual?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() meetingLink?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() room?: string;
}
