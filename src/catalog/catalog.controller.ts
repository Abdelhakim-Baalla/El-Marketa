import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductDto } from './dto/filter-product.dto';

@Controller('catalog')
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.catalogService.create(createProductDto);
  }

  @Get()
  findAll(@Query() filterDto: FilterProductDto) {
    return this.catalogService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProductDto: UpdateProductDto) {
    return this.catalogService.update(id, updateProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalogService.remove(id);
  }
}
