import React, { useEffect, useState } from 'react';
import { newCarsService, NewCarPayload, NewCarVariantPayload } from '../services/newCarsService';
import { View, User } from '../types';

interface NewCarsAdminProps {
  currentUser: User | null;
  onNavigate: (view: View) => void;
}

const emptyVariant: NewCarVariantPayload = {
  variant_name: '',
  engine_specs: '',
  fuel_type: 'Petrol',
  transmission: 'Manual',
  power_bhp: '',
  torque_nm: '',
  on_road_prices: { Maharashtra: 0 },
  features: { safety: [], comfort_convenience: [], interior: [], exterior: [] }
};

const emptyModel: NewCarPayload = {
  brand_name: '',
  model_name: '',
  model_year: new Date().getFullYear(),
  body_type: 'SUV',
  overview: '',
  key_specs: { engine: '', mileage: '', power: '', seating_capacity: 5 },
  fuel_options: ['Petrol'],
  variants: [emptyVariant],
  image_url: '',
  gallery_images: [],
  brochure_url: '',
  monthly_sales: 0,
  starting_price: 0,
  emi: { downPayment: 0, interestRate: 10, tenureMonths: 60 },
  faqs: []
};

const NewCarsAdmin: React.FC<NewCarsAdminProps> = ({ currentUser, onNavigate }) => {
  const [items, setItems] = useState<NewCarPayload[]>([]);
  const [editing, setEditing] = useState<NewCarPayload>(emptyModel);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await newCarsService.getAll();
        setItems(data);
      } catch (e) {
        setItems([]);
      }
    })();
  }, []);

  const resetForm = () => setEditing(emptyModel);

  const save = async () => {
    setError('');
    setIsSaving(true);
    try {
      if (editing._id) {
        const updated = await newCarsService.update(editing._id, editing);
        setItems(prev => prev.map(i => (i._id === updated._id ? updated : i)));
      } else {
        const created = await newCarsService.create(editing);
        setItems(prev => [created, ...prev]);
      }
      resetForm();
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (item: NewCarPayload) => setEditing(item);

  const addVariant = () => setEditing(prev => ({ ...prev, variants: [...prev.variants, { ...emptyVariant }] }));
  const removeVariant = (idx: number) => setEditing(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== idx) }));

  const updateVariant = (idx: number, patch: Partial<NewCarVariantPayload>) => {
    setEditing(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    }));
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">New Cars Admin</h1>
        <button className="btn-brand-primary" onClick={() => onNavigate(View.NEW_CARS)}>View Public Page</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-soft p-6">
          <h2 className="text-xl font-semibold mb-4">{editing._id ? 'Edit Model' : 'Add New Model'}</h2>
          {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-3">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="input" placeholder="Brand Name" value={editing.brand_name} onChange={e => setEditing({ ...editing, brand_name: e.target.value })} />
            <input className="input" placeholder="Model Name" value={editing.model_name} onChange={e => setEditing({ ...editing, model_name: e.target.value })} />
            <input className="input" type="number" placeholder="Model Year" value={editing.model_year} onChange={e => setEditing({ ...editing, model_year: Number(e.target.value) })} />
            <select className="input" value={editing.body_type} onChange={e => setEditing({ ...editing, body_type: e.target.value as any })}>
              <option value="SUV">SUV</option>
              <option value="Sedan">Sedan</option>
              <option value="Hatchback">Hatchback</option>
              <option value="MUV">MUV</option>
            </select>
            <input className="input md:col-span-2" placeholder="Image URL" value={editing.image_url} onChange={e => setEditing({ ...editing, image_url: e.target.value })} />
            <textarea className="input md:col-span-2" rows={3} placeholder="Overview / description" value={editing.overview} onChange={e => setEditing({ ...editing, overview: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <input className="input" placeholder="Engine (e.g., 1498 cc)" value={editing.key_specs.engine} onChange={e => setEditing({ ...editing, key_specs: { ...editing.key_specs, engine: e.target.value } })} />
            <input className="input" placeholder="Mileage (e.g., 17 kmpl)" value={editing.key_specs.mileage} onChange={e => setEditing({ ...editing, key_specs: { ...editing.key_specs, mileage: e.target.value } })} />
            <input className="input" placeholder="Power (e.g., 113 bhp)" value={editing.key_specs.power} onChange={e => setEditing({ ...editing, key_specs: { ...editing.key_specs, power: e.target.value } })} />
            <input className="input" type="number" placeholder="Seating Capacity" value={editing.key_specs.seating_capacity} onChange={e => setEditing({ ...editing, key_specs: { ...editing.key_specs, seating_capacity: Number(e.target.value) } })} />
            <input className="input" type="number" placeholder="Safety Rating (0-5)" value={editing.key_specs.safety_rating_stars || 0} onChange={e => setEditing({ ...editing, key_specs: { ...editing.key_specs, safety_rating_stars: Number(e.target.value) } })} />
            <input className="input" type="number" placeholder="Boot Space (litres)" value={editing.key_specs.boot_space_litres || 0} onChange={e => setEditing({ ...editing, key_specs: { ...editing.key_specs, boot_space_litres: Number(e.target.value) } })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <input className="input" type="number" placeholder="Starting Price (₹)" value={editing.starting_price || 0} onChange={e => setEditing({ ...editing, starting_price: Number(e.target.value) })} />
            <input className="input" type="number" placeholder="Monthly Sales" value={editing.monthly_sales || 0} onChange={e => setEditing({ ...editing, monthly_sales: Number(e.target.value) })} />
            <input className="input" placeholder="Brochure URL" value={editing.brochure_url || ''} onChange={e => setEditing({ ...editing, brochure_url: e.target.value })} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <input className="input" type="number" placeholder="EMI: Down Payment" value={editing.emi?.downPayment || 0} onChange={e => setEditing({ ...editing, emi: { ...(editing.emi || { downPayment: 0, interestRate: 10, tenureMonths: 60 }), downPayment: Number(e.target.value) } })} />
            <input className="input" type="number" placeholder="EMI: Interest %" value={editing.emi?.interestRate || 10} onChange={e => setEditing({ ...editing, emi: { ...(editing.emi || { downPayment: 0, interestRate: 10, tenureMonths: 60 }), interestRate: Number(e.target.value) } })} />
            <input className="input" type="number" placeholder="EMI: Tenure (months)" value={editing.emi?.tenureMonths || 60} onChange={e => setEditing({ ...editing, emi: { ...(editing.emi || { downPayment: 0, interestRate: 10, tenureMonths: 60 }), tenureMonths: Number(e.target.value) } })} />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold mb-2">Gallery Images (one URL per line)</label>
            <textarea className="input" rows={3} placeholder="https://...\nhttps://..." value={(editing.gallery_images || []).join('\n')} onChange={e => setEditing({ ...editing, gallery_images: e.target.value.split('\n').map(s => s.trim()).filter(Boolean) })} />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">Variants</h3>
              <button className="text-sm text-orange-600" onClick={addVariant}>+ Add Variant</button>
            </div>
            {editing.variants.map((v, idx) => (
              <div key={idx} className="border rounded-lg p-4 mb-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="input" placeholder="Variant Name" value={v.variant_name} onChange={e => updateVariant(idx, { variant_name: e.target.value })} />
                  <input className="input" placeholder="Engine Specs" value={v.engine_specs} onChange={e => updateVariant(idx, { engine_specs: e.target.value })} />
                  <select className="input" value={v.fuel_type} onChange={e => updateVariant(idx, { fuel_type: e.target.value as any })}>
                    {['Petrol','Diesel','CNG','Electric/EV','Hybrid'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <select className="input" value={v.transmission} onChange={e => updateVariant(idx, { transmission: e.target.value as any })}>
                    {['Manual','Automatic','AMT','CVT','DCT','e-CVT'].map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <input className="input" placeholder="Power (bhp)" value={v.power_bhp} onChange={e => updateVariant(idx, { power_bhp: e.target.value })} />
                  <input className="input" placeholder="Torque (Nm)" value={v.torque_nm} onChange={e => updateVariant(idx, { torque_nm: e.target.value })} />
                  <input className="input md:col-span-2" type="number" placeholder="On-road Price (Maharashtra)" value={v.on_road_prices['Maharashtra'] || 0} onChange={e => updateVariant(idx, { on_road_prices: { ...v.on_road_prices, Maharashtra: Number(e.target.value) } })} />
                </div>
                <div className="mt-2 flex justify-between">
                  <small className="text-gray-500">Add more states via API later</small>
                  <button className="text-sm text-red-600" onClick={() => removeVariant(idx)}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">FAQs</h3>
              <button className="text-sm text-orange-600" onClick={() => setEditing(prev => ({ ...prev, faqs: [...(prev.faqs || []), { question: '', answer: '' }] }))}>+ Add FAQ</button>
            </div>
            {(editing.faqs || []).map((f, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                <input className="input" placeholder="Question" value={f.question} onChange={e => setEditing(prev => ({ ...prev, faqs: (prev.faqs || []).map((x, i) => i === idx ? { ...x, question: e.target.value } : x) }))} />
                <input className="input" placeholder="Answer" value={f.answer} onChange={e => setEditing(prev => ({ ...prev, faqs: (prev.faqs || []).map((x, i) => i === idx ? { ...x, answer: e.target.value } : x) }))} />
                <div className="md:col-span-2 text-right">
                  <button className="text-sm text-red-600" onClick={() => setEditing(prev => ({ ...prev, faqs: (prev.faqs || []).filter((_, i) => i !== idx) }))}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button className="btn-brand-primary" disabled={isSaving} onClick={save}>{isSaving ? 'Saving...' : (editing._id ? 'Update' : 'Create')}</button>
            <button className="btn-secondary" disabled={isSaving} onClick={resetForm}>Reset</button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-soft p-6">
          <h2 className="text-xl font-semibold mb-4">Existing Models</h2>
          <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
            {items.map(item => (
              <div key={item._id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{item.brand_name} {item.model_name} ({item.model_year})</div>
                  <div className="text-sm text-gray-600">{item.body_type} · Variants: {item.variants?.length || 0} · ₹{item.starting_price || 0}</div>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-orange-600" onClick={() => startEdit(item)}>Edit</button>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-gray-500">No entries yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewCarsAdmin;


