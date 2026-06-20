import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Vehicle } from '../types';
import { getSupabaseClient } from '../lib/supabase.js';
import {
  VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI,
  getSafeImageSrc,
} from '../utils/imageUtils';
import { 
  enhanceVehicleListing, 
  getListingImprovementSuggestions,
  isListingReadyToPublish,
  type ListingEnhancementResult 
} from '../services/listingEnhancementService';
import {
  clearChecklistPhotoByUrl,
  countAiReadyPhotos,
  extractChecklistGalleryUrls,
  getExtraGalleryImages,
  mergeListingImages,
} from '../lib/universalChecklist/mediaSync';

interface EditVehicleModalProps {
    vehicle: Vehicle;
    onClose: () => void;
    onSave: (vehicle: Vehicle) => void;
}

const EditVehicleModal: React.FC<EditVehicleModalProps> = ({ vehicle, onClose, onSave }) => {
    const [formData, setFormData] = useState<Vehicle>(vehicle);
    const [featureInput, setFeatureInput] = useState('');
    const [fixInput, setFixInput] = useState('');
    const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'media' | 'quality' | 'offer'>('basic');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [enhancementResult, setEnhancementResult] = useState<ListingEnhancementResult | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [showEnhancementSummary, setShowEnhancementSummary] = useState(false);
    const enhancementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (enhancementTimeoutRef.current) {
                clearTimeout(enhancementTimeoutRef.current);
            }
        };
    }, []);

    const getStrictPreviewImageSrc = (src: string): string => {
        const safe = getSafeImageSrc(src, VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI);
        if (!safe) return VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI;
        if (safe === VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI) return safe;
        if (safe.startsWith('blob:')) return safe;
        if (safe.startsWith('http://') || safe.startsWith('https://')) return safe;
        // Disallow arbitrary data URLs in editor previews; only our fixed placeholder is permitted.
        return VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI;
    };

    useEffect(() => {
        if (vehicle) {
            setFormData({
              ...vehicle,
              qualityReport: vehicle.qualityReport || { fixesDone: [] }
            });
        }
    }, [vehicle]);

    // Convert storage paths to public URLs for display
    const displayImages = useMemo(() => {
        if (!formData.images || formData.images.length === 0) return [];
        
        try {
            const supabase = getSupabaseClient();
            return formData.images.map((image) => {
                // If already a full URL, return as-is
                if (image && (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('data:'))) {
                    return image;
                }
                
                // If it's a storage path, convert to public URL
                if (image && typeof image === 'string' && image.trim() !== '') {
                    let filePath = image.trim();
                    
                    // Ensure path has proper format
                    if (!filePath.includes('/')) {
                        filePath = `vehicles/${filePath}`;
                    }
                    
                    const { data } = supabase.storage
                        .from('Images')
                        .getPublicUrl(filePath);
                    
                    return data?.publicUrl || image;
                }
                
                return image;
            });
        } catch (error) {
            console.error('Error converting image URLs:', error);
            return formData.images; // Return original on error
        }
    }, [formData.images]);

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
        const target = e.target;
        const { name } = target;
        const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
        
        // For numeric fields, store as string during editing, parse only on blur or submit
        setFormData(prev => ({ ...prev, [name]: value } as Vehicle));
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
        setFormData((prev) => {
            const clearedChecklist = clearChecklistPhotoByUrl(prev.sellerDisclosureChecklist, urlToRemove);
            const checklistUrls = extractChecklistGalleryUrls(clearedChecklist);
            const extras = getExtraGalleryImages(
                clearedChecklist,
                (prev.images || []).filter((url) => url !== urlToRemove),
            );
            return {
                ...prev,
                sellerDisclosureChecklist: clearedChecklist,
                images: mergeListingImages(checklistUrls, extras),
            };
        });
    };

    const aiReadyPhotoCount = countAiReadyPhotos(formData.sellerDisclosureChecklist);

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
        setIsEnhancing(true);
        
        try {
            // Run enhancement pipeline (validation + AI inspection + quality scoring)
            const result = await enhanceVehicleListing(formData, {
                runValidation: true,
                runAIInspection: false,
                checkPhotoQuality: true,
                calculateListingScore: true,
            });
            
            setEnhancementResult(result);
            setIsEnhancing(false);
            
            if (!result.success) {
                // Show validation errors
                const newErrors: Record<string, string> = {};
                result.validation.errors.forEach(err => {
                    newErrors[err.field] = err.message;
                });
                setErrors(newErrors);
                setIsSubmitting(false);
                return;
            }
            
            // Show enhancement summary briefly if there are enhancements
            if (result.enhancements.length > 0) {
                setShowEnhancementSummary(true);
                if (enhancementTimeoutRef.current) {
                    clearTimeout(enhancementTimeoutRef.current);
                }
                enhancementTimeoutRef.current = setTimeout(async () => {
                    enhancementTimeoutRef.current = null;
                    setShowEnhancementSummary(false);
                    await onSave(result.vehicle);
                    setIsSubmitting(false);
                }, 2000);
            } else {
                await onSave(result.vehicle);
                setIsSubmitting(false);
            }
        } catch (error) {
            console.error('Enhancement/save error:', error);
            // Fallback to direct save if enhancement fails
            await onSave(formData);
            setIsSubmitting(false);
        }
    };
    
    // Get listing readiness info
    const listingReadiness = useMemo(() => isListingReadyToPublish(formData), [formData]);
    const improvementSuggestions = useMemo(() => {
        const validation = { isValid: true, errors: [], warnings: [] };
        return getListingImprovementSuggestions(formData, validation);
    }, [formData]);

    if (!vehicle) return null;

    const FormInput = ({ label, name, type = 'text', value, required = false, placeholder }: { label: string, name: keyof Vehicle | string, type?: string, value: any, required?: boolean, placeholder?: string }) => (
        <div>
            <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">
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
                className={`mt-1 block w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-transparent transition-all duration-200 ${
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

    type TabId = 'basic' | 'specs' | 'media' | 'quality' | 'offer';
    const TabButton = ({ tab, label, icon }: { tab: TabId; label: string; icon: string }) => (
        <button
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                activeTab === tab
                    ? 'bg-reride-orange text-white shadow-md'
                    : 'text-reride-text-dark dark:text-reride-text-dark hover:bg-gray-100 dark:hover:bg-gray-700'
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
                    <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-reride-orange to-reride-blue">
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
                        <TabButton tab="offer" label="Listing Offer" icon="🎁" />
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'basic' && (
                            <div className="space-y-6">
                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-4 flex items-center gap-2">
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
                                    <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>🛡️</span> Insurance Details
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormInput label="Insurance Validity" name="insuranceValidity" value={formData.insuranceValidity} placeholder="Aug 2027" />
                                        <div>
                                            <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Insurance Type</label>
                                            <select 
                                                name="insuranceType" 
                                                value={formData.insuranceType} 
                                                onChange={handleChange} 
                                                className="mt-1 block w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-transparent"
                                            >
                                                <option value="">Select insurance type</option>
                                                <option value="Third Party">Third Party</option>
                                                <option value="Comprehensive">Comprehensive</option>
                                                <option value="Expired">Expired</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Vahan Verification Details */}
                                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-gray-800 dark:to-gray-800 p-6 rounded-lg border border-purple-200 dark:border-purple-700">
                                    <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-2 flex items-center gap-2">
                                        <span>🔐</span> Vahan Verification Details
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                                        Provide these details for Vahan verification. This helps buyers verify your vehicle's authenticity.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                                Registration Number <span className="text-red-500">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                name="registrationNumber" 
                                                value={formData.registrationNumber || ''} 
                                                onChange={handleChange}
                                                placeholder="e.g., MH12AB1234"
                                                className="mt-1 block w-full px-3 py-2 border border-purple-200 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                                                style={{ textTransform: 'uppercase' }}
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Full registration number as on RC</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                                Engine Number <span className="text-red-500">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                name="engineNumber" 
                                                value={formData.engineNumber || ''} 
                                                onChange={handleChange}
                                                placeholder="e.g., K12MN1234567"
                                                className="mt-1 block w-full px-3 py-2 border border-purple-200 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                                                style={{ textTransform: 'uppercase' }}
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Engine number from RC book</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                                Chassis Number <span className="text-red-500">*</span>
                                            </label>
                                            <input 
                                                type="text" 
                                                name="chassisNumber" 
                                                value={formData.chassisNumber || ''} 
                                                onChange={handleChange}
                                                placeholder="e.g., MA3EJKD1S00A06535"
                                                className="mt-1 block w-full px-3 py-2 border border-purple-200 dark:border-purple-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                                                style={{ textTransform: 'uppercase' }}
                                            />
                                            <p className="mt-1 text-xs text-gray-500">Chassis number from RC book</p>
                                        </div>
                                    </div>
                                    {formData.vahanVerifiedAt && (
                                        <div className="mt-4 flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-sm font-medium">
                                                Verified with Vahan on {new Date(formData.vahanVerifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    {!formData.vahanVerifiedAt && formData.registrationNumber && formData.engineNumber && formData.chassisNumber && (
                                        <div className="mt-4 flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            <span className="text-sm font-medium">
                                                Verification pending - Details will be verified with Vahan
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>📝</span> Description
                                    </h3>
                                    <div>
                                        <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">Vehicle Description</label>
                                        <textarea 
                                            name="description" 
                                            value={formData.description} 
                                            onChange={handleChange} 
                                            rows={4} 
                                            placeholder="Describe the vehicle's condition, history, and key selling points..."
                                            className="block w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-transparent resize-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'specs' && (
                            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-6 flex items-center gap-2">
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
                                    <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>📷</span> Vehicle Images
                                    </h3>
                                    
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
                                        Mandatory photos are managed in the disclosure checklist when creating/editing via the seller dashboard.
                                        {aiReadyPhotoCount > 0 && (
                                            <span className="block mt-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                                {aiReadyPhotoCount}/6 checklist angles on file
                                            </span>
                                        )}
                                    </p>

                                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-reride-orange transition-colors">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-12 h-12 bg-reride-orange/10 rounded-full flex items-center justify-center">
                                                <span className="text-2xl">📸</span>
                                            </div>
                                            <div>
                                                <label htmlFor="file-upload" className="cursor-pointer">
                                                    <span className="text-lg font-medium text-reride-orange hover:text-reride-blue transition-colors">
                                                        Add extra images
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
                                            <p className="text-sm font-medium text-reride-text-dark dark:text-white mb-3">
                                                Uploaded Images ({formData.images.length})
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                                                {formData.images.map((url, index) => {
                                                    const displayUrl = displayImages[index] || url;
                                                    return (
                                                        <div key={index} className="relative group">
                                                            <img
                                                                src={getStrictPreviewImageSrc(displayUrl)}
                                                                className="w-full h-20 object-cover rounded-lg shadow-sm" 
                                                                alt={`Vehicle image ${index + 1}`}
                                                                onError={(e) => {
                                                                    // Fallback to placeholder if image fails to load
                                                                    const target = e.target as HTMLImageElement;
                                                                    target.src = VEHICLE_SMALL_CARD_PLACEHOLDER_DATA_URI;
                                                                }}
                                                            />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleRemoveImageUrl(url)} 
                                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                                    <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-4 flex items-center gap-2">
                                        <span>⭐</span> Key Features
                                    </h3>
                                    <div className="flex gap-2 mb-4">
                                        <input 
                                            type="text" 
                                            value={featureInput} 
                                            onChange={(e) => setFeatureInput(e.target.value)} 
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }} 
                                            placeholder="e.g., Sunroof, Leather Seats, Navigation System" 
                                            className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-transparent" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleAddFeature} 
                                            className="px-4 py-2 bg-reride-orange text-white rounded-lg hover:bg-reride-orange/90 transition-colors font-medium"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {formData.features.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {formData.features.map(feature => (
                                                <span 
                                                    key={feature} 
                                                    className="bg-reride-orange/10 text-reride-orange text-sm font-medium px-3 py-1 rounded-full flex items-center gap-2 border border-reride-orange/20"
                                                >
                                                    {feature}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleRemoveFeature(feature)} 
                                                        className="text-reride-orange hover:text-red-500 transition-colors"
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
                                <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-6 flex items-center gap-2">
                                    <span>✅</span> Quality Report
                                </h3>
                                <div className="space-y-6">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Tip: edit the overall condition and history in the <span className="font-semibold">Vehicle Description</span> on the Basic Info tab. Use this section to highlight specific fixes and upgrades.
                                    </p>
                                    <div>
                                        <label className="block text-sm font-medium text-reride-text-dark dark:text-white mb-1">
                                            Fixes Done / Upgrades
                                        </label>
                                        <div className="flex gap-2 mb-4">
                                            <input 
                                                type="text" 
                                                value={fixInput} 
                                                onChange={(e) => setFixInput(e.target.value)} 
                                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFix(); } }} 
                                                placeholder="e.g., New tires, Brake pads replaced, AC service" 
                                                className="flex-grow px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-reride-text-dark dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-reride-orange focus:border-transparent" 
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

                        {activeTab === 'offer' && (
                            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg space-y-4">
                                <h3 className="text-lg font-semibold text-reride-text-dark dark:text-white mb-2 flex items-center gap-2">
                                    <span>🎁</span> Listing offer
                                </h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Shown on the vehicle page when enabled, dates are valid, and at least one text line is filled.
                                </p>
                                <div className="flex items-center gap-3">
                                    <input
                                        id="edit-offer-enabled"
                                        type="checkbox"
                                        name="offerEnabled"
                                        checked={!!formData.offerEnabled}
                                        onChange={handleChange}
                                        className="h-5 w-5 rounded border-gray-300"
                                    />
                                    <label htmlFor="edit-offer-enabled" className="text-sm font-medium text-reride-text-dark dark:text-white cursor-pointer">
                                        Enable offer for this listing
                                    </label>
                                </div>
                                <div className={`space-y-4 pt-2 ${formData.offerEnabled ? '' : 'opacity-50 pointer-events-none'}`}>
                                    <FormInput label="Headline" name="offerTitle" value={formData.offerTitle ?? ''} placeholder="e.g. Special offer" />
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormInput label="Start date" name="offerStartDate" type="date" value={formData.offerStartDate ?? ''} />
                                        <FormInput label="End date" name="offerEndDate" type="date" value={formData.offerEndDate ?? ''} />
                                    </div>
                                    <FormInput
                                        label="Date label (optional)"
                                        name="offerDateLabel"
                                        value={formData.offerDateLabel ?? ''}
                                        placeholder="e.g. 8 - 31 DEC"
                                    />
                                    <FormInput
                                        label="Description line"
                                        name="offerDescription"
                                        value={formData.offerDescription ?? ''}
                                        placeholder="e.g. Loan offers on all cars"
                                    />
                                    <FormInput
                                        label="Highlight line"
                                        name="offerHighlight"
                                        value={formData.offerHighlight ?? ''}
                                        placeholder="e.g. ROI starting from 10.5%*"
                                    />
                                    <FormInput
                                        label="Disclaimer (small text)"
                                        name="offerDisclaimer"
                                        value={formData.offerDisclaimer ?? ''}
                                        placeholder="Terms and conditions apply"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Enhancement Summary Overlay */}
                    {showEnhancementSummary && enhancementResult && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-xl">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-xl max-w-md mx-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 dark:text-white">Listing Enhanced</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Quality Score: {listingReadiness.qualityScore}/100</p>
                                    </div>
                                </div>
                                {enhancementResult.enhancements.length > 0 && (
                                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                                        {enhancementResult.enhancements.slice(0, 4).map((e, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-green-500 mt-0.5">✓</span>
                                                <span>{e}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                                    <div className="w-4 h-4 border-2 border-reride-orange border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Sticky Footer */}
                    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-4">
                        {/* Quality Score & Suggestions Row */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                                {/* Quality Score */}
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Listing Quality:</span>
                                    <div className="flex items-center gap-1">
                                        <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all ${
                                                    listingReadiness.qualityScore >= 70 ? 'bg-green-500' :
                                                    listingReadiness.qualityScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${listingReadiness.qualityScore}%` }}
                                            />
                                        </div>
                                        <span className={`text-xs font-medium ${
                                            listingReadiness.qualityScore >= 70 ? 'text-green-600' :
                                            listingReadiness.qualityScore >= 40 ? 'text-yellow-600' : 'text-red-600'
                                        }`}>
                                            {listingReadiness.qualityScore}/100
                                        </span>
                                    </div>
                                </div>
                                {/* Missing Fields */}
                                {!listingReadiness.ready && (
                                    <span className="text-xs text-red-500">
                                        Missing: {listingReadiness.missingFields.join(', ')}
                                    </span>
                                )}
                            </div>
                            {/* AI Inspection Badge */}
                            {formData.images && formData.images.length >= 4 && (
                                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    AI Inspection will run on save
                                </div>
                            )}
                        </div>
                        
                        {/* Improvement Suggestions */}
                        {improvementSuggestions.length > 0 && (
                            <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Tip: {improvementSuggestions[0]}
                                </p>
                            </div>
                        )}
                        
                        {/* Action Buttons Row */}
                        <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                                {Object.keys(errors).length > 0 && (
                                    <span className="text-red-500">Please fix {Object.keys(errors).length} error(s) before saving</span>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-reride-text-dark dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSubmitting || Object.keys(errors).length > 0 || !listingReadiness.ready}
                                    className="px-6 py-2 bg-reride-orange text-white rounded-lg hover:bg-reride-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            {isEnhancing ? 'Analyzing...' : 'Saving...'}
                                        </>
                                    ) : (
                                        <>
                                            Save Changes
                                            {formData.images && formData.images.length >= 4 && (
                                                <span className="text-xs opacity-75">+ AI</span>
                                            )}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditVehicleModal;