import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto, RecordPaymentDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Invoices')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get() @ApiOperation({ summary: 'List invoices' })
  findAll(@Query() query: any) { return this.invoicesService.findAll(query); }

  @Get('revenue') @ApiOperation({ summary: 'Revenue summary' })
  getRevenueSummary(@Query('year') year: number) { return this.invoicesService.getRevenueSummary(year); }

  @Get(':id') @ApiOperation({ summary: 'Get invoice details' })
  findOne(@Param('id') id: string) { return this.invoicesService.findOne(id); }

  @Post() @ApiOperation({ summary: 'Create invoice' })
  create(@Body() dto: CreateInvoiceDto) { return this.invoicesService.create(dto); }

  @Post(':id/payment') @ApiOperation({ summary: 'Record payment' })
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) { return this.invoicesService.recordPayment(id, dto); }
}
