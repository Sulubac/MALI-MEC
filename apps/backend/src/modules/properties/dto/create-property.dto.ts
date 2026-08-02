import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePropertyDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() type: string;
  @ApiProperty() @IsString() address: string;
  @ApiProperty() @IsString() city: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() district?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() area?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() rooms?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() cadastralNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() titleDeedNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() estimatedValue?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isEncumbered?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isMortgaged?: boolean;
}
