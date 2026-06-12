// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client");
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  // Create store
  const store = await db.store.upsert({
    where: { slug: "my-consign-shop" },
    update: {},
    create: {
      name: "My Consign Shop",
      slug: "my-consign-shop",
      email: "owner@myconsignshop.com",
      phone: "555-0100",
      taxRate: 0.08,
    },
  });

  // Create owner account
  const passwordHash = await bcrypt.hash("password123", 12);
  const owner = await db.user.upsert({
    where: { email: "owner@myconsignshop.com" },
    update: {},
    create: {
      name: "Store Owner",
      email: "owner@myconsignshop.com",
      passwordHash,
      role: "OWNER",
      storeId: store.id,
    },
  });

  // Create categories
  const categories = await Promise.all([
    db.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: "clothing" } },
      update: {},
      create: { storeId: store.id, name: "Clothing", slug: "clothing" },
    }),
    db.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: "furniture" } },
      update: {},
      create: { storeId: store.id, name: "Furniture", slug: "furniture" },
    }),
    db.category.upsert({
      where: { storeId_slug: { storeId: store.id, slug: "electronics" } },
      update: {},
      create: { storeId: store.id, name: "Electronics", slug: "electronics" },
    }),
  ]);

  // Create sample consignors
  const [sarah, mike] = await Promise.all([
    db.consignor.upsert({
      where: { id: "seed-consignor-sarah" },
      update: {},
      create: {
        id: "seed-consignor-sarah",
        storeId: store.id,
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah@example.com",
        phone: "555-0201",
        splitPercent: 60,
      },
    }),
    db.consignor.upsert({
      where: { id: "seed-consignor-mike" },
      update: {},
      create: {
        id: "seed-consignor-mike",
        storeId: store.id,
        firstName: "Mike",
        lastName: "Davis",
        email: "mike@example.com",
        phone: "555-0202",
        splitPercent: 50,
      },
    }),
  ]);

  // Create sample items
  await db.item.createMany({
    skipDuplicates: true,
    data: [
      {
        storeId: store.id,
        consignorId: sarah.id,
        categoryId: categories[0].id,
        sku: "SEED-001",
        title: "Vintage Levi's 501 Jeans",
        brand: "Levi's",
        size: "32x30",
        color: "Blue",
        condition: "Good",
        price: 45.00,
        splitPercent: 60,
        listedOnline: true,
        photoUrls: [],
      },
      {
        storeId: store.id,
        consignorId: sarah.id,
        categoryId: categories[0].id,
        sku: "SEED-002",
        title: "Nike Air Force 1 Sneakers",
        brand: "Nike",
        size: "10",
        color: "White",
        condition: "Like New",
        price: 85.00,
        splitPercent: 60,
        listedOnline: true,
        photoUrls: [],
      },
      {
        storeId: store.id,
        consignorId: mike.id,
        categoryId: categories[1].id,
        sku: "SEED-003",
        title: "Mid-Century Modern Side Table",
        brand: undefined,
        condition: "Good",
        price: 120.00,
        splitPercent: 50,
        listedOnline: true,
        photoUrls: [],
      },
    ],
  });

  console.log("✓ Seed complete");
  console.log(`  Store: ${store.name} (${store.slug})`);
  console.log(`  Owner login: owner@myconsignshop.com / password123`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
