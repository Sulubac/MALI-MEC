import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType, DocumentStatus, Language } from '@prisma/client';

export class CreateDocumentDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty({ enum: DocumentType }) @IsEnum(DocumentType) type: DocumentType;
  @ApiProperty({ enum: Language, required: false }) @IsOptional() @IsEnum(Language) language?: Language;
  @ApiProperty({ required: false }) @IsOptional() @IsString() dossierId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() templateId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() content?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() htmlContent?: string;
}

export class UpdateDocumentDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() title?: string;
  @ApiProperty({ enum: DocumentStatus, required: false }) @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
  @ApiProperty({ required: false }) @IsOptional() @IsString() content?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() htmlContent?: string;
}
