// src/orders/orders.controller.ts
import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/guards/jwt-access.guard';
import { CurrentUserId } from '../common/current-user.decorator';
import { UsersService } from '../users/users.service';

@Controller('checkout')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly tg: TelegramService,
    private readonly users: UsersService,
  ) {}

  // ========= utils =========
  private esc(s: string) {
    return (s ?? '').replace(/[<&>]/g, (ch) =>
      ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&amp;',
    );
  }

  private money(v: string | number, currency = 'RUB') {
    const n = typeof v === 'string' ? Number(v) : v;
    const sym = currency === 'RUB' ? '₽' : currency;
    return `${n.toLocaleString('ru-RU')} ${sym}`;
  }

  private formatDate(
    d: Date | string,
    tz = process.env.APP_TZ || 'Europe/Moscow',
  ) {
    const date = typeof d === 'string' ? new Date(d) : d;
    // 18 авг 2025, 17:41 (МСК)
    const fmt = new Intl.DateTimeFormat('ru-RU', {
      timeZone: tz,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const pretty = fmt.format(date).replace('.', '');
    const tzShort = tz === 'Europe/Moscow' ? 'МСК' : tz;
    return `${pretty} (${tzShort})`;
  }

  /** Премиум-минимализм: большое фото + лаконичная «квитанция» */
  private buildPremiumMinimalCaption(params: {
    fullName: string;
    email: string;
    headline?: string | null;
    organization?: string | null;
    city?: string | null;
    country?: string | null;
    orderId: number;
    items: Array<{ name: string; qty: number; lineTotal: string | number }>;
    total: string | number;
    currency: string;
    createdAt: Date | string;
    status?: string;
  }) {
    const esc = this.esc.bind(this);

    const headerName = `👤 <b>${esc(params.fullName)}</b>`;
    const headerEmail = `✉️ <a href="mailto:${esc(params.email)}">${esc(params.email)}</a>`;

    const meta: string[] = [];
    if (params.headline) meta.push(`💼 ${esc(params.headline)}`);
    if (params.organization) meta.push(`🏢 ${esc(params.organization)}`);
    if (params.city || params.country)
      meta.push(
        `📍 ${esc(params.city ?? '')}${params.city && params.country ? ', ' : ''}${esc(
          params.country ?? '',
        )}`,
      );

    const divider = '──────────────';

    const itemsBlock =
      params.items
        .map(
          (i) =>
            `• ${esc(i.name)}  × ${i.qty}  =  <b>${this.money(i.lineTotal, params.currency)}</b>`,
        )
        .join('\n') || '• —';

    const totalLine = `💰 <b>Итого:</b> ${this.money(params.total, params.currency)}`;
    const status = params.status
      ? `🏷 <b>Статус:</b> ${esc(params.status)}`
      : undefined;
    const when = `📅 <b>Создан:</b> ${this.formatDate(params.createdAt)}`;

    return [
      headerName,
      headerEmail,
      ...(meta.length ? ['\n' + meta.join('\n')] : []),
      `\n🛒 <b>Заказ №${params.orderId}</b>`,
      divider,
      itemsBlock,
      divider,
      totalLine,
      status,
      when,
    ]
      .filter(Boolean)
      .join('\n');
  }

  // ========= боевой checkout =========
  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(200)
  async checkout(@CurrentUserId() userId: number) {
    const order = await this.orders.checkout({ id: userId });
    const profile = await this.users.getPublicProfile(userId);

    const fullName =
      `${profile?.firstName ?? order.customer.firstName ?? ''} ${profile?.lastName ?? order.customer.lastName ?? ''}`.trim() ||
      'Покупатель';

    const caption = this.buildPremiumMinimalCaption({
      fullName,
      email: profile?.email ?? order.customer.email,
      headline: profile?.headline ?? undefined,
      organization: profile?.organization ?? undefined,
      city: profile?.city ?? undefined,
      country: profile?.country ?? undefined,
      orderId: order.orderId,
      items: order.items.map((i) => ({
        name: i.name,
        qty: i.quantity,
        lineTotal: i.lineTotal,
      })),
      total: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      status: order.status,
    });

    const avatar =
      (profile?.avatarUrl &&
        /^https?:\/\//i.test(profile.avatarUrl) &&
        profile.avatarUrl) ||
      `https://i.pravatar.cc/600?u=${userId}`;

    await this.tg.sendPhoto(avatar, caption);
    return order;
  }

  // ========= демо без авторизации =========
  @Get('ping-tg-profile')
  @HttpCode(200)
  async pingTgProfile(
    @Query('first') first = 'Иван',
    @Query('last') last = 'Иванов',
    @Query('email') email = 'ivan@example.com',
    @Query('headline') headline?: string,
    @Query('org') org?: string,
    @Query('city') city?: string,
    @Query('country') country?: string,
    @Query('avatar') avatar?: string,
  ) {
    const fullName = `${first} ${last}`.trim();

    const caption = this.buildPremiumMinimalCaption({
      fullName,
      email,
      headline,
      organization: org,
      city,
      country,
      orderId: 9999,
      items: [
        { name: 'Чехол для iPhone 15', qty: 1, lineTotal: 2990 },
        { name: 'Защитное стекло', qty: 2, lineTotal: 1180 },
        { name: 'Зарядное устройство', qty: 1, lineTotal: 1490 },
      ],
      total: 2990 + 1180 + 1490,
      currency: 'RUB',
      createdAt: new Date(),
      status: 'in_transit',
    });

    const photo =
      (avatar && /^https?:\/\//i.test(avatar) && avatar) ||
      `https://i.pravatar.cc/600?u=${encodeURIComponent(email)}`;

    await this.tg.sendPhoto(photo, caption);
    return { ok: true };
  }

  @Get('ping-tg')
  @HttpCode(200)
  async pingTg(@Query('m') m = '✅ Тест: backend шлёт сообщения') {
    await this.tg.send(`<b>${this.esc(m)}</b>`);
    return { ok: true };
  }
}
