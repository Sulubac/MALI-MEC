import { IsString, IsOptional, IsEmail, IsEnum, IsBoolean, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClientType, RiskLevel } from '@prisma/client';

export class CreateClientDto {
  @ApiProperty({ enum: ClientType }) @IsEnum(ClientType) type: ClientType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lastName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() dateOfBirth?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() placeOfBirth?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() nationality?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() companyName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() registrationNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vatNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() legalForm?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone2?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() country?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() nationalIdNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() passportNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() tinNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() pepStatus?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class UpdateClientDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lastName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() city?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ enum: RiskLevel, required: false }) @IsOptional() @IsEnum(RiskLevel) riskLevel?: RiskLevel;
}
