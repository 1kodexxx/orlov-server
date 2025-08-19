// src/orders/orders.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from './entities/product.entity';

import { TelegramService } from './telegram.service';
import { ClientOrderNotifyDto } from './dto/client-notify.dto';
import { UsersService } from '../users/users.service';

// тип-импорт, чтобы избегать any при установке relation
import type { User } from '../users/users.entity';

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
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    avatarUrl: string | null; // абсолютный URL или null
  };
  createdAt: Date;
};

@Injectable()
export class OrdersService {
  private readonly log = new Logger(OrdersService.name);

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
    private readonly tg: TelegramService,
    private readonly users: UsersService,
  ) {}

  /** экранирование для подписи в TG */
  private esc(s: string): string {
    return (s ?? '').replace(
      /[<&>]/g,
      (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch]!,
    );
  }

  /** делает абсолютный URL по PUBLIC_BASE_URL, если пришёл относительный путь */
  private makeAbsolute(fileOrUrl?: string | null): string | null {
    if (!fileOrUrl) return null;
    if (/^https?:\/\//i.test(fileOrUrl)) return fileOrUrl;
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? '';
    if (!base) return null;
    const tail = String(fileOrUrl).replace(/^\/+/, '');
    return `${base}/${tail}`;
  }

  /** плейсхолдер с инициалами (когда нет файла) */
  private initialsAvatar(
    userId: number,
    first?: string | null,
    last?: string | null,
  ): string {
    const name = `${first ?? ''} ${last ?? ''}`.trim() || 'User';
    const enc = encodeURIComponent(name);
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? '';
    return base
      ? `${base}/users/avatar/placeholder/${userId}.png?name=${enc}`
      : `https://ui-avatars.com/api/?name=${enc}&background=2b2b2b&color=EFE393&size=512&bold=true`;
  }

  // --------------------------------------------------
  // /checkout — корзина из БД
  // --------------------------------------------------
  async checkout(currentUser: { id: number }): Promise<CreatedOrder> {
    if (!currentUser?.id) throw new ForbiddenException('Требуется авторизация');

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

    // профиль берём ТОЛЬКО через usersService (никакого legacy Customer)
    const profile = await this.users.getPublicProfile(currentUser.id);
    if (!profile) throw new ForbiddenException('Пользователь не найден');

    // Создание заказа + перенос позиций корзины
    const order = await this.ds.transaction(async (trx) => {
      // ✅ привязка relation: customer_id будет установлен корректно
      const created = await trx.getRepository(Order).save({
        customer: { id: currentUser.id } as User,
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
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        avatarUrl: this.makeAbsolute(profile.avatarUrl),
      },
    };

    await this.sendTg(dto);
    return dto;
  }

  /** Отправка в TG (общая разметка) */
  private async sendTg(order: CreatedOrder): Promise<void> {
    const fullName = this.esc(
      [order.customer.firstName ?? '', order.customer.lastName ?? '']
        .filter(Boolean)
        .join(' ') || '—',
    );
    const email = this.esc(order.customer.email || '—');
    const phone = this.esc(order.customer.phone || '—');

    const lines = order.items.map((i) => {
      const n = this.esc(i.name);
      return `• ${n} × <b>${i.quantity}</b> = <b>${i.lineTotal} ₽</b>`;
    });

    const caption = [
      `👤 <b>${fullName}</b>`,
      `✉️ <u>${email}</u>`,
      `📞 ${phone}`,
      '',
      `🎁 <b>Покупка</b>`,
      '────────────────────',
      ...lines,
      '────────────────────',
      `💳 <b>Итого:</b> <b>${order.totalAmount} ₽</b>`,
      `🗓 ${order.createdAt.toLocaleString('ru-RU')}`,
    ].join('\n');

    const photo =
      order.customer.avatarUrl ??
      this.initialsAvatar(0, order.customer.firstName, order.customer.lastName);

    await this.tg.sendPhoto(photo, caption);
  }

  // --------------------------------------------------
  // /checkout/front — позиции из клиента, профиль из БД
  // --------------------------------------------------
  async notifyFromClient(
    userId: number,
    dto: ClientOrderNotifyDto,
  ): Promise<{ ok: true; orderId: number }> {
    // 1) Профиль — только из БД
    const u = await this.users.getPublicProfile(userId);
    if (!u) throw new ForbiddenException('Пользователь не найден');

    // 2) Формируем текст для Telegram
    const lines = dto.items.map((i) => {
      const name = this.esc(i.productName);
      const model = i.phoneModel ? `, <i>${this.esc(i.phoneModel)}</i>` : '';
      const color = i.colorName ? `, <b>${this.esc(i.colorName)}</b>` : '';
      const qty = i.quantity;
      const sum = i.lineTotal.toLocaleString('ru-RU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `• ${name}${model}${color}\n× ${qty} = <b>${sum} ₽</b>`;
    });

    const totalStr = dto.totalAmount.toLocaleString('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const fullName = this.esc(
      [u.firstName ?? '', u.lastName ?? ''].filter(Boolean).join(' ') || '—',
    );
    const email = this.esc(u.email || '—');
    const phone = this.esc(u.phone || '—');

    const caption = [
      `👤 <b>${fullName}</b>`,
      `✉️ <u>${email}</u>`,
      `📞 ${phone}`,
      '',
      `🎁 <b>Покупка</b>`,
      '────────────────────',
      ...lines,
      '────────────────────',
      `💳 <b>Итого:</b> <b>${totalStr} ₽</b>`,
      `🗓 ${new Date().toLocaleString('ru-RU')}`,
    ].join('\n');

    const avatarAbs = this.makeAbsolute(u.avatarUrl);
    const photo =
      avatarAbs ?? this.initialsAvatar(userId, u.firstName, u.lastName);
    await this.tg.sendPhoto(photo, caption);

    // 3) Сохраняем "виртуальный" заказ: ВАЖНО — relation на user
    const created = await this.ds.getRepository(Order).save({
      customer: { id: userId } as User, // ✅ customer_id заполнится, NOT NULL соблюдён
      orderDate: new Date(),
      status: 'in_transit',
      totalAmount: String(dto.totalAmount.toFixed(2)),
    });

    return { ok: true, orderId: created.id };
  }
}
