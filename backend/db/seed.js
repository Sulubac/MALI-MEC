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

// Categories
const insertCat = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)');
const cats = [
  { id: 1, name: 'Fruits de Mer', color: '#0ea5e9', order: 1 },
  { id: 2, name: 'Poissons', color: '#10b981', order: 2 },
  { id: 3, name: 'Grillades', color: '#f97316', order: 3 },
  { id: 4, name: 'Entrées & Salades', color: '#a855f7', order: 4 },
  { id: 5, name: 'Soupes', color: '#ec4899', order: 5 },
  { id: 6, name: 'Boissons', color: '#06b6d4', order: 6 },
  { id: 7, name: 'Desserts', color: '#f59e0b', order: 7 },
];
cats.forEach(c => insertCat.run(c.name, c.color, c.order));

// Products (prices in DJF)
const insertProd = db.prepare(`
  INSERT INTO products (category_id, name, description, price, cost, track_stock)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const products = [
  // Fruits de Mer (cat 1)
  [1, 'Homard Grillé de la Mer Rouge', 'Homard frais grillé, beurre aux herbes', 8500, 4500, 1],
  [1, 'Plateau Royal de Fruits de Mer', 'Homard, crevettes, huîtres, langoustines', 15000, 7500, 1],
  [1, 'Crevettes Géantes du Golfe', 'Crevettes fraîches sautées à l\'ail', 6500, 3200, 1],
  [1, 'Langoustines Flambées', 'Langoustines au cognac et crème', 7200, 3500, 1],
  [1, 'Huîtres Fraîches (6 pcs)', 'Huîtres de la côte', 4500, 2000, 1],
  // Poissons (cat 2)
  [2, 'Brochettes de Poissons Nobles', 'Dorade, thon, espadon marinés', 5500, 2800, 1],
  [2, 'Dorade Royale Grillée', 'Dorade entière aux herbes du jardin', 5000, 2500, 1],
  [2, 'Thon Rouge Tataki', 'Thon rouge snacké, sauce teriyaki', 6000, 3000, 1],
  [2, 'Filet d\'Espadon', 'Espadon grillé, salsa mangue-coriandre', 5800, 2900, 1],
  // Grillades (cat 3)
  [3, 'Entrecôte 300g', 'Bœuf Black Angus, frites maison', 7500, 3800, 1],
  [3, 'Côtelettes d\'Agneau', 'Côtelettes marinées, légumes grillés', 8000, 4000, 1],
  [3, 'Poulet Fermier Grillé', 'Demi-poulet mariné aux épices', 4200, 2000, 1],
  // Entrées & Salades (cat 4)
  [4, 'Salade de Poulpe Grillé', 'Poulpe, tomates, olives, citron', 4200, 1800, 1],
  [4, 'Salade Niçoise de la Mer', 'Thon, œufs, anchois, légumes', 3500, 1500, 1],
  [4, 'Accras de Crevettes', 'Beignets légers aux crevettes', 2800, 1200, 1],
  [4, 'Carpaccio de Dorade', 'Dorade marinée au citron vert', 3200, 1400, 1],
  // Soupes (cat 5)
  [5, 'Soupe de Poisson Traditionnelle', 'Bouillabaisse maison, rouille', 2800, 1200, 1],
  [5, 'Bisque de Homard', 'Velouté de homard à la crème', 3500, 1600, 1],
  // Boissons (cat 6)
  [6, 'Eau Minérale 50cl', '', 300, 100, 1],
  [6, 'Eau Minérale 1L', '', 500, 150, 1],
  [6, 'Jus Frais du Jour', 'Mangue, goyave ou passion', 800, 300, 0],
  [6, 'Soda (Coca, Fanta, Sprite)', '', 600, 200, 1],
  [6, 'Bière Locale (33cl)', '', 1200, 500, 1],
  [6, 'Vin Rouge (verre)', '', 2500, 1000, 1],
  [6, 'Vin Blanc (verre)', '', 2500, 1000, 1],
  [6, 'Café Espresso', '', 500, 150, 0],
  [6, 'Thé à la Menthe', '', 400, 100, 0],
  // Desserts (cat 7)
  [7, 'Crème Brûlée Vanille', '', 1800, 700, 0],
  [7, 'Tarte Tatin', 'Tarte aux pommes chaude, glace vanille', 2000, 800, 0],
  [7, 'Fondant Chocolat', 'Coulant au cœur chocolat noir', 2200, 900, 0],
  [7, 'Plateau de Fruits Exotiques', 'Mangue, ananas, papaye, fruit de la passion', 2500, 1000, 0],
];
products.forEach(p => insertProd.run(...p));

// Stock for tracked products
const insertStock = db.prepare(`
  INSERT OR IGNORE INTO stock (product_id, quantity, min_quantity, unit)
  VALUES (?, ?, ?, ?)
`);
const trackedProducts = db.prepare('SELECT id FROM products WHERE track_stock = 1').all();
trackedProducts.forEach((p, i) => {
  const qty = 10 + Math.floor(i * 3) % 20;
  insertStock.run(p.id, qty, 5, 'portion');
});

// Dining tables
const insertTable = db.prepare(`
  INSERT INTO restaurant_tables (name, capacity, status, section)
  VALUES (?, ?, 'available', ?)
`);
const sections = [
  // Section Terrasse
  ['T1', 2, 'Terrasse'], ['T2', 4, 'Terrasse'], ['T3', 4, 'Terrasse'],
  ['T4', 6, 'Terrasse'], ['T5', 2, 'Terrasse'],
  // Salle Principale
  ['T6', 4, 'Salle Principale'], ['T7', 4, 'Salle Principale'],
  ['T8', 6, 'Salle Principale'], ['T9', 4, 'Salle Principale'],
  ['T10', 4, 'Salle Principale'], ['T11', 2, 'Salle Principale'],
  ['T12', 8, 'Salle Principale'],
  // Salon VIP
  ['VIP1', 8, 'Salon VIP'], ['VIP2', 10, 'Salon VIP'], ['VIP3', 12, 'Salon VIP'],
];
sections.forEach(([name, cap, sec]) => insertTable.run(name, cap, sec));

// Demo: mark T1 as occupied with an open order
db.prepare("UPDATE restaurant_tables SET status = 'occupied' WHERE name = 'T6'").run();
const t6 = db.prepare("SELECT id FROM restaurant_tables WHERE name = 'T6'").get();
if (t6) {
  const ord = db.prepare(`
    INSERT INTO orders (table_id, status, customer_count, subtotal, total, waiter)
    VALUES (?, 'open', 2, 13500, 13500, 'Amina')
  `).run(t6.id);
  const oid = ord.lastInsertRowid;
  db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, 1, 'Homard Grillé de la Mer Rouge', 1, 8500)`).run(oid);
  db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, 19, 'Eau Minérale 50cl', 2, 300)`).run(oid);
  db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, 21, 'Soda (Coca, Fanta, Sprite)', 2, 600)`).run(oid);
}

console.log('✅ Database seeded successfully!');
console.log(`   - ${cats.length} catégories`);
console.log(`   - ${products.length} produits`);
console.log(`   - ${sections.length} tables`);
