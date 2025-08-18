import { BadRequestException } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsOrderValue } from 'typeorm';

import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { TelegramService } from './telegram.service';

import { Customer } from './entities/customer.entity';
import { Product } from './entities/product.entity';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';

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

  /**
   * Создать заказ из корзины авторизованного пользователя.
   * Статус: 'in_transit' (разрешён CHECK).
   * total_amount пересчитает триггер recalc_order_total().
   */
  async checkout(currentUser: { id: number }) {
    if (!currentUser?.id) {
      throw new ForbiddenException('Требуется авторизация');
    }

    // Последняя корзина пользователя
    const cart = await this.cartsRepo.findOne({
      where: { customerId: currentUser.id },
      order: { id: 'DESC' as FindOptionsOrderValue },
    });
    if (!cart) throw new BadRequestException('Корзина пуста');

    const items = await this.cartItemsRepo.find({
      where: { cartId: cart.id },
      relations: { product: true },
    });
    if (items.length === 0) throw new BadRequestException('Корзина пуста');

    const customer = await this.customersRepo.findOneByOrFail({
      id: currentUser.id,
    });

    const order = await this.ds.transaction(async (trx) => {
      const created = await trx.getRepository(Order).save({
        customerId: customer.id,
        orderDate: new Date(),
        status: 'in_transit',
        totalAmount: '0.00', // пересчитается триггером
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

      // очистка корзины
      await trx.getRepository(CartItem).delete({ cartId: cart.id });

      // вернуть заказ с составом и покупателем
      return trx.getRepository(Order).findOneOrFail({
        where: { id: created.id },
        relations: { items: { product: true }, customer: true },
      });
    });

    await this.tg.send(this.buildTelegramHtml(order));

    return {
      orderId: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: 'RUB',
      items: order.items.map((i) => ({
        productId: i.productId,
        name: i.product?.name ?? '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      customer: {
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        email: order.customer.email,
      },
      createdAt: order.orderDate,
    };
  }

  private buildTelegramHtml(order: Order): string {
    // Без индексирования по объекту — чтобы TS не придирался
    const esc = (s: string) =>
      (s ?? '').replace(/[<&>]/g, (ch) =>
        ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;',
      );

    const lines = order.items
      .map(
        (i) =>
          `• <b>${esc(i.product?.name ?? 'Товар')}</b> × ${i.quantity} = <b>${i.lineTotal} ₽</b>`,
      )
      .join('\n');

    return [
      `<b>Новый заказ №${order.id}</b>`,
      '',
      `<b>Клиент:</b> ${esc(order.customer.firstName)} ${esc(order.customer.lastName)}`,
      `<b>Email:</b> ${esc(order.customer.email)}`,
      '',
      `<b>Состав:</b>`,
      lines,
      '',
      `<b>Итого:</b> ${order.totalAmount} ₽`,
      `<i>Статус:</i> ${order.status}`,
      `<i>Дата:</i> ${order.orderDate.toISOString()}`,
    ].join('\n');
  }
}
