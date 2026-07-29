const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur serveur');
  }
  return res.json();
}

export const api = {
  // Categories
  getCategories: () => request('/categories'),
  createCategory: (data) => request('/categories', { method: 'POST', body: data }),
  updateCategory: (id, data) => request(`/categories/${id}`, { method: 'PUT', body: data }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/products${q ? '?' + q : ''}`);
  },
  createProduct: (data) => request('/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: 'PUT', body: data }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  // Tables
  getTables: () => request('/tables'),
  createTable: (data) => request('/tables', { method: 'POST', body: data }),
  updateTable: (id, data) => request(`/tables/${id}`, { method: 'PUT', body: data }),
  deleteTable: (id) => request(`/tables/${id}`, { method: 'DELETE' }),

  // Session (get or create order for a table)
  getTableSession: (tableId, data = {}) =>
    request(`/tables/${tableId}/session`, { method: 'POST', body: data }),

  // Orders
  getOrders: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/orders${q ? '?' + q : ''}`);
  },
  getOrder: (id) => request(`/orders/${id}`),
  updateOrder: (id, data) => request(`/orders/${id}`, { method: 'PUT', body: data }),
  addItem: (orderId, data) => request(`/orders/${orderId}/items`, { method: 'POST', body: data }),
  updateItem: (orderId, itemId, data) => request(`/orders/${orderId}/items/${itemId}`, { method: 'PUT', body: data }),
  removeItem: (orderId, itemId) => request(`/orders/${orderId}/items/${itemId}`, { method: 'DELETE' }),
  checkout: (orderId, data) => request(`/orders/${orderId}/checkout`, { method: 'POST', body: data }),
  voidOrder: (orderId) => request(`/orders/${orderId}/void`, { method: 'POST' }),

  // Stock
  getStock: () => request('/stock'),
  getStockAlerts: () => request('/stock/alerts'),
  getStockMovements: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/stock/movements${q ? '?' + q : ''}`);
  },
  adjustStock: (data) => request('/stock/adjustment', { method: 'POST', body: data }),
  updateStockSettings: (productId, data) => request(`/stock/${productId}`, { method: 'PUT', body: data }),

  // Reports
  getReportSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/summary${q ? '?' + q : ''}`);
  },
  getDailyReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/daily${q ? '?' + q : ''}`);
  },
};
