import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class InvoiceItemDto {
  @ApiProperty() @IsString() description: string;
  @ApiProperty() @IsNumber() quantity: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() taxRate?: number;
}

export class CreateInvoiceDto {
  @ApiProperty() @IsString() clientId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() dossierId?: string;
  @ApiProperty({ type: [InvoiceItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto) items: InvoiceItemDto[];
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() taxRate?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() discount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dueDate?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() currency?: string;
}

export class RecordPaymentDto {
  @ApiProperty() @IsNumber() amount: number;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) method: PaymentMethod;
  @ApiProperty({ required: false }) @IsOptional() @IsString() reference?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}
