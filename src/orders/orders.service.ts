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
import { Customer } from './entities/customer.entity';
import { TelegramService } from './telegram.service';
import { ClientOrderNotifyDto } from './dto/client-notify.dto';

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
    @InjectRepository(Customer)
    private readonly customersRepo: Repository<Customer>,
    private readonly tg: TelegramService,
  ) {}

  /** экранирование для подписи в TG */
  private esc(s: string): string {
    return (s ?? '').replace(
      /[<&>]/g,
      (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch]!,
    );
  }

  /** из относительного пути делает абсолютный (по PUBLIC_BASE_URL) */
  private makeAbsolute(fileOrUrl?: string | null): string | null {
    if (!fileOrUrl) return null;
    if (/^https?:\/\//i.test(fileOrUrl)) return fileOrUrl;
    const base = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? '';
    if (!base) return null;
    const tail = String(fileOrUrl).replace(/^\/+/, '');
    return `${base}/${tail}`;
  }

  /** безопасно заберём avatarUrl даже если его нет в типе */
  private pickAvatarRelative(user: Customer): string | null {
    const v = (user as unknown as { avatarUrl?: unknown }).avatarUrl;
    return typeof v === 'string' && v.trim() ? v : null;
  }

  /** плейсхолдер с инициалами (когда нет файла) */
  private initialsAvatar(first?: string | null, last?: string | null): string {
    const name = `${first ?? ''} ${last ?? ''}`.trim() || 'User';
    const enc = encodeURIComponent(name);
    // фирменные цвета: фон — #2b2b2b, текст — #EFE393
    return `https://ui-avatars.com/api/?name=${enc}&background=2b2b2b&color=EFE393&size=512&bold=true`;
  }

  // -----------------------------
  // Основное создание заказа (/checkout)
  // -----------------------------
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

    await this.customersRepo.findOneByOrFail({ id: currentUser.id });

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

    const relative = this.pickAvatarRelative(order.customer);
    const absolute = this.makeAbsolute(relative);

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
        avatarUrl: absolute,
      },
    };

    await this.sendOrderToTelegramFromDb(dto);
    return dto;
  }

  private async sendOrderToTelegramFromDb(order: CreatedOrder): Promise<void> {
    const fullName = this.esc(
      [order.customer.firstName, order.customer.lastName]
        .filter(Boolean)
        .join(' ') || '—',
    );
    const email = this.esc(order.customer.email || '—');

    const lines = order.items.map((i) => {
      const n = this.esc(i.name);
      return `• ${n} × <b>${i.quantity}</b> = <b>${i.lineTotal} ₽</b>`;
    });

    const caption = [
      `👤 <b>${fullName}</b>`,
      `✉️ <u>${email}</u>`,
      '',
      `🛍 <b>Покупка</b>`,
      '────────────────────',
      ...lines,
      '────────────────────',
      `💳 <b>Итого:</b> <b>${order.totalAmount} ₽</b>`,
      `🗓 ${order.createdAt.toLocaleString('ru-RU')}`,
    ].join('\n');

    const photo =
      order.customer.avatarUrl ??
      this.initialsAvatar(order.customer.firstName, order.customer.lastName);

    await this.tg.sendPhoto(photo, caption);
  }

  // -----------------------------
  // NOTIFY из клиента (/checkout/notify)
  // берём профиль (имя/фамилия/email/аватар) из БД,
  // а сведения о позициях — из тела запроса (с colorName = слово).
  // -----------------------------
  async notifyFromClient(
    userId: number,
    dto: ClientOrderNotifyDto,
  ): Promise<void> {
    const user = await this.customersRepo.findOne({
      where: { id: userId },
    });
    if (!user) throw new ForbiddenException('Пользователь не найден');

    const avatarAbs = this.makeAbsolute(this.pickAvatarRelative(user));
    const fullName = this.esc(
      [user.firstName ?? '', user.lastName ?? ''].filter(Boolean).join(' ') ||
        '—',
    );
    const email = this.esc(user.email ?? '—');

    const lines = dto.items.map((i) => {
      const name = this.esc(i.productName);
      const model = i.phoneModel ? `, <i>${this.esc(i.phoneModel)}</i>` : '';
      const color = i.colorName ? `, <b>${this.esc(i.colorName)}</b>` : ''; // ← слово «Красный»
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

    const caption = [
      `👤 <b>${fullName}</b>`,
      `✉️ <u>${email}</u>`,
      '',
      `🛍 <b>Покупка</b>`,
      '────────────────────',
      ...lines,
      '────────────────────',
      `💳 <b>Итого:</b> <b>${totalStr} ₽</b>`,
      `🗓 ${new Date().toLocaleString('ru-RU')}`,
    ].join('\n');

    const photo =
      avatarAbs ?? this.initialsAvatar(user.firstName, user.lastName);
    await this.tg.sendPhoto(photo, caption);
  }
}
