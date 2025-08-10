import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { ShopService } from './shop.service';
import { GetShopParamsDto, QueryShopDto } from './dto/query-shop.dto';
import { IncrementProductViewInterceptor } from '../views/increment-product-view.interceptor';

@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get()
  async list(@Query() query: QueryShopDto) {
    return this.shop.findAll(query);
  }

  @Get('search')
  async search(@Query() query: QueryShopDto) {
    return this.shop.findAll(query);
  }

  @UseInterceptors(IncrementProductViewInterceptor)
  @Get(':id')
  async byId(@Param() params: GetShopParamsDto, @Req() req: Request) {
    const uid = req.user?.sub;
    return this.shop.findOneWithUser(params.id, uid);
  }

  @Get('/_meta/categories')
  async categories() {
    return this.shop.getCategories();
  }

  @Get('/_meta/models')
  async models() {
    return this.shop.getPhoneModels();
  }
}
