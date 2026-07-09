import React, { useState, useMemo } from 'react';
import { VehicleData } from '../types';
import { VehicleCategory } from '../types';
import { ModalBackdrop } from './primitives/Pressable';

interface SellerFormPreviewProps {
  vehicleData: VehicleData;
  onClose: () => void;
}

const SellerFormPreview: React.FC<SellerFormPreviewProps> = ({ vehicleData, onClose }) => {
  const [formData, setFormData] = useState({
    category: '',
    make: '',
    model: '',
    variant: '',
    year: 2024,
    registrationYear: 2024,
    price: 0,
    mileage: 0,
    noOfOwners: 1
  });

  const availableMakes = useMemo(() => {
    if (!formData.category || !vehicleData[formData.category]) return [];
    return vehicleData[formData.category].map(make => make.name).sort();
  }, [formData.category, vehicleData]);

  const availableModels = useMemo(() => {
    if (!formData.category || !formData.make || !vehicleData[formData.category]) return [];
    const makeData = vehicleData[formData.category].find(m => m.name === formData.make);
    return makeData ? makeData.models.map(model => model.name).sort() : [];
  }, [formData.category, formData.make, vehicleData]);

  const availableVariants = useMemo(() => {
    if (!formData.category || !formData.make || !formData.model || !vehicleData[formData.category]) return [];
    const makeData = vehicleData[formData.category].find(m => m.name === formData.make);
    const modelData = makeData?.models.find(m => m.name === formData.model);
    return modelData ? [...modelData.variants].sort() : [];
  }, [formData.category, formData.make, formData.model, vehicleData]);

  const hasVehicleData = useMemo(() => {
    return formData.category && vehicleData[formData.category] && vehicleData[formData.category].length > 0;
  }, [formData.category, vehicleData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const numericFields = ['year', 'registrationYear', 'price', 'mileage', 'noOfOwners'];
    const parsedValue = numericFields.includes(name) ? parseInt(value) || 0 : value;
    
    setFormData(prev => {
      const newData = { ...prev, [name]: parsedValue };
      
      // Reset dependent fields when parent changes
      if (name === 'category') {
        newData.make = '';
        newData.model = '';
        newData.variant = '';
      } else if (name === 'make') {
        newData.model = '';
        newData.variant = '';
      } else if (name === 'model') {
        newData.variant = '';
      }
      
      return newData;
    });
  };

  return (
    <ModalBackdrop onClose={onClose} className="fixed inset-0 flex items-center justify-center z-50 p-4" backdropClassName="absolute inset-0 bg-black/60">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-700 p-6 rounded-t-2xl text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">📋 Seller Form Preview</h2>
              <p className="text-green-100">Live preview of how vehicle data appears in seller forms</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-green-200 text-3xl font-bold transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Admin Managed Badge */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-700 dark:text-green-300 font-semibold">Admin Managed</span>
              </div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="font-semibold">Auto-fill with AI</span>
              </div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date().toLocaleDateString()}
            </div>
          </div>

          {/* Form Preview */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
              <span>🚗</span> Vehicle Overview
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Enter core details about your vehicle.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select Category</option>
                  {Object.keys(vehicleData).map(category => (
                    <option key={category} value={category}>
                      {category.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Make */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Make <span className="text-red-500">*</span>
                </label>
                <select
                  name="make"
                  value={formData.make}
                  onChange={handleChange}
                  disabled={!formData.category}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500"
                >
                  <option value="">Select Make</option>
                  {availableMakes.map(make => (
                    <option key={make} value={make}>
                      {make}
                    </option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model <span className="text-red-500">*</span>
                </label>
                <select
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  disabled={!formData.make}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500"
                >
                  <option value="">Select Model</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Variant
                </label>
                <select
                  name="variant"
                  value={formData.variant}
                  onChange={handleChange}
                  disabled={!formData.model}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:text-gray-500"
                >
                  <option value="">Select Variant (Optional)</option>
                  {availableVariants.map(variant => (
                    <option key={variant} value={variant}>
                      {variant}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Make Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Registration Year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Registration Year
                </label>
                <input
                  type="number"
                  name="registrationYear"
                  value={formData.registrationYear}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <div className="flex items-center gap-2 mt-2">
                  <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    Get AI Price Suggestion
                  </a>
                </div>
              </div>

              {/* Mileage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Km Driven
                </label>
                <input
                  type="number"
                  name="mileage"
                  value={formData.mileage}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* No. of Owners */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  No. of Owners
                </label>
                <input
                  type="number"
                  name="noOfOwners"
                  value={formData.noOfOwners}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Data Status */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                  {hasVehicleData ? 'Admin Managed Data Active' : 'Using Default Data'}
                </h4>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  {hasVehicleData 
                    ? `Sellers will see ${availableMakes.length} makes, ${availableModels.length} models, and ${availableVariants.length} variants for the selected category.`
                    : 'No admin-managed data available for this category. Sellers will see default options.'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalBackdrop>
  );
};

export default SellerFormPreview;
