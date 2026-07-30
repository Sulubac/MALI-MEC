const db = require('./database');

console.log('Seeding database...');

// Check if already seeded
const existing = db.prepare('SELECT COUNT(*) as count FROM categories').get();
if (existing.count > 0) {
  console.log('Database already seeded. Use --force to re-seed.');
  if (!process.argv.includes('--force')) process.exit(0);
  db.exec(`
    DELETE FROM stock_movements; DELETE FROM stock; DELETE FROM payments;
    DELETE FROM order_items; DELETE FROM orders; DELETE FROM products;
    DELETE FROM categories; DELETE FROM restaurant_tables;
  `);
}

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const insertCat = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)');
const cats = [
  ['Food',          '#10b981', 1],
  ['Drinks',        '#06b6d4', 2],
  ['Shisha',        '#8b5cf6', 3],
  ['Events Global', '#f97316', 4],
];
cats.forEach(c => insertCat.run(...c));

const catIds = {};
db.prepare('SELECT id, name FROM categories').all().forEach(c => { catIds[c.name] = c.id; });

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
const insertProd = db.prepare(`
  INSERT INTO products (category_id, name, description, price, cost, track_stock)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const F = catIds['Food'];

const products = [
  // ── Entrées / Starters ────────────────────────────────────────────────────
  [F, 'Soupe de carotte et gingembre',   'Carrot ginger soup - served with lemon toast',        1300,  500, 0],
  [F, 'Soupe à la citrouille',           'Pumpkin soup - served with lemon toast',               1500,  580, 0],
  [F, 'Coupe de crevettes',              'Shrimp cup - served with calypso sauce',               2500, 1000, 0],
  [F, 'Carpaccio de bœuf',               'Beef carpaccio - virgin olive oil, lemon',             1800,  700, 0],
  [F, 'Carpaccio de poulpe',             'Octopus carpaccio - virgin olive oil, lemon',          2500, 1000, 0],
  [F, 'Carpaccio de poisson',            'Fish carpaccio - virgin olive oil, lemon',             1900,  750, 0],
  [F, 'Salade hawaïenne',                'Hawaiian salad - chicken, pineapple, tomato, mayo',    2000,  800, 0],
  [F, 'Salade César façon Beach House',  'Caesar salad - chicken, tomato, pineapple, mayo',      2000,  800, 0],

  // ── Poissons & Fruits de Mer ──────────────────────────────────────────────
  [F, 'Papillote de poisson grillé',     'Grilled fish in foil',                                 2900, 1150, 0],
  [F, 'Poulpe grillé aux épices',        'Grilled octopus with spices',                          4200, 1700, 0],
  [F, 'Duo poisson grillé & gambas',     'Grilled fish and prawn duo',                           4000, 1600, 0],
  [F, 'Filet de poisson grillé du jour', 'Grilled fish of the day',                              2900, 1150, 0],
  [F, 'Poêlée aux gambas',               'Pan-fried shrimp',                                     3800, 1500, 0],
  [F, 'Langouste thermidor grillé',      'Grilled lobster thermidor (au kg)',                    10000, 4500, 0],

  // ── Viandes / Meats ───────────────────────────────────────────────────────
  [F, 'Mignon de bœuf grillé',           'Beef cutlet - imported from South America',            3200, 1280, 0],
  [F, 'Brochettes de poulet Satay Kaï',  'Grilled chicken skewers with peanut sauce',            2800, 1100, 0],
  [F, 'Filet de bœuf mariné',            'Marinated beef fillet',                                4800, 1900, 0],
  [F, 'Entrecôte de bœuf',               'Beef steak - imported from South America',             3800, 1520, 0],
  [F, '½ poulet grillé',                 '1½ grilled chicken',                                   2800, 1100, 0],
  [F, 'Émincé de poulet sauté',          'Sliced sautéed chicken',                               2500, 1000, 0],

  // ── Menu Enfants / Kids ───────────────────────────────────────────────────
  [F, 'Menu Enfant',                     'Steak/Nuggets + frites + 1 boule de glace',            2200,  880, 0],

  // ── Pâtes / Pasta & Rice ─────────────────────────────────────────────────
  [F, 'Tagliatelle champignon',          'White tagliatelle with mushroom, pesto sauce',         1900,  750, 0],
  [F, 'Tagliatelle aux gambas',          'Tagliatelle with shrimp',                              2500, 1000, 0],
  [F, 'Tagliatelle au poulet',           'Chicken tagliatelle',                                  2000,  800, 0],
  [F, 'Spaghetti carbonara',             'Spaghetti carbonara with cheese sauce',                2100,  840, 0],
  [F, 'Spaghetti polonaise',             'Polish spaghetti',                                     2100,  840, 0],
  [F, 'Penne al Arrabiata',              'Penne in spicy tomato sauce',                          1800,  720, 0],
  [F, 'Riz sauté aux fruits de mer',     'Fried rice with seafood',                              2500, 1000, 0],
  [F, 'Riz Biryani',                     'Biryani rice',                                         2500, 1000, 0],

  // ── Desserts ─────────────────────────────────────────────────────────────
  [F, 'Moelleux chocolat',               'Homemade chocolate fondant cake',                      2000,  800, 0],
  [F, 'Poire Belle Hélène',              'Poached pear with chocolate sauce',                    1600,  640, 0],
  [F, 'Coupe 3 boules',                  'Ice cream cup - 3 scoops',                             1100,  440, 0],
  [F, 'Pêche Melba',                     'Peach melba - ice cream & raspberry coulis',           1600,  640, 0],
  [F, 'Assiette de fruits mosaïque',     'Mosaic fruit plate',                                   1300,  520, 0],
  [F, 'Banane Split',                    'Banana split',                                         1900,  760, 0],

  // ── Drinks (placeholder — to be completed) ────────────────────────────────
  // ── Shisha (placeholder — to be completed) ────────────────────────────────
  // ── Events Global (placeholder — to be completed) ─────────────────────────
];

products.forEach(p => insertProd.run(...p));

// ─── DINING TABLES ────────────────────────────────────────────────────────────
const insertTable = db.prepare(`
  INSERT INTO restaurant_tables (name, capacity, status, section)
  VALUES (?, ?, 'available', ?)
`);
const tables = [
  ['T1', 2, 'Terrasse'], ['T2', 4, 'Terrasse'], ['T3', 4, 'Terrasse'],
  ['T4', 6, 'Terrasse'], ['T5', 2, 'Terrasse'],
  ['T6', 4, 'Salle Principale'], ['T7', 4, 'Salle Principale'],
  ['T8', 6, 'Salle Principale'], ['T9', 4, 'Salle Principale'],
  ['T10', 4, 'Salle Principale'], ['T11', 2, 'Salle Principale'],
  ['T12', 8, 'Salle Principale'],
  ['VIP1', 8, 'Salon VIP'], ['VIP2', 10, 'Salon VIP'], ['VIP3', 12, 'Salon VIP'],
];
tables.forEach(([name, cap, sec]) => insertTable.run(name, cap, sec));

console.log('✅ Base de données initialisée avec succès !');
console.log(`   - ${cats.length} catégories`);
console.log(`   - ${products.length} produits`);
console.log(`   - ${tables.length} tables`);
