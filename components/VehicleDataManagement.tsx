import React, { useState, useEffect, useMemo } from 'react';
import { VehicleData, VehicleCategory } from '../types.js';

interface VehicleDataManagementProps {
  vehicleData: VehicleData;
  onUpdate: (newData: VehicleData) => void;
  onPreview: () => void;
  onBulkUpload: () => void;
}

interface EditingState {
  type: 'category' | 'make' | 'model' | 'variant';
  path: string[];
  value: string;
  originalValue: string;
}

const VehicleDataManagement: React.FC<VehicleDataManagementProps> = ({
  vehicleData,
  onUpdate,
  onPreview,
  onBulkUpload
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [adding, setAdding] = useState<{ type: string; path: string[] } | null>(null);
  const [newItemValue, setNewItemValue] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate selectedCategory exists in vehicleData when vehicleData changes
  useEffect(() => {
    if (selectedCategory && !vehicleData[selectedCategory]) {
      // Category key doesn't exist, clear selection
      setSelectedCategory(null);
      setSelectedMake(null);
      setSelectedModel(null);
    }
  }, [vehicleData, selectedCategory]);

  // Helper function to normalize category keys for comparison
  // Handles different formats: 'FOUR_WHEELER', 'four-wheeler', 'Four Wheeler', etc.
  // Uses the same normalization as VehicleList for consistency
  const normalizeCategoryKey = (category: string): string => {
    return String(category).toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-').trim();
  };

  // Helper function to find category key by normalized value
  const findCategoryKey = (normalizedValue: string): string | null => {
    const normalized = normalizeCategoryKey(normalizedValue);
    return Object.keys(vehicleData).find(key => normalizeCategoryKey(key) === normalized) || null;
  };

  // Get available data based on selections
  const categories = Object.keys(vehicleData).sort();
  
  // Helper function to format category names for display
  const formatCategoryName = (category: string) => {
    return category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  // Get makes filtered by selected category - ensure we use the exact category key
  // Only show makes from the selected category, not from all categories
  const makes = useMemo(() => {
    if (!selectedCategory) return [];
    const categoryData = vehicleData[selectedCategory];
    if (!categoryData || !Array.isArray(categoryData)) return [];
    return categoryData.map(make => make.name).sort();
  }, [selectedCategory, vehicleData]);
  
  // Get models filtered by selected category and make
  // Only show models from the selected category and make combination
  const models = useMemo(() => {
    if (!selectedCategory || !selectedMake) return [];
    const categoryData = vehicleData[selectedCategory];
    if (!categoryData || !Array.isArray(categoryData)) return [];
    const makeData = categoryData.find(make => make.name === selectedMake);
    if (!makeData || !makeData.models) return [];
    return makeData.models.map(model => model.name).sort();
  }, [selectedCategory, selectedMake, vehicleData]);
  
  // Get variants filtered by selected category, make, and model
  const variants = useMemo(() => {
    if (!selectedCategory || !selectedMake || !selectedModel) return [];
    const categoryData = vehicleData[selectedCategory];
    if (!categoryData || !Array.isArray(categoryData)) return [];
    const makeData = categoryData.find(make => make.name === selectedMake);
    if (!makeData || !makeData.models) return [];
    const modelData = makeData.models.find(model => model.name === selectedModel);
    if (!modelData || !modelData.variants) return [];
    return [...modelData.variants].sort();
  }, [selectedCategory, selectedMake, selectedModel, vehicleData]);

  // Filter data based on search term
  const filteredCategories = categories.filter(cat => 
    cat.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredMakes = makes.filter(make => 
    make.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredModels = models.filter(model => 
    model.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredVariants = variants.filter(variant => 
    variant.toLowerCase().includes(searchTerm.toLowerCase())
  );


  const handleUpdateData = (updater: (draft: VehicleData) => void) => {
    console.log('🔄 Updating vehicle data...');
    const newData = { ...vehicleData };
    updater(newData);
    console.log('📝 New vehicle data:', newData);
    
    // Update localStorage immediately
    localStorage.setItem('reRideVehicleData', JSON.stringify(newData));
    console.log('💾 Vehicle data saved to localStorage');
    
    // Update parent component
    onUpdate(newData);
    console.log('✅ Vehicle data update sent to parent');
  };

  const handleEdit = (type: EditingState['type'], path: string[], value: string) => {
    setEditing({ type, path, value, originalValue: value });
  };

  const handleSaveEdit = () => {
    if (!editing || !editing.value.trim()) {
      setEditing(null);
      return;
    }

    const newValue = editing.value.trim();
    if (newValue === editing.originalValue) {
      setEditing(null);
      return;
    }

    handleUpdateData(draft => {
      if (editing.type === 'category') {
        if (newValue !== editing.originalValue && draft[newValue]) {
          alert(`Category "${newValue}" already exists.`);
          return;
        }
        const data = draft[editing.originalValue];
        delete draft[editing.originalValue];
        draft[newValue] = data;
      } else if (editing.type === 'make') {
        const categoryData = draft[editing.path[0]];
        if (categoryData) {
          const makeIndex = categoryData.findIndex(make => make.name === editing.originalValue);
          if (makeIndex !== -1) {
            if (categoryData.some(make => make.name === newValue && make !== categoryData[makeIndex])) {
              alert(`Make "${newValue}" already exists.`);
              return;
            }
            categoryData[makeIndex].name = newValue;
          }
        }
      } else if (editing.type === 'model') {
        const make = draft[editing.path[0]]?.find(m => m.name === editing.path[1]);
        if (make) {
          const modelIndex = make.models.findIndex(model => model.name === editing.originalValue);
          if (modelIndex !== -1) {
            if (make.models.some(model => model.name === newValue && model !== make.models[modelIndex])) {
              alert(`Model "${newValue}" already exists.`);
              return;
            }
            make.models[modelIndex].name = newValue;
          }
        }
      } else if (editing.type === 'variant') {
        const model = draft[editing.path[0]]?.find(m => m.name === editing.path[1])?.models.find(mo => mo.name === editing.path[2]);
        if (model) {
          const variantIndex = model.variants.findIndex(variant => variant === editing.originalValue);
          if (variantIndex !== -1) {
            if (model.variants.includes(newValue) && model.variants[variantIndex] !== newValue) {
              alert(`Variant "${newValue}" already exists.`);
              return;
            }
            model.variants[variantIndex] = newValue;
          }
        }
      }
    });

    setEditing(null);
  };

  const handleDelete = (type: EditingState['type'], path: string[], value: string) => {
    if (!window.confirm(`Are you sure you want to delete "${value}"? This action cannot be undone.`)) {
      return;
    }

    handleUpdateData(draft => {
      if (type === 'category') {
        delete draft[value];
      } else if (type === 'make') {
        const categoryData = draft[path[0]];
        if (categoryData) {
          const makeIndex = categoryData.findIndex(make => make.name === value);
          if (makeIndex !== -1) {
            categoryData.splice(makeIndex, 1);
          }
        }
      } else if (type === 'model') {
        const make = draft[path[0]]?.find(m => m.name === path[1]);
        if (make) {
          const modelIndex = make.models.findIndex(model => model.name === value);
          if (modelIndex !== -1) {
            make.models.splice(modelIndex, 1);
          }
        }
      } else if (type === 'variant') {
        const model = draft[path[0]]?.find(m => m.name === path[1])?.models.find(mo => mo.name === path[2]);
        if (model) {
          const variantIndex = model.variants.findIndex(variant => variant === value);
          if (variantIndex !== -1) {
            model.variants.splice(variantIndex, 1);
          }
        }
      }
    });
  };

  const handleAddNew = (type: string, path: string[]) => {
    console.log('🔄 Add New button clicked:', { type, path });
    setAdding({ type, path });
    setNewItemValue('');
  };

  const handleSaveNewItem = () => {
    if (!adding || !newItemValue.trim()) {
      setAdding(null);
      return;
    }

    const newValue = newItemValue.trim();
    console.log('🔄 Saving new item:', { type: adding.type, value: newValue, path: adding.path });

    handleUpdateData(draft => {
      if (adding.type === 'category') {
        if (draft[newValue]) {
          alert(`Category "${newValue}" already exists.`);
          return;
        }
        draft[newValue] = [];
      } else if (adding.type === 'make') {
        if (draft[adding.path[0]].some(m => m.name === newValue)) {
          alert(`Make "${newValue}" already exists.`);
          return;
        }
        draft[adding.path[0]].push({ name: newValue, models: [] });
      } else if (adding.type === 'model') {
        const make = draft[adding.path[0]].find(m => m.name === adding.path[1]);
        if (make) {
          if (make.models.some(m => m.name === newValue)) {
            alert(`Model "${newValue}" already exists.`);
            return;
          }
          make.models.push({ name: newValue, variants: [] });
        }
      } else if (adding.type === 'variant') {
        const model = draft[adding.path[0]].find(m => m.name === adding.path[1])?.models.find(mo => mo.name === adding.path[2]);
        if (model) {
          if (model.variants.includes(newValue)) {
            alert(`Variant "${newValue}" already exists.`);
            return;
          }
          model.variants.push(newValue);
        }
      }
    });

    console.log('✅ New item saved successfully');
    setAdding(null);
    setNewItemValue('');
  };

  const handleSelectCategory = (formattedCategory: string | null) => {
    if (!formattedCategory) {
      setSelectedCategory(null);
      setSelectedMake(null);
      setSelectedModel(null);
      return;
    }

    // Convert formatted category back to original key
    // Try exact match first, then normalized match
    let originalCategory = categories.find(cat => formatCategoryName(cat) === formattedCategory) || null;
    
    // If not found, try normalized comparison
    if (!originalCategory) {
      const normalizedFormatted = normalizeCategoryKey(formattedCategory);
      originalCategory = categories.find(cat => {
        const normalizedCat = normalizeCategoryKey(cat);
        const formattedCat = formatCategoryName(cat);
        return normalizedCat === normalizedFormatted || formattedCat === formattedCategory;
      }) || null;
    }

    // Validate that the category exists in vehicleData before setting
    if (originalCategory && vehicleData[originalCategory]) {
      setSelectedCategory(originalCategory);
      setSelectedMake(null);
      setSelectedModel(null);
    } else {
      // Category not found or invalid, clear selection
      setSelectedCategory(null);
      setSelectedMake(null);
      setSelectedModel(null);
    }
  };

  const handleSelectMake = (make: string | null) => {
    setSelectedMake(make);
    setSelectedModel(null);
  };

  const handleSelectModel = (model: string | null) => {
    setSelectedModel(model);
  };

  const renderColumn = (
    title: string,
    items: string[],
    path: string[],
    selectedItem: string | null,
    onSelect: (item: string | null) => void,
    type: string,
    disabled: boolean = false
  ) => {
    const isAdding = adding && adding.type === type.toLowerCase().slice(0, -1) && JSON.stringify(adding.path) === JSON.stringify(path);

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-300 ${disabled ? 'opacity-50' : 'hover:shadow-xl'}`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            {title}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {items.length} {title.toLowerCase()}
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {disabled ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Select an item from the previous column
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No {title.toLowerCase()} found
                  </p>
                </div>
              ) : (
                items.map(item => {
                  const isEditing = editing && editing.type === type.toLowerCase().slice(0, -1) && editing.originalValue === item;
                  const isSelected = selectedItem === item;

                  return (
                    <div
                      key={item}
                      className={`group relative p-3 rounded-lg border transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                          : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editing.value}
                            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                            className="flex-1 px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') setEditing(null);
                            }}
                          />
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-medium cursor-pointer transition-colors ${
                              isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                            }`}
                            onClick={() => onSelect(item)}
                          >
                            {item}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEdit(type.toLowerCase().slice(0, -1) as EditingState['type'], path, item)}
                              className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 rounded transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(type.toLowerCase().slice(0, -1) as EditingState['type'], path, item)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900 rounded transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Add New Item */}
              {isAdding ? (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newItemValue}
                      onChange={(e) => setNewItemValue(e.target.value)}
                      placeholder={`Add new ${type.toLowerCase().slice(0, -1)}`}
                      className="flex-1 px-3 py-2 border border-green-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveNewItem();
                        if (e.key === 'Escape') setAdding(null);
                      }}
                    />
                    <button
                      onClick={handleSaveNewItem}
                      className="px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setAdding(null)}
                      className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => handleAddNew(type.toLowerCase().slice(0, -1), path)}
                  className={`w-full p-3 border-2 border-dashed rounded-lg transition-all duration-200 ${
                    disabled
                      ? 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                  disabled={disabled}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span className="font-medium">
                      Add New {type.slice(0, -1)}
                    </span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manage Vehicle Data</h1>
            <p className="text-blue-100 text-lg">
              Manage dropdown options for the vehicle creation form
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onPreview}
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 backdrop-blur-sm border border-white/20"
            >
              📋 Show Seller Form Preview
            </button>
            <button
              onClick={onBulkUpload}
              className="bg-white hover:bg-gray-100 text-blue-600 px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              📤 Bulk Upload
            </button>
          </div>
        </div>
      </div>

      {/* Search and Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search vehicle data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <span className="font-medium">{categories.length}</span>
              <span>Categories</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{Object.values(vehicleData).flat().length}</span>
              <span>Makes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {Object.values(vehicleData).flat().reduce((acc, make: any) => acc + (make.models?.length || 0), 0)}
              </span>
              <span>Models</span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Management Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {renderColumn("Categories", filteredCategories.map(formatCategoryName), [], selectedCategory ? formatCategoryName(selectedCategory) : null, handleSelectCategory, "Categories")}
        {renderColumn("Makes", filteredMakes, selectedCategory ? [selectedCategory] : [], selectedMake, handleSelectMake, "Makes", !selectedCategory)}
        {renderColumn("Models", filteredModels, selectedCategory && selectedMake ? [selectedCategory, selectedMake] : [], selectedModel, handleSelectModel, "Models", !selectedMake)}
        {renderColumn("Variants", filteredVariants, selectedCategory && selectedMake && selectedModel ? [selectedCategory, selectedMake, selectedModel] : [], null, () => {}, "Variants", !selectedModel)}
      </div>
    </div>
  );
};

export default VehicleDataManagement;
