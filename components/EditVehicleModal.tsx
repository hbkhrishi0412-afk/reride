import React, { useState, useEffect } from 'react';
import type { Vehicle } from '../types';

interface EditVehicleModalProps {
    vehicle: Vehicle;
    onClose: () => void;
    onSave: (vehicle: Vehicle) => void;
}

const EditVehicleModal: React.FC<EditVehicleModalProps> = ({ vehicle, onClose, onSave }) => {
    const [formData, setFormData] = useState<Vehicle>(vehicle);
    const [featureInput, setFeatureInput] = useState('');
    const [fixInput, setFixInput] = useState('');
    const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'media' | 'quality'>('basic');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (vehicle) {
            setFormData({
              ...vehicle,
              qualityReport: vehicle.qualityReport || { summary: '', fixesDone: [] }
            });
        }
    }, [vehicle]);

    const validateField = (name: string, value: any): string => {
        switch (name) {
            case 'make':
            case 'model':
                return !value || value.trim() === '' ? `${name.charAt(0).toUpperCase() + name.slice(1)} is required` : '';
            case 'year':
                return !value || value < 1900 || value > new Date().getFullYear() + 1 ? 'Please enter a valid year' : '';
            case 'price':
                return !value || value <= 0 ? 'Price must be greater than 0' : '';
            case 'mileage':
                return !value || value < 0 ? 'Mileage cannot be negative' : '';
            default:
                return '';
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        
        // For numeric fields, store as string during editing, parse only on blur or submit
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numericFields = ['year', 'price', 'mileage', 'registrationYear', 'noOfOwners'];
        
        // Parse numeric fields only when user finishes editing
        if (numericFields.includes(name)) {
            const parsedValue = value === '' ? 0 : (name === 'price' ? parseFloat(value) : parseInt(value, 10));
            if (!isNaN(parsedValue)) {
                setFormData(prev => ({ ...prev, [name]: parsedValue }));
            }
        }
    };

    const handleQualityReportChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            qualityReport: {
                ...(prev.qualityReport!),
                [name]: value,
            },
        }));
    };

    const handleAddFeature = () => {
        if (featureInput.trim() && !formData.features.includes(featureInput.trim())) {
            setFormData(prev => ({ ...prev, features: [...prev.features, featureInput.trim()] }));
            setFeatureInput('');
        }
    };
  
    const handleRemoveFeature = (featureToRemove: string) => {
        setFormData(prev => ({ ...prev, features: prev.features.filter(f => f !== featureToRemove) }));
    };

    const handleAddFix = () => {
        if (fixInput.trim() && !formData.qualityReport?.fixesDone.includes(fixInput.trim())) {
            setFormData(prev => ({
                ...prev,
                qualityReport: {
                    summary: prev.qualityReport?.summary || '',
                    fixesDone: [...(prev.qualityReport?.fixesDone || []), fixInput.trim()]
                }
            }));
            setFixInput('');
        }
    };

    const handleRemoveFix = (fixToRemove: string) => {
        setFormData(prev => ({
            ...prev,
            qualityReport: {
                summary: prev.qualityReport?.summary || '',
                fixesDone: (prev.qualityReport?.fixesDone || []).filter(f => f !== fixToRemove)
            }
        }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        
        const files = Array.from(e.target.files);
        const input = e.target;
        
        try {
            // Use the same upload service as Dashboard for consistency
            const { uploadImages, validateImageFile } = await import('../services/imageUploadService');
            
            // Validate all files first
            for (const file of files) {
                const validation = validateImageFile(file);
                if (!validation.valid) {
                    alert(validation.error || 'Invalid image file');
                    if (input) input.value = '';
                    return;
                }
            }
            
            // Upload images using the service (resizes and stores in database)
            // Pass seller email from vehicle for ownership tracking
            const uploadResults = await uploadImages(files, 'vehicles', vehicle.sellerEmail);
            
            // Check for upload errors
            const failedUploads = uploadResults.filter(r => !r.success);
            if (failedUploads.length > 0) {
                const errorMessage = failedUploads.map(r => r.error).join(', ');
                alert(`Failed to upload ${failedUploads.length} file(s): ${errorMessage}`);
                if (input) input.value = '';
                return;
            }
            
            // Get successful upload URLs (base64 data URLs)
            const successfulUrls = uploadResults
                .filter(r => r.success && r.url)
                .map(r => r.url!);
            
            if (successfulUrls.length > 0) {
                // Limit total images to prevent vehicle object from becoming too large
                const currentImages = formData.images || [];
                const maxImages = 10;
                const remainingSlots = maxImages - currentImages.length;
                
                if (remainingSlots <= 0) {
                    alert(`Maximum ${maxImages} images allowed per vehicle. Please remove some images before adding more.`);
                    if (input) input.value = '';
                    return;
                }
                
                const imagesToAdd = successfulUrls.slice(0, remainingSlots);
                if (successfulUrls.length > remainingSlots) {
                    alert(`Only ${remainingSlots} image(s) added. Maximum ${maxImages} images allowed per vehicle.`);
                }
                
                setFormData(prev => ({ ...prev, images: [...(prev.images || []), ...imagesToAdd] }));
            }
        } catch (error) {
            console.error('Error uploading images:', error);
            alert('Failed to upload images. Please try again.');
        } finally {
            if (input) input.value = '';
        }
    };

    const handleRemoveImageUrl = (urlToRemove: string) => {
        setFormData(prev => ({...prev, images: (prev.images || []).filter(url => url !== urlToRemove)}));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};
        
        // Validate required fields
        const requiredFields = ['make', 'model', 'year', 'price', 'mileage'];
        requiredFields.forEach(field => {
            const error = validateField(field, formData[field as keyof Vehicle]);
            if (error) newErrors[field] = error;
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        try {
            await onSave(formData);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!vehicle) return null;

    const FormInput = ({ label, name, type = 'text', value, required = false, placeholder }: { label: string, name: keyof Vehicle | string, type?: string, value: any, required?: boolean, placeholder?: string }) => (
        <div>
            <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">
                {label}
                {required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input 
                type={type} 
                name={name as string} 
                value={value} 
                onChange={handleChange} 
                onBlur={handleBlur}
                required={required}
                placeholder={placeholder}
                className={`mt-1 block w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent transition-all duration-200 ${
                    errors[name as string] 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
            />
            {errors[name as string] && (
                <p className="mt-1 text-sm text-red-500">{errors[name as string]}</p>
            )}
        </div>
    );

    const TabButton = ({ tab, label, icon }: { tab: string, label: string, icon: string }) => (
        <button
            type="button"
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab
                    ? 'bg-spinny-orange text-white shadow-md'
                    : 'text-spinny-text-dark dark:text-spinny-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
            <span>{icon}</span>
            <span>{label}</span>
        </button>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <form onSubmit={handleSubmit} className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-spinny-orange to-spinny-blue">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Edit Vehicle</h2>
                            <p className="text-white/90 text-sm">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                        </div>
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="text-white hover:text-white/80 text-2xl transition-colors"
                        >
                            ×
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-2 p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <TabButton tab="basic" label="Basic Info" icon="🚗" />
                        <TabButton tab="specs" label="Specifications" icon="⚙️" />
                        <TabButton tab="media" label="Media & Features" icon="📷" />
                        <TabButton tab="quality" label="Quality Report" icon="✅" />
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'basic' && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>📋</span> Core Details
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <FormInput label="Make" name="make" value={formData.make} required placeholder="e.g., Maruti Suzuki" />
                                        <FormInput label="Model" name="model" value={formData.model} required placeholder="e.g., Swift" />
                                        <FormInput label="Year" name="year" type="number" value={formData.year} required placeholder="2024" />
                                        <FormInput label="Price (₹)" name="price" type="number" value={formData.price} required placeholder="2340000" />
                                        <FormInput label="Mileage (kms)" name="mileage" type="number" value={formData.mileage} required placeholder="36916" />
                                        <FormInput label="Color" name="color" value={formData.color} placeholder="White" />
                                        <FormInput label="Registration Year" name="registrationYear" type="number" value={formData.registrationYear} placeholder="2024" />
                                        <FormInput label="No. of Owners" name="noOfOwners" type="number" value={formData.noOfOwners} placeholder="1" />
                                        <FormInput label="RTO" name="rto" value={formData.rto} placeholder="LA04" />
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>🛡️</span> Insurance Details
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormInput label="Insurance Validity" name="insuranceValidity" value={formData.insuranceValidity} placeholder="Aug 2027" />
                                        <div>
                                            <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Insurance Type</label>
                                            <select 
                                                name="insuranceType" 
                                                value={formData.insuranceType} 
                                                onChange={handleChange} 
                                                className="mt-1 block w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent"
                                            >
                                                <option value="">Select insurance type</option>
                                                <option value="Third Party">Third Party</option>
                                                <option value="Comprehensive">Comprehensive</option>
                                                <option value="Expired">Expired</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>📝</span> Description
                                    </h3>
                                    <div>
                                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">Vehicle Description</label>
                                        <textarea 
                                            name="description" 
                                            value={formData.description} 
                                            onChange={handleChange} 
                                            rows={4} 
                                            placeholder="Describe the vehicle's condition, history, and key selling points..."
                                            className="block w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'specs' && (
                            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-6 flex items-center gap-2">
                                    <span>⚙️</span> Technical Specifications
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormInput label="Engine" name="engine" value={formData.engine} placeholder="2.3L Diesel" />
                                    <FormInput label="Transmission" name="transmission" value={formData.transmission} placeholder="DCT" />
                                    <FormInput label="Fuel Type" name="fuelType" value={formData.fuelType} placeholder="CNG" />
                                    <FormInput label="Fuel Efficiency" name="fuelEfficiency" value={formData.fuelEfficiency} placeholder="25 KMPL" />
                                    <FormInput label="Displacement (cc)" name="displacement" value={formData.displacement} placeholder="2393" />
                                    <FormInput label="Ground Clearance (mm)" name="groundClearance" value={formData.groundClearance} placeholder="170" />
                                    <FormInput label="Boot Space (litres)" name="bootSpace" value={formData.bootSpace} placeholder="300" />
                                </div>
                            </div>
                        )}

                        {activeTab === 'media' && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>📷</span> Vehicle Images
                                    </h3>
                                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-spinny-orange transition-colors">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 bg-spinny-orange/10 rounded-full flex items-center justify-center">
                                                <span className="text-2xl">📸</span>
                                            </div>
                                            <div>
                                                <label htmlFor="file-upload" className="cursor-pointer">
                                                    <span className="text-lg font-medium text-spinny-orange hover:text-spinny-blue transition-colors">
                                                        Click to upload images
                                                    </span>
                                                    <input 
                                                        id="file-upload" 
                                                        name="file-upload" 
                                                        type="file" 
                                                        className="sr-only" 
                                                        multiple 
                                                        accept="image/*" 
                                                        onChange={handleImageUpload} 
                                                    />
                                                </label>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    PNG, JPG, GIF up to 10MB each
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    {formData.images.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-sm font-medium text-spinny-text-dark dark:text-white mb-3">
                                                Uploaded Images ({formData.images.length})
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {formData.images.map((url, index) => (
                                                    <div key={index} className="relative group">
                                                        <img 
                                                            src={url} 
                                                            className="w-full h-20 object-cover rounded-lg shadow-sm" 
                                                            alt={`Vehicle image ${index + 1}`} 
                                                        />
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveImageUrl(url)} 
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>⭐</span> Key Features
                                    </h3>
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            type="text" 
                                            value={featureInput} 
                                            onChange={(e) => setFeatureInput(e.target.value)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }} 
                                            placeholder="e.g., Sunroof, Leather Seats, Navigation System" 
                                            className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleAddFeature} 
                                            className="px-4 py-2 bg-spinny-orange text-white rounded-lg hover:bg-spinny-orange/90 transition-colors font-medium"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {formData.features.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {formData.features.map(feature => (
                                                <span 
                                                    key={feature} 
                                                    className="bg-spinny-orange/10 text-spinny-orange text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2 border border-spinny-orange/20"
                                                >
                                                    {feature}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleRemoveFeature(feature)} 
                                                        className="text-spinny-orange hover:text-red-500 transition-colors"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'quality' && (
                            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold text-spinny-text-dark dark:text-white mb-6 flex items-center gap-2">
                                    <span>✅</span> Quality Report
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">
                                            Quality Summary
                                        </label>
                                        <textarea 
                                            name="summary" 
                                            value={formData.qualityReport?.summary} 
                                            onChange={handleQualityReportChange} 
                                            rows={4} 
                                            placeholder="Describe the overall condition and quality of the vehicle..."
                                            className="block w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-white mb-1">
                                            Fixes Done / Upgrades
                                        </label>
                                        <div className="flex gap-2 mb-4">
                                            <input 
                                                type="text" 
                                                value={fixInput} 
                                                onChange={(e) => setFixInput(e.target.value)} 
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFix(); } }} 
                                                placeholder="e.g., New tires, Brake pads replaced, AC service" 
                                                className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-spinny-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-spinny-orange focus:border-transparent" 
                                            />
                                            <button 
                                                type="button" 
                                                onClick={handleAddFix} 
                                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                                            >
                                                Add Fix
                                            </button>
                                        </div>
                                        {formData.qualityReport?.fixesDone && formData.qualityReport.fixesDone.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {formData.qualityReport.fixesDone.map(fix => (
                                                    <span 
                                                        key={fix} 
                                                        className="bg-green-100 text-green-700 text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2 border border-green-200"
                                                    >
                                                        {fix}
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleRemoveFix(fix)} 
                                                            className="text-green-700 hover:text-red-500 transition-colors"
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sticky Footer */}
                    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between items-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                            {Object.keys(errors).length > 0 && (
                                <span className="text-red-500">Please fix {Object.keys(errors).length} error(s) before saving</span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button 
                                type="button" 
                                onClick={onClose} 
                                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-spinny-text-dark dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting || Object.keys(errors).length > 0}
                                className="px-6 py-2 bg-spinny-orange text-white rounded-lg hover:bg-spinny-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditVehicleModal;