import 'dotenv/config';
import dataSource from '../data-source';
import { seedProducts } from './seed-products';
import seedCompanyReviews from './seed-company-reviews';

async function run() {
  await dataSource.initialize();
  console.log('> DB connected');

  try {
    await seedProducts(dataSource); // 1) товары
    await seedCompanyReviews(dataSource); // 2) отзывы о компании
  } finally {
    await dataSource.destroy();
    console.log('> DB disconnected');
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
