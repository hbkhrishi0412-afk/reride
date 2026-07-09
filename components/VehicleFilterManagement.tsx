import React, { useState, useEffect, memo } from 'react';
import type { VehicleData } from '../types';
import { VehicleCategory } from '../types';
import { getVehicleData, createVehicleData, updateVehicleData, deleteVehicleData } from '../services/vehicleDataService';
import { useApp } from './AppProvider';

interface VehicleFilterManagementProps {
  onDataUpdate?: (data: VehicleData) => void;
}

interface VehicleDataItem {
  _id?: string;
  category: string;
  make: string;
  model: string;
  variants: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

const VehicleFilterManagement: React.FC<VehicleFilterManagementProps> = memo(({ onDataUpdate }) => {
  const { runIfConfirmed } = useApp();
  const [vehicleData, setVehicleData] = useState<VehicleData>({});
  const [vehicleDataItems, setVehicleDataItems] = useState<VehicleDataItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<VehicleDataItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Form state for adding/editing
  const [formData, setFormData] = useState({
    category: '',
    make: '',
    model: '',
    variants: [] as string[],
    newVariant: ''
  });

  useEffect(() => {
    loadVehicleData();
  }, []);

  const loadVehicleData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getVehicleData();
      setVehicleData(data);
      
      // Transform data to flat structure for management
      const items: VehicleDataItem[] = [];
      Object.entries(data).forEach(([category, makes]) => {
        makes.forEach(make => {
          make.models.forEach(model => {
            items.push({
              category,
              make: make.name,
              model: model.name,
              variants: model.variants
            });
          });
        });
      });
      setVehicleDataItems(items);
      
      if (onDataUpdate) {
        onDataUpdate(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicle data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddVariant = () => {
    if (formData.newVariant.trim()) {
      setFormData(prev => ({
        ...prev,
        variants: [...prev.variants, prev.newVariant.trim()],
        newVariant: ''
      }));
    }
  };

  const handleRemoveVariant = (index: number) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.make || !formData.model || formData.variants.length === 0) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setError(null);
      
      if (editingItem) {
        // Update existing item
        const result = await updateVehicleData(editingItem._id!, {
          category: formData.category,
          make: formData.make,
          model: formData.model,
          variants: formData.variants
        });
        
        if (result.success) {
          await loadVehicleData();
          setEditingItem(null);
          resetForm();
        } else {
          setError(result.error || 'Failed to update vehicle data');
        }
      } else {
        // Create new item
        const result = await createVehicleData({
          category: formData.category,
          make: formData.make,
          model: formData.model,
          variants: formData.variants
        });
        
        if (result.success) {
          await loadVehicleData();
          resetForm();
        } else {
          setError(result.error || 'Failed to create vehicle data');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleEdit = (item: VehicleDataItem) => {
    setEditingItem(item);
    setFormData({
      category: item.category,
      make: item.make,
      model: item.model,
      variants: [...item.variants],
      newVariant: ''
    });
    setIsAdding(true);
  };

  const handleDelete = async (item: VehicleDataItem) => {
    if (!item._id) return;
    
    void runIfConfirmed(
      'Are you sure you want to delete this vehicle data?',
      async () => {
      try {
        const result = await deleteVehicleData(item._id!);
        if (result.success) {
          await loadVehicleData();
        } else {
          setError(result.error || 'Failed to delete vehicle data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
      },
      { variant: 'danger' },
    );
  };

  const resetForm = () => {
    setFormData({
      category: '',
      make: '',
      model: '',
      variants: [],
      newVariant: ''
    });
    setIsAdding(false);
    setEditingItem(null);
  };

  const filteredItems = vehicleDataItems.filter(item => {
    const matchesSearch = item.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.variants.some(v => v.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
        <span className="ml-2">Loading vehicle data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vehicle Filter Management</h2>
          <p className="text-gray-600">Manage vehicle categories, makes, models, and variants</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
        >
          <span>+</span>
          Add Vehicle Data
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search makes, models, or variants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="">All Categories</option>
          {Object.values(VehicleCategory).map(category => (
            <option key={category} value={category}>
              {category.replace('-', ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Add/Edit Form */}
      {isAdding && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingItem ? 'Edit Vehicle Data' : 'Add New Vehicle Data'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  <option value="">Select Category</option>
                  {Object.values(VehicleCategory).map(category => (
                    <option key={category} value={category}>
                      {category.replace('-', ' ').toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                <input
                  type="text"
                  value={formData.make}
                  onChange={(e) => setFormData(prev => ({ ...prev, make: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Maruti Suzuki"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Swift"
                  required
                />
              </div>
            </div>

            {/* Variants */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Variants</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={formData.newVariant}
                  onChange={(e) => setFormData(prev => ({ ...prev, newVariant: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Add variant (e.g., LXi, VXi)"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariant())}
                />
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Add
                </button>
              </div>
              
              {formData.variants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.variants.map((variant, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm"
                    >
                      {variant}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(index)}
                        className="ml-1 text-orange-600 hover:text-orange-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                {editingItem ? 'Update' : 'Add'} Vehicle Data
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vehicle Data List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Make
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Variants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.category.replace('-', ' ').toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.make}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.model}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex flex-wrap gap-1">
                      {item.variants.slice(0, 3).map((variant, idx) => (
                        <span
                          key={idx}
                          className="inline-flex px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs"
                        >
                          {variant}
                        </span>
                      ))}
                      {item.variants.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{item.variants.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="text-orange-600 hover:text-orange-900"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredItems.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            {searchTerm || selectedCategory ? 'No matching vehicle data found' : 'No vehicle data available'}
          </div>
        )}
      </div>
    </div>
  );
});

VehicleFilterManagement.displayName = 'VehicleFilterManagement';

export default VehicleFilterManagement;
