import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DossierType, DossierStatus, TaskPriority } from '@prisma/client';

export class CreateDossierDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ enum: DossierType }) @IsEnum(DossierType) type: DossierType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() assignedNotaryId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() propertyId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() estimatedValue?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() deadlineAt?: string;
  @ApiProperty({ enum: TaskPriority, required: false }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiProperty({ required: false, isArray: true }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class UpdateDossierDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ enum: DossierStatus, required: false }) @IsOptional() @IsEnum(DossierStatus) status?: DossierStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() assignedNotaryId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() estimatedValue?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() notaryFees?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() deadlineAt?: string;
  @ApiProperty({ enum: TaskPriority, required: false }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false, isArray: true }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class AddClientToDossierDto {
  @ApiProperty() @IsString() clientId: string;
  @ApiProperty() @IsString() role: string;
}
