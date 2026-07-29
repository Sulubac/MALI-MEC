import React, { useState, useEffect } from 'react';
import { Settings, Table2, Package2, Tag, Plus, Edit3, Trash2, X, Check } from 'lucide-react';
import { api } from '../api/client';
import useStore from '../store/useStore';

export default function SettingsPage() {
  const [tab, setTab] = useState('tables');
  const { fetchTables, fetchCatalog } = useStore();

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={20} className="text-brand-500" />
          Paramètres
        </h1>
      </div>
      <div className="flex border-b border-slate-700 px-4">
        {[
          { id: 'tables', label: 'Tables', icon: Table2 },
          { id: 'products', label: 'Produits', icon: Package2 },
          { id: 'categories', label: 'Catégories', icon: Tag },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors ${
              tab === id ? 'border-brand-500 text-brand-400' : 'border-transparent text-slate-400 hover:text-white'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'tables' && <TablesSettings onChanged={fetchTables} />}
        {tab === 'products' && <ProductsSettings onChanged={fetchCatalog} />}
        {tab === 'categories' && <CategoriesSettings onChanged={fetchCatalog} />}
      </div>
    </div>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────
function TablesSettings({ onChanged }) {
  const [tables, setTables] = useState([]);
  const [form, setForm] = useState({ name: '', capacity: 4, section: 'Salle Principale' });
  const [editing, setEditing] = useState(null);

  const load = async () => { setTables(await api.getTables()); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return;
    if (editing) {
      await api.updateTable(editing.id, form);
    } else {
      await api.createTable(form);
    }
    setForm({ name: '', capacity: 4, section: 'Salle Principale' });
    setEditing(null);
    load(); onChanged();
  };

  const del = async (id) => {
    if (!confirm('Supprimer cette table ?')) return;
    await api.deleteTable(id);
    load(); onChanged();
  };

  return (
    <div className="p-4 space-y-4">
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{editing ? 'Modifier la table' : 'Ajouter une table'}</h3>
        <div className="grid grid-cols-3 gap-2">
          <input className="input col-span-1" placeholder="Nom (T1, VIP1...)" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <input className="input" type="number" placeholder="Capacité" min="1" value={form.capacity} onChange={e => setForm(f => ({...f, capacity: +e.target.value}))} />
          <input className="input" placeholder="Section" value={form.section} onChange={e => setForm(f => ({...f, section: e.target.value}))} />
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={save} className="btn-primary text-sm">{editing ? 'Sauvegarder' : 'Ajouter'}</button>
          {editing && <button onClick={() => { setEditing(null); setForm({ name: '', capacity: 4, section: 'Salle Principale' }); }} className="btn-ghost text-sm">Annuler</button>}
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
            <th className="text-left px-4 py-2">Nom</th>
            <th className="text-left px-4 py-2">Section</th>
            <th className="text-right px-4 py-2">Capacité</th>
            <th className="text-right px-4 py-2">Statut</th>
            <th className="px-4 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">
            {tables.map(t => (
              <tr key={t.id} className="hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-white">{t.name}</td>
                <td className="px-4 py-2.5 text-slate-400">{t.section}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{t.capacity} pers.</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`badge ${t.status === 'available' ? 'badge-green' : t.status === 'occupied' ? 'badge-red' : 'badge-amber'}`}>
                    {t.status === 'available' ? 'Libre' : t.status === 'occupied' ? 'Occupé' : t.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(t); setForm({ name: t.name, capacity: t.capacity, section: t.section }); }} className="btn-ghost p-1.5 text-xs"><Edit3 size={13} /></button>
                    <button onClick={() => del(t.id)} className="btn-ghost p-1.5 text-xs text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Products ─────────────────────────────────────────────────────────────────
function ProductsSettings({ onChanged }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('');

  const load = async () => {
    const [p, c] = await Promise.all([api.getProducts({ active: 1 }), api.getCategories()]);
    setProducts(p); setCategories(c);
  };
  useEffect(() => { load(); }, []);

  const del = async (id) => {
    if (!confirm('Désactiver ce produit ?')) return;
    await api.deleteProduct(id); load(); onChanged();
  };

  const filtered = products.filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <input className="input flex-1 text-sm" placeholder="Rechercher..." value={filter} onChange={e => setFilter(e.target.value)} />
        <button onClick={() => setModal({ category_id: categories[0]?.id, name: '', price: '', cost: '', description: '', track_stock: false })} className="btn-primary text-sm gap-1">
          <Plus size={14} /> Ajouter
        </button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
            <th className="text-left px-4 py-2">Produit</th>
            <th className="text-left px-4 py-2">Catégorie</th>
            <th className="text-right px-4 py-2">Prix</th>
            <th className="text-right px-4 py-2">Coût</th>
            <th className="text-center px-4 py-2">Stock suivi</th>
            <th className="px-4 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-white">{p.name}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: p.category_color + '30', color: p.category_color }}>
                    {p.category_name}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-brand-400 font-medium">{p.price?.toLocaleString('fr-FR')} DJF</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{p.cost?.toLocaleString('fr-FR')} DJF</td>
                <td className="px-4 py-2.5 text-center">{p.track_stock ? <Check size={14} className="inline text-brand-500" /> : '—'}</td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setModal(p)} className="btn-ghost p-1.5"><Edit3 size={13} /></button>
                    <button onClick={() => del(p.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && (
        <ProductModal
          product={modal}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            if (modal.id) await api.updateProduct(modal.id, data);
            else await api.createProduct(data);
            setModal(null); load(); onChanged();
          }}
        />
      )}
    </div>
  );
}

function ProductModal({ product, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    category_id: product.category_id || categories[0]?.id,
    name: product.name || '',
    description: product.description || '',
    price: product.price || '',
    cost: product.cost || '',
    track_stock: product.track_stock || false,
  });
  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="font-bold text-white">{product.id ? 'Modifier' : 'Nouveau'} produit</h2>
          <button onClick={onClose} className="btn-ghost p-2"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Catégorie</label>
            <select className="input" value={form.category_id} onChange={e => set('category_id', +e.target.value)}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Nom du produit *</label>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Homard Grillé" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Prix de vente (DJF) *</label>
              <input className="input" type="number" min="0" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Coût (DJF)</label>
              <input className="input" type="number" min="0" value={form.cost} onChange={e => set('cost', e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.track_stock} onChange={e => set('track_stock', e.target.checked)} className="w-4 h-4 accent-brand-500" />
            <span className="text-sm text-slate-300">Suivre le stock pour ce produit</span>
          </label>
        </div>
        <div className="p-5 pt-0 flex gap-2">
          <button onClick={onClose} className="btn-outline flex-1">Annuler</button>
          <button onClick={() => onSave(form)} className="btn-primary flex-1">Sauvegarder</button>
        </div>
      </div>
    </div>
  );
}

// ── Categories ────────────────────────────────────────────────────────────────
function CategoriesSettings({ onChanged }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', color: '#10b981' });
  const [editing, setEditing] = useState(null);

  const load = async () => { setCategories(await api.getCategories()); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return;
    if (editing) await api.updateCategory(editing.id, form);
    else await api.createCategory(form);
    setForm({ name: '', color: '#10b981' }); setEditing(null);
    load(); onChanged();
  };

  const del = async (id) => {
    if (!confirm('Supprimer cette catégorie ?')) return;
    await api.deleteCategory(id); load(); onChanged();
  };

  const PRESET_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

  return (
    <div className="p-4 space-y-4">
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{editing ? 'Modifier' : 'Ajouter'} une catégorie</h3>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-slate-400 mb-1 block">Nom</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Fruits de Mer" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Couleur</label>
            <input type="color" value={form.color} onChange={e => setForm(f => ({...f, color: e.target.value}))}
              className="w-10 h-10 rounded-lg cursor-pointer border border-slate-600 bg-slate-700 p-1" />
          </div>
        </div>
        <div className="flex gap-1.5 mt-2">
          {PRESET_COLORS.map(c => (
            <button key={c} onClick={() => setForm(f => ({...f, color: c}))}
              className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: form.color === c ? 'white' : 'transparent' }} />
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={save} className="btn-primary text-sm">{editing ? 'Sauvegarder' : 'Ajouter'}</button>
          {editing && <button onClick={() => { setEditing(null); setForm({ name: '', color: '#10b981' }); }} className="btn-ghost text-sm">Annuler</button>}
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
            <th className="text-left px-4 py-2">Catégorie</th>
            <th className="text-left px-4 py-2">Couleur</th>
            <th className="px-4 py-2"></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-800">
            {categories.map(c => (
              <tr key={c.id} className="hover:bg-slate-800/50">
                <td className="px-4 py-2.5 font-medium text-white">{c.name}</td>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: c.color }} />
                    <span className="text-slate-400 text-xs font-mono">{c.color}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(c); setForm({ name: c.name, color: c.color }); }} className="btn-ghost p-1.5"><Edit3 size={13} /></button>
                    <button onClick={() => del(c.id)} className="btn-ghost p-1.5 text-red-400 hover:text-red-300"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
