// src/company-reviews/seed/seed-company-reviews.ts
import 'reflect-metadata';
import dataSource from '../../database/data-source';

import { testimonials } from '../../data/reviews.data';
import { CompanyReview } from '../company-reviews.entity';
import { User } from '../../users/users.entity';

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function ensureUser(
  idx: number,
  t: { author: string; role: string; avatar: string },
): Promise<User> {
  const userRepo = dataSource.getRepository(User);

  // стабильный искусственный e-mail, чтобы повторные запуски не плодили дубликаты
  const email = `seed${idx + 1}@orlov.local`;
  let user = await userRepo.findOne({ where: { email } });

  if (!user) {
    const { firstName, lastName } = splitName(t.author);
    user = userRepo.create({
      firstName,
      lastName,
      email,
      phone: null,
      passwordHash: '', // у тебя есть NOT NULL; пустая строка ок для сидов
      role: 'customer',
      avatarUrl: t.avatar,
      tokenVersion: 0,
      headline: t.role,
      organization: null,
    } as User);

    user = await userRepo.save(user);
  } else {
    // мягко обновим видимые поля (на случай повторного прогона)
    user.avatarUrl = t.avatar;
    user.headline = t.role;
    await userRepo.save(user);
  }

  return user;
}

async function ensureReview(
  userId: number,
  text: string,
  rating = 5,
): Promise<void> {
  const reviewRepo = dataSource.getRepository(CompanyReview);

  // чтобы не дублировать при повторном запуске — проверим по (customer_id, text)
  const exists = await reviewRepo.findOne({
    where: { customerId: userId, text },
  });
  if (exists) return;

  const entity = reviewRepo.create({
    customerId: userId,
    text,
    rating,
    isApproved: true,
  });
  await reviewRepo.save(entity);
}

async function run() {
  await dataSource.initialize();
  console.log('📦 Connected');

  try {
    for (let i = 0; i < testimonials.length; i++) {
      const t = testimonials[i];
      const user = await ensureUser(i, t);
      await ensureReview(user.id, t.text, 5);
    }
    console.log(`✅ Inserted/updated ${testimonials.length} company reviews`);
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exitCode = 1;
  } finally {
    await dataSource.destroy();
  }
}

run();
