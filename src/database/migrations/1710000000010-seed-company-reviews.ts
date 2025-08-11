import { MigrationInterface, QueryRunner } from 'typeorm';

type T = { text: string; author: string; role: string; avatar: string };

export class SeedCompanyReviews1710000000010 implements MigrationInterface {
  name = 'SeedCompanyReviews1710000000010';

  private testimonials: T[] = [
    {
      text: 'Orlov — это больше, чем бренд. Это культурный код, который я с гордостью транслирую своим клиентам и партнёрам. Продукция безупречного качества и с глубоким смыслом.',
      author: 'Александр Петров',
      role: 'Генеральный директор Prestige Consulting',
      avatar: 'https://randomuser.me/api/portraits/men/3.jpg',
    },
    {
      text: 'Мы заказали эксклюзивные аксессуары для официальной делегации. Качество, внимание к деталям и уважение к традициям превзошли ожидания. Orlov Brand — это образец государственного стиля.',
      author: 'Ольга Смирнова',
      role: 'Сотрудник государственной структуры',
      avatar: 'https://randomuser.me/api/portraits/women/26.jpg',
    },
    {
      text: 'Меня поразила философия бренда Orlov. Это не просто изделия — это осознанный выбор в пользу российской идентичности и высокого вкуса.',
      author: 'Сергей Волков',
      role: 'Предприниматель и общественный деятель',
      avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    },
    {
      text: 'Как студентка, я нашла в Orlov Brand уникальный баланс доступности и премиальности. Носить такие аксессуары — значит быть частью истории и культуры своей страны.',
      author: 'Анастасия Кузнецова',
      role: 'Студентка МГУ',
      avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    },
    {
      text: 'Я долго искал подарки с характером и глубокой идеей. Orlov Brand создает именно такие изделия — изысканные, наполненные смыслом, и идеально выполненные.',
      author: 'Виктор Михайлов',
      role: 'Дипломат',
      avatar: 'https://randomuser.me/api/portraits/men/18.jpg',
    },
    {
      text: 'Orlov — это выбор тех, кто ценит аутентичность и безупречный стиль. Как иностранный партнёр, я с гордостью использую аксессуары этого бренда.',
      author: 'Томас Беккер',
      role: 'Бизнес-партнёр из Германии',
      avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
    },
    {
      text: 'Продукция Orlov Brand — это не просто аксессуары, это знаки уважения к культуре и истории. Команда бренда тонко чувствует, как воплотить традиции в современном дизайне.',
      author: 'Дмитрий Иванов',
      role: 'Креативный директор Национального культурного фонда',
      avatar: 'https://randomuser.me/api/portraits/men/41.jpg',
    },
    {
      text: 'Каждое изделие Orlov — это история, которую хочется рассказывать. Бренд достойно представляет российское наследие и высокое качество на международном уровне.',
      author: 'Елена Морозова',
      role: 'Руководитель департамента федерального агентства',
      avatar: 'https://randomuser.me/api/portraits/women/31.jpg',
    },
    {
      text: 'Высокое качество исполнения, элегантный дизайн и ценности бренда полностью соответствуют моему мировоззрению. Orlov Brand стал для меня выбором №1 для личных и деловых подарков.',
      author: 'Павел Сидоров',
      role: 'Частный инвестор',
      avatar: 'https://randomuser.me/api/portraits/men/43.jpg',
    },
    {
      text: 'Orlov Brand восхищает меня своим умением соединять классику и современность. Каждый аксессуар — это произведение искусства.',
      author: 'Ирина Александрова',
      role: 'Искусствовед',
      avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    },
    {
      text: 'Работая с Orlov Brand, я увидел высокий уровень профессионализма и уважение к клиенту. Это партнёр, которому можно доверять.',
      author: 'Михаил Ковалёв',
      role: 'Руководитель корпоративных закупок',
      avatar: 'https://randomuser.me/api/portraits/men/15.jpg',
    },
    {
      text: 'Orlov Brand помог нам создать уникальные подарки для наших иностранных партнёров. Все остались под глубоким впечатлением.',
      author: 'Анна Васильева',
      role: 'Менеджер по внешнеэкономической деятельности',
      avatar: 'https://randomuser.me/api/portraits/women/38.jpg',
    },
    {
      text: 'Я часто выбираю аксессуары Orlov в качестве корпоративных подарков. Это всегда безупречный стиль и качественная подача.',
      author: 'Алексей Смирнов',
      role: 'Директор по развитию',
      avatar: 'https://randomuser.me/api/portraits/men/28.jpg',
    },
    {
      text: 'Orlov Brand — это идеальное сочетание стиля, качества и патриотизма. Гордость носить такую продукцию.',
      author: 'Наталья Романова',
      role: 'Маркетолог',
      avatar: 'https://randomuser.me/api/portraits/women/47.jpg',
    },
    {
      text: 'В Orlov Brand я нашёл отражение своих ценностей — уважение к культуре, качеству и деталям.',
      author: 'Егор Николаев',
      role: 'Финансовый консультант',
      avatar: 'https://randomuser.me/api/portraits/men/34.jpg',
    },
    {
      text: 'Каждая коллекция Orlov — это уникальная история, наполненная глубоким смыслом. Я с удовольствием слежу за новинками бренда.',
      author: 'Оксана Лебедева',
      role: 'Блогер и стилист',
      avatar: 'https://randomuser.me/api/portraits/women/52.jpg',
    },
    {
      text: 'Orlov — это символ качества и уважения к своим корням. Я с гордостью выбираю этот бренд для себя и своей семьи.',
      author: 'Иван Григорьев',
      role: 'Частный предприниматель',
      avatar: 'https://randomuser.me/api/portraits/men/33.jpg',
    },
    {
      text: 'Сотрудничество с Orlov Brand оставило исключительно положительное впечатление. Бренд демонстрирует высокий уровень качества и глубокое уважение к своим клиентам.',
      author: 'Александр Беляев',
      role: 'Коммерческий директор',
      avatar: 'https://randomuser.me/api/portraits/men/23.jpg',
    },
  ];

  private splitName(full: string): { first: string; last: string } {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts[0], last: parts.slice(1).join(' ') };
  }

  public async up(q: QueryRunner): Promise<void> {
    await q.startTransaction();
    try {
      // на всякий случай убеждаемся в наличии уникального индекса по email
      await q.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'ux_customer_email'
          ) THEN
            CREATE UNIQUE INDEX ux_customer_email ON customer (lower(email));
          END IF;
        END $$;
      `);

      for (let i = 0; i < this.testimonials.length; i++) {
        const t = this.testimonials[i];
        const email = `seed${i + 1}@orlov.local`;
        const { first, last } = this.splitName(t.author);

        // создаём/обновляем пользователя
        const userRow = await q.query(
          `
          INSERT INTO customer
            (first_name, last_name, email, phone, registered_at,
             password_hash, role, avatar_url, token_version, headline, organization)
          VALUES ($1,$2,$3,NULL,NOW(),'','customer',$4,0,$5,NULL)
          ON CONFLICT (email) DO UPDATE
             SET avatar_url = EXCLUDED.avatar_url,
                 headline   = EXCLUDED.headline
          RETURNING customer_id;
        `,
          [first, last, email, t.avatar, t.role],
        );

        const customerId: number =
          userRow?.[0]?.customer_id ??
          (
            await q.query(
              `SELECT customer_id FROM customer WHERE email = $1 LIMIT 1`,
              [email],
            )
          )?.[0]?.customer_id;

        // вставляем отзыв, если его ещё нет для этой пары (customer, text)
        await q.query(
          `
          INSERT INTO company_reviews (customer_id, rating, text, is_approved)
          SELECT $1, $2, $3, true
          WHERE NOT EXISTS (
            SELECT 1 FROM company_reviews
            WHERE customer_id = $1 AND text = $3
          );
        `,
          [customerId, 5, t.text],
        );
      }

      await q.commitTransaction();
    } catch (e) {
      await q.rollbackTransaction();
      throw e;
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.startTransaction();
    try {
      // удаляем отзывы, добавленные этой миграцией
      await q.query(
        `
        DELETE FROM company_reviews
        WHERE customer_id IN (
          SELECT customer_id FROM customer
          WHERE email LIKE 'seed%@orlov.local'
        );
      `,
      );

      // и удаляем seed-пользователей (если не зависят другие таблицы)
      await q.query(
        `
        DELETE FROM customer
        WHERE email LIKE 'seed%@orlov.local';
      `,
      );

      await q.commitTransaction();
    } catch (e) {
      await q.rollbackTransaction();
      throw e;
    }
  }
}
