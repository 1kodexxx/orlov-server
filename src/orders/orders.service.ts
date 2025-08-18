import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from './entities/product.entity';
import { Customer } from './entities/customer.entity';
import { TelegramService } from './telegram.service';

export type CreatedOrder = {
  orderId: number;
  status: string;
  totalAmount: string;
  currency: 'RUB';
  items: Array<{
    productId: number;
    name: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl: string | null;
  };
  createdAt: Date;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(Cart) private readonly cartsRepo: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemsRepo: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productsRepo: Repository<Product>,
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    private readonly tg: TelegramService,
  ) {}

  private esc(s: string): string {
    return (s ?? '').replace(
      /[<&>]/g,
      (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch]!,
    );
  }

  private toAbsoluteUrl(
    maybeRelative: string | null | undefined,
  ): string | null {
    if (!maybeRelative) return null;
    if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? '';
    if (!base) return null;
    const tail = String(maybeRelative).replace(/^\/+/, '');
    return `${base}/${tail}`;
  }

  /** Безопасно достаем аватар, даже если поля нет в типе Customer */
  private pickAvatarUrl(c: Customer): string | null {
    const v = (c as unknown as { avatarUrl?: unknown }).avatarUrl;
    return typeof v === 'string' ? v : null;
  }

  private initialsAvatar(first: string, last: string): string {
    const name = `${first || ''} ${last || ''}`.trim() || 'User';
    const enc = encodeURIComponent(name);
    return `https://ui-avatars.com/api/?name=${enc}&background=2b2b2b&color=EFE393&size=512&bold=true`;
  }

  async checkout(currentUser: { id: number }): Promise<CreatedOrder> {
    if (!currentUser?.id) {
      throw new ForbiddenException('Требуется авторизация');
    }

    const cart = await this.cartsRepo.findOne({
      where: { customerId: currentUser.id },
      order: { id: 'DESC' as const },
    });
    if (!cart) throw new BadRequestException('Корзина пуста');

    const items = await this.cartItemsRepo.find({
      where: { cartId: cart.id },
      relations: { product: true },
    });
    if (items.length === 0) throw new BadRequestException('Корзина пуста');

    await this.customersRepo.findOneByOrFail({ id: currentUser.id }); // проверка существования

    const order = await this.ds.transaction(async (trx) => {
      const created = await trx.getRepository(Order).save({
        customerId: currentUser.id,
        orderDate: new Date(),
        status: 'in_transit',
        totalAmount: '0.00',
      });

      const orderItems = items.map((ci) =>
        trx.getRepository(OrderItem).create({
          orderId: created.id,
          productId: ci.productId,
          quantity: ci.qty,
          unitPrice: (ci.product?.price ?? '0.00').toString(),
        }),
      );
      await trx.getRepository(OrderItem).save(orderItems);
      await trx.getRepository(CartItem).delete({ cartId: cart.id });

      return trx.getRepository(Order).findOneOrFail({
        where: { id: created.id },
        relations: { items: { product: true }, customer: true },
      });
    });

    const dto: CreatedOrder = {
      orderId: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: 'RUB',
      createdAt: order.orderDate,
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.product?.name ?? '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      customer: {
        firstName: order.customer.firstName ?? '',
        lastName: order.customer.lastName ?? '',
        email: order.customer.email ?? '',
        // ✅ берём аватар безопасно и делаем его абсолютным
        avatarUrl: this.toAbsoluteUrl(this.pickAvatarUrl(order.customer)),
      },
    };

    await this.sendOrderToTelegram(dto);
    return dto;
  }

  private async sendOrderToTelegram(order: CreatedOrder): Promise<void> {
    const nameLine = [order.customer.firstName, order.customer.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const fullName = this.esc(nameLine || '—');
    const email = this.esc(order.customer.email || '—');

    const lines = order.items.map((i) => {
      const n = this.esc(i.name);
      return `• ${n} × <b>${i.quantity}</b> = <b>${i.lineTotal} ₽</b>`;
    });

    const caption = [
      `👤 <b>${fullName}</b>`,
      `✉️ <u>${email}</u>`,
      '',
      `🛒 <b>Заказ №${order.orderId}</b>`,
      '────────────────────',
      ...lines,
      '────────────────────',
      `💳 <b>К оплате:</b> <b>${order.totalAmount} ₽</b>`,
      `🏷 <i>${order.status}</i> · 🗓 ${order.createdAt.toISOString()}`,
    ].join('\n');

    const photo =
      order.customer.avatarUrl ??
      this.initialsAvatar(order.customer.firstName, order.customer.lastName);

    await this.tg.sendPhoto(photo, caption);
  }
}
