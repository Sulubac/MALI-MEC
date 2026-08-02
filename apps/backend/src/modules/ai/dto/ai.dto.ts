import { IsString, IsOptional, IsEnum, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewDocumentDto {
  @ApiProperty() @IsString() documentId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() context?: string;
}

export class AssessRiskDto {
  @ApiProperty() @IsString() dossierId: string;
}

export class SearchLegalDto {
  @ApiProperty() @IsString() query: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() category?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() language?: string;
}

export class GenerateDocumentDto {
  @ApiProperty() @IsString() templateId: string;
  @ApiProperty() @IsString() dossierId: string;
  @ApiProperty() variables: Record<string, string>;
}

export class ChatDto {
  @ApiProperty() @IsString() message: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() context?: string;
  @ApiProperty({ required: false, isArray: true }) @IsOptional() @IsArray() history?: Array<{ role: string; content: string }>;
}
