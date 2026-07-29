const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// ─── Helper: recalculate order totals ────────────────────────────────────────
function recalcOrder(orderId) {
  const items = db.prepare('SELECT quantity, unit_price, discount FROM order_items WHERE order_id = ?').all(orderId);
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price * (1 - i.discount / 100), 0);
  const order = db.prepare('SELECT tax_rate, discount, tip FROM orders WHERE id = ?').get(orderId);
  const tax = subtotal * ((order?.tax_rate || 0) / 100);
  const disc = order?.discount || 0;
  const tip = order?.tip || 0;
  const total = subtotal - disc + tax + tip;
  db.prepare(`
    UPDATE orders SET subtotal = ?, tax = ?, total = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(Math.round(subtotal), Math.round(tax), Math.round(total), orderId);
  return { subtotal: Math.round(subtotal), tax: Math.round(tax), total: Math.round(total) };
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
app.get('/api/categories', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, name').all();
  res.json(rows);
});

app.post('/api/categories', (req, res) => {
  const { name, color = '#10b981', sort_order = 0 } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis' });
  const r = db.prepare('INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)').run(name, color, sort_order);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/categories/:id', (req, res) => {
  const { name, color, sort_order, active } = req.body;
  db.prepare('UPDATE categories SET name = COALESCE(?, name), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order), active = COALESCE(?, active) WHERE id = ?')
    .run(name, color, sort_order, active, req.params.id);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id));
});

app.delete('/api/categories/:id', (req, res) => {
  db.prepare('UPDATE categories SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────
app.get('/api/products', (req, res) => {
  const { category_id, active = 1 } = req.query;
  let sql = `
    SELECT p.*, c.name as category_name, c.color as category_color,
           s.quantity as stock_qty, s.min_quantity, s.unit
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON s.product_id = p.id
    WHERE p.active = ?
  `;
  const params = [active];
  if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
  sql += ' ORDER BY c.sort_order, p.name';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/products', (req, res) => {
  const { category_id, name, description = '', price, cost = 0, track_stock = 0 } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Nom et prix requis' });
  const r = db.prepare('INSERT INTO products (category_id, name, description, price, cost, track_stock) VALUES (?, ?, ?, ?, ?, ?)').run(category_id, name, description, price, cost, track_stock ? 1 : 0);
  if (track_stock) {
    db.prepare('INSERT OR IGNORE INTO stock (product_id, quantity, min_quantity) VALUES (?, 0, 5)').run(r.lastInsertRowid);
  }
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/products/:id', (req, res) => {
  const { category_id, name, description, price, cost, track_stock, active } = req.body;
  db.prepare(`UPDATE products SET
    category_id = COALESCE(?, category_id), name = COALESCE(?, name),
    description = COALESCE(?, description), price = COALESCE(?, price),
    cost = COALESCE(?, cost), track_stock = COALESCE(?, track_stock),
    active = COALESCE(?, active)
    WHERE id = ?`).run(category_id, name, description, price, cost, track_stock, active, req.params.id);
  if (track_stock) {
    db.prepare('INSERT OR IGNORE INTO stock (product_id, quantity, min_quantity) VALUES (?, 0, 5)').run(req.params.id);
  }
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id));
});

app.delete('/api/products/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── TABLES ───────────────────────────────────────────────────────────────────
app.get('/api/tables', (req, res) => {
  const tables = db.prepare(`
    SELECT t.*,
      o.id as order_id, o.total as order_total,
      o.customer_count, o.created_at as order_started,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM restaurant_tables t
    LEFT JOIN orders o ON o.table_id = t.id AND o.status = 'open'
    ORDER BY t.section, t.name
  `).all();
  res.json(tables);
});

app.post('/api/tables', (req, res) => {
  const { name, capacity = 4, section = 'Salle Principale' } = req.body;
  if (!name) return res.status(400).json({ error: 'Le nom est requis' });
  const r = db.prepare('INSERT INTO restaurant_tables (name, capacity, section) VALUES (?, ?, ?)').run(name, capacity, section);
  res.json(db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/tables/:id', (req, res) => {
  const { name, capacity, status, section } = req.body;
  db.prepare(`UPDATE restaurant_tables SET
    name = COALESCE(?, name), capacity = COALESCE(?, capacity),
    status = COALESCE(?, status), section = COALESCE(?, section)
    WHERE id = ?`).run(name, capacity, status, section, req.params.id);
  res.json(db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(req.params.id));
});

app.delete('/api/tables/:id', (req, res) => {
  db.prepare('DELETE FROM restaurant_tables WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────

// KEY FEATURE: Get or create the active order for a table
// If a table already has an open order, we return it (no duplicate creation).
app.post('/api/tables/:tableId/session', (req, res) => {
  const tableId = parseInt(req.params.tableId);
  const table = db.prepare('SELECT * FROM restaurant_tables WHERE id = ?').get(tableId);
  if (!table) return res.status(404).json({ error: 'Table non trouvée' });

  const existing = db.prepare(`
    SELECT * FROM orders WHERE table_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1
  `).get(tableId);

  if (existing) {
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name_ref FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `).all(existing.id);
    return res.json({ ...existing, items, table, is_new: false });
  }

  const { customer_count = 1, waiter = '' } = req.body;
  const r = db.prepare(`
    INSERT INTO orders (table_id, status, customer_count, waiter)
    VALUES (?, 'open', ?, ?)
  `).run(tableId, customer_count, waiter);

  db.prepare("UPDATE restaurant_tables SET status = 'occupied' WHERE id = ?").run(tableId);

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(r.lastInsertRowid);
  res.json({ ...order, items: [], table, is_new: true });
});

app.get('/api/orders', (req, res) => {
  const { status, table_id, date } = req.query;
  let sql = `
    SELECT o.*, t.name as table_name,
      (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
    FROM orders o
    LEFT JOIN restaurant_tables t ON o.table_id = t.id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND o.status = ?'; params.push(status); }
  if (table_id) { sql += ' AND o.table_id = ?'; params.push(table_id); }
  if (date) { sql += ' AND DATE(o.created_at) = ?'; params.push(date); }
  sql += ' ORDER BY o.created_at DESC LIMIT 200';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT o.*, t.name as table_name FROM orders o LEFT JOIN restaurant_tables t ON o.table_id = t.id WHERE o.id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ ...order, items });
});

// Add item to order (or increase quantity if product already in order)
app.post('/api/orders/:id/items', (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND status = 'open'").get(orderId);
  if (!order) return res.status(400).json({ error: 'Commande non disponible' });

  const { product_id, quantity = 1, notes = '', discount = 0 } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id);
  if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

  // If product already in this order, increment quantity
  const existing = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?').get(orderId, product_id);
  if (existing) {
    db.prepare('UPDATE order_items SET quantity = quantity + ?, notes = CASE WHEN ? != \'\' THEN ? ELSE notes END WHERE id = ?')
      .run(quantity, notes, notes, existing.id);
  } else {
    db.prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, discount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(orderId, product_id, product.name, quantity, product.price, discount, notes);
  }

  const totals = recalcOrder(orderId);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(orderId);
  res.json({ ...totals, items });
});

// Update item quantity
app.put('/api/orders/:id/items/:itemId', (req, res) => {
  const { quantity, notes, discount, status } = req.body;
  if (quantity !== undefined && quantity <= 0) {
    db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(req.params.itemId, req.params.id);
  } else {
    db.prepare('UPDATE order_items SET quantity = COALESCE(?, quantity), notes = COALESCE(?, notes), discount = COALESCE(?, discount), status = COALESCE(?, status) WHERE id = ? AND order_id = ?')
      .run(quantity, notes, discount, status, req.params.itemId, req.params.id);
  }
  const totals = recalcOrder(parseInt(req.params.id));
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ ...totals, items });
});

// Remove item
app.delete('/api/orders/:id/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM order_items WHERE id = ? AND order_id = ?').run(req.params.itemId, req.params.id);
  const totals = recalcOrder(parseInt(req.params.id));
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ ...totals, items });
});

// Update order metadata (discount, tip, notes, tax_rate)
app.put('/api/orders/:id', (req, res) => {
  const { discount, tip, tax_rate, notes, customer_count, waiter, status } = req.body;
  db.prepare(`UPDATE orders SET
    discount = COALESCE(?, discount), tip = COALESCE(?, tip),
    tax_rate = COALESCE(?, tax_rate), notes = COALESCE(?, notes),
    customer_count = COALESCE(?, customer_count), waiter = COALESCE(?, waiter),
    status = COALESCE(?, status), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`).run(discount, tip, tax_rate, notes, customer_count, waiter, status, req.params.id);
  const totals = recalcOrder(parseInt(req.params.id));
  res.json(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id));
});

// Checkout: process payment and close order
app.post('/api/orders/:id/checkout', (req, res) => {
  const orderId = parseInt(req.params.id);
  const { method, cash_given = 0, reference = '', tip = 0 } = req.body;
  if (!method) return res.status(400).json({ error: 'Méthode de paiement requise' });

  const order = db.prepare("SELECT * FROM orders WHERE id = ? AND status = 'open'").get(orderId);
  if (!order) return res.status(400).json({ error: 'Commande non disponible ou déjà fermée' });

  // Apply tip and recalc
  if (tip) db.prepare('UPDATE orders SET tip = ? WHERE id = ?').run(tip, orderId);
  const totals = recalcOrder(orderId);

  const change = method === 'cash' ? Math.max(0, cash_given - totals.total) : 0;

  // Record payment
  db.prepare('INSERT INTO payments (order_id, method, amount, cash_given, change_given, reference) VALUES (?, ?, ?, ?, ?, ?)')
    .run(orderId, method, totals.total, cash_given, change, reference);

  // Close order
  db.prepare("UPDATE orders SET status = 'paid', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);

  // Free the table
  if (order.table_id) {
    db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ?").run(order.table_id);
  }

  // Deduct stock for tracked products
  const items = db.prepare(`
    SELECT oi.product_id, oi.quantity, oi.product_name, p.track_stock
    FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(orderId);

  items.filter(i => i.track_stock).forEach(item => {
    db.prepare('UPDATE stock SET quantity = MAX(0, quantity - ?), last_updated = CURRENT_TIMESTAMP WHERE product_id = ?')
      .run(item.quantity, item.product_id);
    db.prepare('INSERT INTO stock_movements (product_id, type, quantity, notes) VALUES (?, ?, ?, ?)')
      .run(item.product_id, 'sale', -item.quantity, `Commande #${orderId}`);
  });

  res.json({ success: true, order_id: orderId, total: totals.total, change_given: change });
});

// Void / cancel order
app.post('/api/orders/:id/void', (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
  if (!order) return res.status(404).json({ error: 'Commande non trouvée' });
  db.prepare("UPDATE orders SET status = 'cancelled', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
  if (order.table_id) {
    db.prepare("UPDATE restaurant_tables SET status = 'available' WHERE id = ?").run(order.table_id);
  }
  res.json({ success: true });
});

// ─── STOCK ────────────────────────────────────────────────────────────────────
app.get('/api/stock', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, p.name as product_name, p.price, p.cost,
           c.name as category_name, c.color as category_color
    FROM stock s
    JOIN products p ON s.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE p.active = 1
    ORDER BY c.sort_order, p.name
  `).all();
  res.json(rows);
});

app.get('/api/stock/alerts', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, p.name as product_name
    FROM stock s JOIN products p ON s.product_id = p.id
    WHERE s.quantity <= s.min_quantity AND p.active = 1
    ORDER BY (s.quantity - s.min_quantity) ASC
  `).all();
  res.json(rows);
});

app.post('/api/stock/adjustment', (req, res) => {
  const { product_id, type, quantity, notes = '' } = req.body;
  if (!product_id || !type || quantity === undefined) return res.status(400).json({ error: 'Données manquantes' });

  const delta = ['sale', 'waste'].includes(type) ? -Math.abs(quantity) : Math.abs(quantity);
  db.prepare('UPDATE stock SET quantity = MAX(0, quantity + ?), last_updated = CURRENT_TIMESTAMP WHERE product_id = ?').run(delta, product_id);
  db.prepare('INSERT INTO stock_movements (product_id, type, quantity, notes) VALUES (?, ?, ?, ?)').run(product_id, type, delta, notes);

  res.json(db.prepare('SELECT s.*, p.name FROM stock s JOIN products p ON s.product_id = p.id WHERE s.product_id = ?').get(product_id));
});

app.put('/api/stock/:productId', (req, res) => {
  const { min_quantity, unit } = req.body;
  db.prepare('UPDATE stock SET min_quantity = COALESCE(?, min_quantity), unit = COALESCE(?, unit) WHERE product_id = ?')
    .run(min_quantity, unit, req.params.productId);
  res.json(db.prepare('SELECT * FROM stock WHERE product_id = ?').get(req.params.productId));
});

app.get('/api/stock/movements', (req, res) => {
  const { product_id, limit = 100 } = req.query;
  let sql = `
    SELECT sm.*, p.name as product_name
    FROM stock_movements sm JOIN products p ON sm.product_id = p.id
    WHERE 1=1
  `;
  const params = [];
  if (product_id) { sql += ' AND sm.product_id = ?'; params.push(product_id); }
  sql += ' ORDER BY sm.created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  res.json(db.prepare(sql).all(...params));
});

// ─── REPORTS ─────────────────────────────────────────────────────────────────
app.get('/api/reports/summary', (req, res) => {
  const { from, to } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const dateFrom = from || today;
  const dateTo = to || today;

  const sales = db.prepare(`
    SELECT
      COUNT(*) as order_count,
      COALESCE(SUM(total), 0) as revenue,
      COALESCE(AVG(total), 0) as avg_order,
      COALESCE(SUM(subtotal), 0) as subtotal_sum,
      COALESCE(SUM(tax), 0) as tax_sum,
      COALESCE(SUM(tip), 0) as tip_sum
    FROM orders
    WHERE status = 'paid' AND DATE(closed_at) BETWEEN ? AND ?
  `).get(dateFrom, dateTo);

  const byMethod = db.prepare(`
    SELECT method, COUNT(*) as count, SUM(amount) as total
    FROM payments p JOIN orders o ON p.order_id = o.id
    WHERE status = 'paid' AND DATE(o.closed_at) BETWEEN ? AND ?
    GROUP BY method
  `).all(dateFrom, dateTo);

  const topProducts = db.prepare(`
    SELECT oi.product_name, SUM(oi.quantity) as qty_sold, SUM(oi.quantity * oi.unit_price) as revenue
    FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE o.status = 'paid' AND DATE(o.closed_at) BETWEEN ? AND ?
    GROUP BY oi.product_name ORDER BY qty_sold DESC LIMIT 10
  `).all(dateFrom, dateTo);

  const hourly = db.prepare(`
    SELECT strftime('%H', closed_at) as hour, COUNT(*) as orders, SUM(total) as revenue
    FROM orders
    WHERE status = 'paid' AND DATE(closed_at) BETWEEN ? AND ?
    GROUP BY hour ORDER BY hour
  `).all(dateFrom, dateTo);

  res.json({ period: { from: dateFrom, to: dateTo }, sales, byMethod, topProducts, hourly });
});

app.get('/api/reports/daily', (req, res) => {
  const { days = 30 } = req.query;
  const rows = db.prepare(`
    SELECT DATE(closed_at) as date, COUNT(*) as orders, SUM(total) as revenue, AVG(total) as avg
    FROM orders WHERE status = 'paid' AND closed_at >= DATE('now', '-' || ? || ' days')
    GROUP BY DATE(closed_at) ORDER BY date ASC
  `).all(parseInt(days));
  res.json(rows);
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const tables = db.prepare('SELECT COUNT(*) as c FROM restaurant_tables').get();
  const products = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get();
  const openOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'open'").get();
  res.json({ status: 'ok', tables: tables.c, products: products.c, open_orders: openOrders.c });
});

app.listen(PORT, () => {
  console.log(`🍽️  Urban Beach POS API running on http://localhost:${PORT}`);
});
