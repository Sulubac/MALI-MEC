import { create } from 'zustand';
import { api } from '../api/client';

const useStore = create((set, get) => ({
  // State
  tables: [],
  categories: [],
  products: [],
  currentTable: null,
  currentOrder: null,
  selectedCategoryId: null,
  stockAlerts: [],
  loading: {},
  error: null,
  notification: null,

  setLoading: (key, val) => set(s => ({ loading: { ...s.loading, [key]: val } })),
  setError: (error) => set({ error }),
  notify: (message, type = 'success') => {
    set({ notification: { message, type, id: Date.now() } });
    setTimeout(() => set({ notification: null }), 3500);
  },

  // Tables
  fetchTables: async () => {
    try {
      const tables = await api.getTables();
      set({ tables });
    } catch (e) { set({ error: e.message }); }
  },

  // Categories & Products
  fetchCatalog: async () => {
    try {
      const [categories, products] = await Promise.all([api.getCategories(), api.getProducts()]);
      set({ categories, products });
    } catch (e) { set({ error: e.message }); }
  },

  setSelectedCategory: (id) => set({ selectedCategoryId: id }),

  // Open a table session (get or create order)
  openTableSession: async (table) => {
    get().setLoading('session', true);
    try {
      const session = await api.getTableSession(table.id);
      set({ currentTable: table, currentOrder: session });
      // Refresh table list to update status
      get().fetchTables();
    } catch (e) {
      set({ error: e.message });
    } finally {
      get().setLoading('session', false);
    }
  },

  closeSession: () => set({ currentTable: null, currentOrder: null }),

  // Order item management
  addItem: async (product) => {
    const order = get().currentOrder;
    if (!order) return;
    try {
      const result = await api.addItem(order.id, { product_id: product.id, quantity: 1 });
      set(s => ({
        currentOrder: {
          ...s.currentOrder,
          ...result,
          items: result.items,
        },
      }));
      get().notify(`${product.name} ajouté`);
    } catch (e) { get().notify(e.message, 'error'); }
  },

  updateItemQty: async (itemId, quantity) => {
    const order = get().currentOrder;
    if (!order) return;
    try {
      const result = await api.updateItem(order.id, itemId, { quantity });
      set(s => ({
        currentOrder: { ...s.currentOrder, ...result, items: result.items },
      }));
    } catch (e) { get().notify(e.message, 'error'); }
  },

  removeItem: async (itemId) => {
    const order = get().currentOrder;
    if (!order) return;
    try {
      const result = await api.removeItem(order.id, itemId);
      set(s => ({
        currentOrder: { ...s.currentOrder, ...result, items: result.items },
      }));
    } catch (e) { get().notify(e.message, 'error'); }
  },

  applyDiscount: async (discount) => {
    const order = get().currentOrder;
    if (!order) return;
    try {
      const updated = await api.updateOrder(order.id, { discount });
      set(s => ({ currentOrder: { ...s.currentOrder, ...updated } }));
    } catch (e) { get().notify(e.message, 'error'); }
  },

  checkout: async (paymentData) => {
    const order = get().currentOrder;
    if (!order) return;
    try {
      const result = await api.checkout(order.id, paymentData);
      get().notify('Paiement enregistré avec succès !');
      set({ currentTable: null, currentOrder: null });
      get().fetchTables();
      return result;
    } catch (e) {
      get().notify(e.message, 'error');
      throw e;
    }
  },

  voidOrder: async () => {
    const order = get().currentOrder;
    if (!order) return;
    try {
      await api.voidOrder(order.id);
      get().notify('Commande annulée');
      set({ currentTable: null, currentOrder: null });
      get().fetchTables();
    } catch (e) { get().notify(e.message, 'error'); }
  },

  // Stock alerts
  fetchStockAlerts: async () => {
    try {
      const alerts = await api.getStockAlerts();
      set({ stockAlerts: alerts });
    } catch (e) { /* silent */ }
  },
}));

export default useStore;
