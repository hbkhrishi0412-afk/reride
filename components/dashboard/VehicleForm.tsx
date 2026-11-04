import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle, User, VehicleData } from '../../types';
import { VehicleCategory } from '../../types';
import { enhanceVehicleListing } from '../../services/listingEnhancementService';
import {
  buildVehicleDescription,
  VEHICLE_DESCRIPTION_MAX_LENGTH,
} from '../../utils/buildVehicleDescription';
import { getSafeImageSrc } from '../../utils/imageUtils';
import { logInfo } from '../../utils/logger.js';
import { CLIENT_POLL_INTERVALS_MS } from '../../utils/clientPolling.js';
import {
  clearChecklistPhotoByUrl,
  extractChecklistGalleryUrls,
  getExtraGalleryImages,
  MAX_LISTING_IMAGES,
  mergeListingImages,
  syncDocumentsFromChecklist,
} from '../../lib/universalChecklist/mediaSync';
import { verifyVahanRegistration, applyVahanVerifyToVehicleFields } from '../../services/vehicleTrustService';
import PricingGuidance from '../PricingGuidance';
import SellerDisclosureForm from '../SellerDisclosureForm';
import ListingTrustProgress from '../ListingTrustProgress';
import { dashboardNotify, type DashboardNotifyFn } from './notify';
import { initialFormState } from './initialFormState';
import { FormFieldset, FieldGroup } from './FormFieldset';
import { FormInput } from './FormInput';
import { ComboboxInput } from './ComboboxInput';
import {
  sellerPremiumGhostBtnStyle,
  sellerPremiumPrimaryBtnStyle,
} from '../seller-dashboard/SellerPremiumShell';

export interface VehicleFormProps {
    seller: User;
    editingVehicle: Vehicle | null;
    allVehicles: Vehicle[];
    onAddVehicle: (vehicle: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, isFeaturing: boolean) => void | Promise<void>;
    onUpdateVehicle: (vehicle: Vehicle) => void | Promise<void>;
    onFeatureListing: (vehicleId: number) => Promise<void>;
    onCancel: () => void;
    vehicleData: VehicleData;
    onNotify?: DashboardNotifyFn;
}

export const VehicleForm: React.FC<VehicleFormProps> = memo(({ editingVehicle, onAddVehicle, onUpdateVehicle, onCancel, vehicleData, seller, onFeatureListing: _onFeatureListing, allVehicles, onNotify }) => {
    void _onFeatureListing;
    const { t } = useTranslation();
    const notify = useCallback(
      (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') =>
        dashboardNotify(onNotify, message, type),
      [onNotify],
    );
    const [formData, setFormData] = useState(editingVehicle ? { 
        ...initialFormState, 
        ...editingVehicle, 
        sellerEmail: editingVehicle.sellerEmail,
        sellerName: editingVehicle.sellerName || seller.name || seller.dealershipName || 'Seller'
    } : { 
        ...initialFormState, 
        sellerEmail: seller.email,
        sellerName: seller.name || seller.dealershipName || 'Seller'
    });
    

    // Safety check for vehicleData
    const safeVehicleData = useMemo(() => {
        if (!vehicleData || Object.keys(vehicleData).length === 0) {
            console.warn('⚠️ VehicleData is empty or undefined, using fallback');
            // Use a minimal fallback structure
            return {
                'four-wheeler': [
                    { name: 'Maruti Suzuki', models: [{ name: 'Swift', variants: ['LXI', 'VXI', 'ZXI'] }] },
                    { name: 'Hyundai', models: [{ name: 'i20', variants: ['Magna', 'Sportz', 'Asta'] }] }
                ],
                'two-wheeler': [
                    { name: 'Honda', models: [{ name: 'Activa', variants: ['Standard', 'Deluxe'] }] },
                    { name: 'Bajaj', models: [{ name: 'Pulsar', variants: ['150', '180', '220'] }] }
                ]
            };
        }
        return vehicleData;
    }, [vehicleData]);
    
    // Location data state for this component
    const [indianStates, setIndianStates] = useState<Array<{name: string, code: string}>>([]);
    const [citiesByState, setCitiesByState] = useState<Record<string, string[]>>({});
    
    const [featureInput, setFeatureInput] = useState('');
    const [errors, setErrors] = useState<Partial<Record<keyof Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, string>>>({});
    type FormSection = 'details' | 'trust' | 'finish';
    const [activeSection, setActiveSection] = useState<FormSection>('details');
    // Real-time update state for expiry dates
    const [currentTime, setCurrentTime] = useState(new Date());
    // Keep description synced to overview/specs until the seller edits it manually.
    const descriptionManualRef = useRef(Boolean(editingVehicle?.description?.trim()));
    const lastAutoDescriptionRef = useRef('');
    
    // Real-time expiry date updates - update every minute (UI only, no API)
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, CLIENT_POLL_INTERVALS_MS.uiClock);

        return () => clearInterval(interval);
    }, []);
    const [isUploading, setIsUploading] = useState(false);
    const [previewImageIndex, setPreviewImageIndex] = useState(0);
    
    // Ensure seller email is always set in form data
    useEffect(() => {
        if (!formData.sellerEmail && seller.email) {
            setFormData(prev => ({ ...prev, sellerEmail: seller.email }));
        }
    }, [seller.email, formData.sellerEmail]);

    // Load location data when component mounts
    useEffect(() => {
        const loadLocationData = async () => {
            try {
                const { loadLocationData } = await import('../../utils/dataLoaders');
                const locationData = await loadLocationData();
                setIndianStates(locationData.INDIAN_STATES || []);
                setCitiesByState(locationData.CITIES_BY_STATE || {});
            } catch (error) {
                console.error('Failed to load location data:', error);
            }
        };
        loadLocationData();
    }, []);

    const autoDescription = useMemo(
      () => buildVehicleDescription(formData),
      [
        formData.make,
        formData.model,
        formData.variant,
        formData.year,
        formData.registrationYear,
        formData.mileage,
        formData.noOfOwners,
        formData.city,
        formData.state,
        formData.rto,
        formData.price,
        formData.transmission,
        formData.fuelType,
        formData.fuelEfficiency,
        formData.color,
        formData.insuranceType,
        formData.insuranceValidity,
        formData.features,
      ],
    );

    useEffect(() => {
      if (!autoDescription || descriptionManualRef.current) return;
      lastAutoDescriptionRef.current = autoDescription;
      setFormData((prev) =>
        prev.description === autoDescription ? prev : { ...prev, description: autoDescription },
      );
    }, [autoDescription]);

    const applyAutoDescription = useCallback(() => {
      if (!autoDescription) return;
      descriptionManualRef.current = false;
      lastAutoDescriptionRef.current = autoDescription;
      setFormData((prev) => ({ ...prev, description: autoDescription }));
    }, [autoDescription]);

    const availableMakes = useMemo(() => {
        try {
            if (!formData.category || !safeVehicleData || !safeVehicleData[formData.category]) {
                return [];
            }
            
            const categoryData = safeVehicleData[formData.category];
            if (!Array.isArray(categoryData)) {
                return [];
            }
            
            const makes = categoryData
                .map(make => make?.name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
                .sort();
            return makes;
        } catch (error) {
            console.error('Error calculating availableMakes:', error);
            return [];
        }
    }, [formData.category, safeVehicleData]);

    const availableModels = useMemo(() => {
        try {
            if (!formData.category || !formData.make || !safeVehicleData || !safeVehicleData[formData.category]) {
                return [];
            }
            
            const categoryData = safeVehicleData[formData.category];
            if (!Array.isArray(categoryData)) {
                return [];
            }
            
            const makeData = categoryData.find(m => m?.name === formData.make);
            if (!makeData || !Array.isArray(makeData.models)) {
                return [];
            }
            
            return makeData.models
                .map(model => model?.name)
                .filter((name): name is string => typeof name === 'string' && name.length > 0)
                .sort();
        } catch (error) {
            console.error('Error calculating availableModels:', error);
            return [];
        }
    }, [formData.category, formData.make, safeVehicleData]);

    const availableVariants = useMemo(() => {
        try {
            if (!formData.category || !formData.make || !formData.model || !safeVehicleData || !safeVehicleData[formData.category]) {
                return [];
            }
            
            const categoryData = safeVehicleData[formData.category];
            if (!Array.isArray(categoryData)) {
                return [];
            }
            
            const makeData = categoryData.find(m => m?.name === formData.make);
            if (!makeData || !Array.isArray(makeData.models)) {
                return [];
            }
            
            const modelData = makeData.models.find(m => m?.name === formData.model);
            if (!modelData || !Array.isArray(modelData.variants)) {
                return [];
            }
            
            return modelData.variants
                .filter((variant): variant is string => typeof variant === 'string' && variant.length > 0)
                .sort();
        } catch (error) {
            console.error('Error calculating availableVariants:', error);
            return [];
        }
    }, [formData.category, formData.make, formData.model, safeVehicleData]);

    const availableCities = useMemo(() => {
        if (!formData.state || !citiesByState || !citiesByState[formData.state]) return [];
        return citiesByState[formData.state].sort();
    }, [formData.state, citiesByState]);

    // Check if vehicle data is available for the selected category
    const hasVehicleData = useMemo(() => {
        return formData.category && vehicleData[formData.category] && vehicleData[formData.category].length > 0;
    }, [formData.category, vehicleData]);

    const validateField = (name: keyof Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>, value: any): string => {
      switch(name) {
          case 'make': case 'model': return value.trim().length < 2 ? `${name} must be at least 2 characters long.` : '';
          case 'year': {
              const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
              return isNaN(numValue) || numValue < 1900 || numValue > new Date().getFullYear() + 1 ? 'Please enter a valid year.' : '';
          }
          case 'price': {
              const numValue = typeof value === 'string' ? parseFloat(value) : value;
              return isNaN(numValue) || numValue <= 0 ? 'Price must be greater than 0.' : '';
          }
          case 'mileage': {
              const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
              return isNaN(numValue) || numValue < 0 ? 'Mileage cannot be negative.' : '';
          }
          default: return '';
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target as { name: keyof typeof initialFormState; value: string };

      if (name === 'description') {
        if (!value.trim()) {
          descriptionManualRef.current = false;
        } else if (value !== lastAutoDescriptionRef.current) {
          descriptionManualRef.current = true;
        }
      }
      
      // Store as string during editing, parse only on blur
      setFormData(prev => {
        const newState = { ...prev, [name]: value };
        if (name === 'category') {
            newState.make = ''; newState.model = ''; newState.variant = '';
        } else if (name === 'make') {
            newState.model = ''; newState.variant = '';
        } else if (name === 'model') {
            newState.variant = '';
        } else if (name === 'state') {
            newState.city = '';
        }
        return newState;
      });

      // Clear error when user starts typing
      setErrors(prev => ({...prev, [name]: ''}));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target as { name: keyof typeof initialFormState; value: string };
      const isNumeric = ['year', 'price', 'mileage', 'noOfOwners', 'registrationYear'].includes(name);
      
      // Parse numeric fields only when user finishes editing
      if (isNumeric && value !== '') {
        const num = name === 'price' ? parseFloat(value) : parseInt(value, 10);
        if (!isNaN(num)) {
          setFormData(prev => ({ ...prev, [name]: num }));
          const error = validateField(name, num);
          setErrors(prev => ({...prev, [name]: error}));
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
    
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target;
        if (!input.files?.length) return;

        setIsUploading(true);
        const files = Array.from(input.files);
        
        try {
            const { uploadImages, validateImageFile } = await import('../../services/imageUploadService');
            
            const validFiles: File[] = [];
            for (const file of files) {
                const validation = validateImageFile(file);
                if (!validation.valid) {
                    notify(validation.error || 'Invalid image file');
                    continue;
                }
                validFiles.push(file);
            }
            if (validFiles.length === 0) return;
            
            const uploadResults = await uploadImages(validFiles, 'vehicles', seller?.email);
            
            const failedUploads = uploadResults.filter(r => !r.success);
            if (failedUploads.length > 0) {
                const errorMessage = failedUploads.map(r => r.error).filter(Boolean).join(', ');
                console.error('❌ Image upload failed:', errorMessage);
                notify(`Failed to upload ${failedUploads.length} file(s)${errorMessage ? `: ${errorMessage}` : ''}`);
            }
            
            const successfulUrls = uploadResults
                .filter(r => r.success && r.url)
                .map(r => r.url!);
            
            if (successfulUrls.length > 0) {
                const currentImages = formData.images || [];
                const remainingSlots = MAX_LISTING_IMAGES - currentImages.length;
                
                if (remainingSlots <= 0) {
                    notify(`Maximum ${MAX_LISTING_IMAGES} images allowed per vehicle. Please remove some images before adding more.`);
                    return;
                }
                
                const imagesToAdd = successfulUrls.slice(0, remainingSlots);
                if (successfulUrls.length > remainingSlots) {
                    notify(`Only ${remainingSlots} image(s) added. Maximum ${MAX_LISTING_IMAGES} images allowed per vehicle.`);
                }
                
                setFormData(prev => ({ ...prev, images: [...prev.images, ...imagesToAdd] }));
                logInfo(`✅ Successfully uploaded ${imagesToAdd.length} image(s) (${currentImages.length + imagesToAdd.length}/${MAX_LISTING_IMAGES} total)`);
            } else if (failedUploads.length === 0) {
                notify('No images were uploaded. Please try again.');
            }
        } catch (error) { 
            console.error("Error uploading files:", error);
            notify('Failed to upload files. Please try again.');
        } 
        finally {
            setIsUploading(false);
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
          documents: syncDocumentsFromChecklist(clearedChecklist, prev.documents || []),
        };
      });
    };

    const handleChecklistChange = (checklist: NonNullable<typeof formData.sellerDisclosureChecklist>) => {
      setFormData((prev) => {
        const checklistUrls = extractChecklistGalleryUrls(checklist);
        const extras = getExtraGalleryImages(prev.sellerDisclosureChecklist, prev.images || []);
        return {
          ...prev,
          sellerDisclosureChecklist: checklist,
          images: mergeListingImages(checklistUrls, extras),
          documents: syncDocumentsFromChecklist(checklist, prev.documents || []),
        };
      });
    };


    const listingImages = formData.images || [];
    useEffect(() => {
      if (listingImages.length === 0) {
        if (previewImageIndex !== 0) setPreviewImageIndex(0);
        return;
      }
      if (previewImageIndex > listingImages.length - 1) {
        setPreviewImageIndex(listingImages.length - 1);
      }
    }, [listingImages.length, previewImageIndex]);
  
    // Determine if seller's plan is expired (client-side UX guard; server still enforces)
    // Use currentTime for real-time updates
    const isPlanExpired = !!seller?.planExpiryDate && new Date(seller.planExpiryDate) < currentTime;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Block new listings if plan is expired (allow editing existing vehicles)
        if (!editingVehicle && isPlanExpired) {
            notify('Your subscription plan has expired. Please renew your plan to create new listings.');
            return;
        }
        logInfo('📝 Dashboard form submitted');
        logInfo('📋 Form data:', formData);
        logInfo('✉️ Seller email in form:', formData.sellerEmail);
        
        // CRITICAL FIX: Validate required numeric fields BEFORE sanitization
        const priceValue = typeof formData.price === 'string' ? parseFloat(formData.price) : formData.price;
        const mileageValue = typeof formData.mileage === 'string' ? parseInt(formData.mileage, 10) : formData.mileage;
        
        if (!priceValue || isNaN(priceValue) || priceValue <= 0) {
            setActiveSection('details');
            notify('Please enter a valid price greater than 0');
            console.error('❌ Invalid price:', formData.price, '→', priceValue);
            return;
        }
        
        if (isNaN(mileageValue) || mileageValue < 0) {
            setActiveSection('details');
            notify('Please enter a valid mileage (km driven)');
            console.error('❌ Invalid mileage:', formData.mileage, '→', mileageValue);
            return;
        }

        // FIX: Ensure all numeric fields are actual numbers before submission
        const sanitizedFormData = {
            ...formData,
            year: typeof formData.year === 'string' ? parseInt(formData.year, 10) : formData.year,
            price: priceValue,
            mileage: mileageValue,
            registrationYear: typeof formData.registrationYear === 'string' ? parseInt(formData.registrationYear, 10) : formData.registrationYear,
            noOfOwners: typeof formData.noOfOwners === 'string' ? parseInt(formData.noOfOwners, 10) : formData.noOfOwners,
        };
        
        logInfo('🔄 Sanitized form data:', sanitizedFormData);
        logInfo('💰 Price check:', { original: formData.price, sanitized: sanitizedFormData.price, type: typeof sanitizedFormData.price });
        
        const runEnhancement = async (base: typeof sanitizedFormData) => {
            const result = await enhanceVehicleListing(
                editingVehicle ? { ...editingVehicle, ...base } : base,
                {
                    runValidation: true,
                    checkPhotoQuality: true,
                    calculateListingScore: true,
                },
            );
            if (!result.success) {
                const messages = result.validation.errors.map((e) => e.message).join('\n');
                notify(messages || 'Please fix validation errors before saving.');
                return null;
            }
            return result.vehicle;
        };

        if (editingVehicle) {
            logInfo('✏️ Editing existing vehicle:', editingVehicle.id);
            try {
                const enhanced = await runEnhancement(sanitizedFormData);
                if (!enhanced) return;
                await Promise.resolve(onUpdateVehicle(enhanced));
                onCancel();
            } catch (err) {
                console.error('Failed to update listing:', err);
            }
            return;
        }

        logInfo('➕ Adding new vehicle');
        logInfo('📧 Seller email in sanitized data:', sanitizedFormData.sellerEmail);
        logInfo('📧 Seller email from props:', seller.email);
        try {
            const enhanced = await runEnhancement(sanitizedFormData);
            if (!enhanced) return;
            await Promise.resolve(onAddVehicle(enhanced, false));
            onCancel();
        } catch (err) {
            console.error('Failed to add vehicle:', err);
        }
    };

    const listingChecklist = [
        { key: 'basics', label: 'Make, model & year', done: !!(formData.make && formData.model && formData.year), section: 'details' as FormSection },
        { key: 'price', label: 'Price', done: Number(formData.price) > 0, section: 'details' as FormSection },
        { key: 'location', label: 'Location', done: !!(formData.state && formData.city), section: 'details' as FormSection },
        { key: 'mileage', label: 'Km driven', done: Number(formData.mileage) > 0, section: 'details' as FormSection },
        { key: 'specs', label: 'Fuel & transmission', done: !!(formData.fuelType && formData.transmission), section: 'details' as FormSection },
        { key: 'images', label: 'At least 1 photo', done: (formData.images?.length || 0) > 0, section: 'trust' as FormSection },
        { key: 'description', label: 'Description', done: (formData.description || '').trim().length > 20, section: 'finish' as FormSection },
        { key: 'features', label: 'Key features', done: (formData.features?.length || 0) > 0, section: 'finish' as FormSection },
    ];
    const completedCount = listingChecklist.filter((i) => i.done).length;
    const completionPercent = Math.round((completedCount / listingChecklist.length) * 100);
    const missingItems = listingChecklist.filter((i) => !i.done);

    const formSections: { id: FormSection; label: string; title: string; description: string; done: boolean }[] = [
        {
            id: 'details',
            label: 'Details',
            title: 'Vehicle details',
            description: 'Identity, price, location, and drivetrain — the basics buyers scan first.',
            done: listingChecklist.filter((i) => i.section === 'details').every((i) => i.done),
        },
        {
            id: 'trust',
            label: 'Photos & trust',
            title: 'Photos & trust',
            description: 'Documents, inspection photos, and history. Uploads sync to your listing gallery.',
            done: listingChecklist.filter((i) => i.section === 'trust').every((i) => i.done),
        },
        {
            id: 'finish',
            label: 'Finish',
            title: editingVehicle ? 'Polish & publish' : 'Polish & list',
            description: 'Description, features, visibility, and promotion.',
            done: listingChecklist.filter((i) => i.section === 'finish').every((i) => i.done),
        },
    ];

    const activeMeta = formSections.find((s) => s.id === activeSection) || formSections[0];
    const activeIndex = formSections.findIndex((s) => s.id === activeSection);
    const prevSection = activeIndex > 0 ? formSections[activeIndex - 1] : null;
    const nextSection = activeIndex >= 0 && activeIndex < formSections.length - 1 ? formSections[activeIndex + 1] : null;
    const identityTitle =
        [formData.year, formData.make, formData.model].filter(Boolean).join(' ') ||
        (editingVehicle ? 'Untitled listing' : 'New listing');
    const identityPrice = Number(formData.price) > 0 ? `₹${Number(formData.price).toLocaleString('en-IN')}` : null;
    const stateLabel =
        indianStates.find((s) => s.code === formData.state)?.name || formData.state || '';
    const identityLocation = [formData.city, stateLabel].filter(Boolean).join(', ');
    const statusLabel =
        formData.status === 'published' ? 'Published' : formData.status === 'sold' ? 'Sold' : 'Unpublished';
    const previewChips = [
        formData.year,
        Number(formData.mileage) > 0
            ? `${(Number(formData.mileage) / 1000).toFixed(Number(formData.mileage) >= 10000 ? 0 : 1)}k km`
            : null,
        formData.fuelType,
        formData.transmission,
    ].filter(Boolean) as Array<string | number>;
    const activePreviewUrl = listingImages[previewImageIndex] || listingImages[0] || null;
    const coverSrc = activePreviewUrl ? getSafeImageSrc(activePreviewUrl) : null;

    const renderListingPhotosGallery = () => (
      <div className="overflow-hidden rounded-xl bg-white" style={{ border: '1px solid rgba(28,25,23,0.08)', boxShadow: '0 12px 28px -22px rgba(28,25,23,0.35)' }}>
        <div className="relative aspect-[16/9] bg-stone-100">
          {coverSrc ? (
            <img src={coverSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => setActiveSection('trust')}
              className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h4l2-3h6l2 3h4v12H3V7z" /><circle cx="12" cy="13" r="3.5" /></svg>
              <span className="text-xs font-semibold">Add photos</span>
            </button>
          )}
          {editingVehicle ? (
            <span className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-stone-700 shadow-sm">
              {statusLabel}
            </span>
          ) : null}
          {listingImages.length > 0 ? (
            <span className="absolute bottom-3 right-3 rounded-md bg-stone-900/80 px-2 py-1 text-[10px] font-semibold text-white">
              {Math.min(previewImageIndex, listingImages.length - 1) + 1}/{listingImages.length}
            </span>
          ) : null}
        </div>
        {listingImages.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto p-2.5">
            {listingImages.map((url, index) => {
              const selected = index === Math.min(previewImageIndex, listingImages.length - 1);
              return (
                <div key={`${url}-${index}`} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewImageIndex(index)}
                    className={`block h-14 w-20 overflow-hidden rounded-lg bg-stone-100 ring-2 transition ${
                      selected ? 'ring-reride-orange' : 'ring-transparent hover:ring-stone-300'
                    }`}
                    aria-label={`Show photo ${index + 1}`}
                    aria-current={selected ? 'true' : undefined}
                  >
                    <img src={getSafeImageSrc(url)} alt="" className="h-full w-full object-cover" />
                  </button>
                  {index === 0 ? (
                    <span className="pointer-events-none absolute left-1 top-1 rounded bg-stone-900/80 px-1 py-[1px] text-[8px] font-bold text-white">
                      COVER
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleRemoveImageUrl(url)}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600 shadow ring-1 ring-stone-200"
                    title="Remove image"
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
        <div className="space-y-2 border-t border-stone-100 p-3">
          <div>
            <h3
              className="truncate text-sm font-semibold tracking-tight text-stone-900"
              style={{ fontFamily: "'Nunito Sans', Poppins, sans-serif", letterSpacing: '-0.02em' }}
            >
              {identityTitle}
            </h3>
            <p className="mt-0.5 text-base font-bold tabular-nums text-stone-900">
              {identityPrice || '₹ —'}
            </p>
          </div>
          {previewChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {previewChips.map((chip) => (
                <span key={String(chip)} className="rounded-md bg-stone-100 px-2 py-1 text-[11px] font-semibold text-stone-700">
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          {identityLocation ? (
            <p className="text-xs font-medium text-stone-600">{identityLocation}</p>
          ) : (
            <p className="text-xs font-medium text-stone-500">Location not set</p>
          )}
        </div>
      </div>
    );

    return (
      <div>
        {/* Compact header + step rail */}
        <div className="border-b border-stone-200/70 px-4 py-3.5 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <h2
                        className="text-xl font-semibold tracking-tight text-stone-900 sm:text-[1.35rem]"
                        style={{ fontFamily: "'Nunito Sans', Poppins, sans-serif", letterSpacing: '-0.03em' }}
                    >
                        {editingVehicle ? 'Edit vehicle' : 'Add vehicle'}
                    </h2>
                    <p className="mt-0.5 truncate text-sm font-medium text-stone-700">
                        {identityTitle}
                        {identityPrice ? ` · ${identityPrice}` : ''}
                        {identityLocation ? ` · ${identityLocation}` : ''}
                        <span className="text-stone-500"> · Step {activeIndex + 1}/{formSections.length} · {completionPercent}%</span>
                    </p>
                </div>
            </div>

            <ol className="mt-3 flex gap-1.5" aria-label="Listing steps">
                {formSections.map((section, index) => {
                    const isActive = section.id === activeSection;
                    const isPast = index < activeIndex;
                    return (
                        <li key={section.id} className="min-w-0 flex-1">
                            <button
                                type="button"
                                onClick={() => setActiveSection(section.id)}
                                className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition sm:px-3 ${
                                    isActive ? 'bg-white shadow-sm' : 'hover:bg-white/80'
                                }`}
                                style={
                                    isActive
                                        ? { border: '1px solid rgba(28,25,23,0.1)' }
                                        : { border: '1px solid transparent' }
                                }
                                aria-current={isActive ? 'step' : undefined}
                                title={section.description}
                            >
                                <span
                                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                                        isActive
                                            ? 'bg-reride-orange text-white'
                                            : isPast || section.done
                                              ? 'bg-emerald-500 text-white'
                                              : 'bg-stone-300 text-stone-800'
                                    }`}
                                >
                                    {isPast || section.done ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        index + 1
                                    )}
                                </span>
                                <span className={`truncate text-[13px] font-semibold ${isActive ? 'text-stone-900' : 'text-stone-700'}`}>
                                    {section.label}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>

        {isPlanExpired && (
            <div className="mx-4 mt-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 sm:mx-5">
                <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                <div>
                    <p className="font-semibold">Your plan has expired</p>
                    <p className="text-sm">Renew your plan to add new listings.</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12">
          <form onSubmit={handleSubmit} className="flex min-w-0 flex-col lg:col-span-7 xl:col-span-8">
            <div className="flex-1 px-4 py-4 sm:px-5 sm:py-5">
            {activeSection === 'details' && (
            <FormFieldset
                title={activeMeta.title}
                description={activeMeta.description}
                actions={
                    hasVehicleData ? (
                        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Admin Managed
                        </span>
                    ) : undefined
                }
            >
              <div className="space-y-5">
              <FieldGroup title="Identity">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 md:grid-cols-3">
                    <FormInput label="Category" name="category" type="select" value={formData.category} onChange={handleChange} required>
                        <option value="" disabled>Select Category</option>
                        {(() => {
                            const categories = Object.keys(safeVehicleData);
                            // Categories loaded successfully
                            
                            if (categories.length === 0) {
                                return <option value="" disabled>Loading categories...</option>;
                            }
                            
                            return categories.map(cat => (
                                <option key={cat} value={cat}>
                                    {cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                                </option>
                            ));
                        })()}
                    </FormInput>
                    <ComboboxInput
                        label="Make"
                        name="make"
                        value={formData.make || ''}
                        onChange={handleChange}
                        options={Array.isArray(availableMakes) ? availableMakes : []}
                        placeholder={!formData.category ? 'Select Category First' : 'Select or type Make'}
                        error={errors.make}
                        disabled={!formData.category}
                        required
                    />
                    <ComboboxInput
                        label="Model"
                        name="model"
                        value={formData.model || ''}
                        onChange={handleChange}
                        options={Array.isArray(availableModels) ? availableModels : []}
                        placeholder={!formData.make ? 'Select Make First' : 'Select or type Model'}
                        error={errors.model}
                        disabled={!formData.make}
                        required
                    />
                    <ComboboxInput
                        label="Variant"
                        name="variant"
                        value={formData.variant || ''}
                        onChange={handleChange}
                        options={Array.isArray(availableVariants) ? availableVariants : []}
                        placeholder="Select or type Variant (Optional)"
                        disabled={!formData.model}
                    />
                    <FormInput label="Make Year" name="year" type="number" value={formData.year} onChange={handleChange} onBlur={handleBlur} error={errors.year} required />
                    <FormInput label="Registration Year" name="registrationYear" type="number" value={formData.registrationYear} onChange={handleChange} onBlur={handleBlur} required />
                </div>
              </FieldGroup>

              <FieldGroup title="Price & usage">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <FormInput label="Price" name="price" value={formData.price} onChange={handleChange} onBlur={handleBlur} error={errors.price} tooltip="Enter the listing price in rupees." prefix="₹" indianNumberFormat required />
                    <FormInput label="Km Driven" name="mileage" value={formData.mileage} onChange={handleChange} onBlur={handleBlur} error={errors.mileage} suffix="km" indianNumberFormat />
                    <FormInput label="No. of Owners" name="noOfOwners" type="number" value={formData.noOfOwners} onChange={handleChange} onBlur={handleBlur} />
                </div>
                <PricingGuidance
                  vehicleDetails={formData}
                  allVehicles={allVehicles}
                  onApplySuggestedPrice={(price) =>
                    setFormData((prev) => ({ ...prev, price }))
                  }
                />
              </FieldGroup>

              <FieldGroup title="Location & insurance">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-3">
                    <FormInput label="RTO" name="rto" value={formData.rto} onChange={handleChange} placeholder="e.g., MH01" />
                    <FormInput label="State" name="state" type="select" value={formData.state} onChange={handleChange} required>
                        <option value="" disabled>Select State</option>
                        {indianStates.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </FormInput>
                    <FormInput label="City" name="city" type="select" value={formData.city} onChange={handleChange} disabled={!formData.state} required>
                        <option value="" disabled>Select City</option>
                        {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
                    </FormInput>
                    <FormInput label="Insurance Type" name="insuranceType" type="select" value={formData.insuranceType} onChange={handleChange}>
                        <option>Comprehensive</option>
                        <option>Third Party</option>
                        <option>Expired</option>
                    </FormInput>
                    <FormInput label="Insurance Validity" name="insuranceValidity" value={formData.insuranceValidity} onChange={handleChange} placeholder="e.g., Aug 2026" />
                </div>
              </FieldGroup>

              <FieldGroup title="Drivetrain">
                <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                     <FormInput label="Transmission" name="transmission" type="select" value={formData.transmission} onChange={handleChange}>
                            <option>Automatic</option><option>Manual</option><option>CVT</option><option>DCT</option>
                        </FormInput>
                    <FormInput label="Fuel Type" name="fuelType" type="select" value={formData.fuelType} onChange={handleChange}>
                            <option>Petrol</option><option>Diesel</option><option>Electric</option><option>CNG</option><option>Hybrid</option>
                        </FormInput>
                    <FormInput label="Mileage / Range" name="fuelEfficiency" value={formData.fuelEfficiency} onChange={handleChange} tooltip="e.g., 18 KMPL or 300 km range"/>
                    <FormInput label="Color" name="color" value={formData.color} onChange={handleChange} onBlur={handleBlur} />
                </div>
              </FieldGroup>
              </div>
            </FormFieldset>
            )}

            {activeSection === 'trust' && (
            <FormFieldset
              title={activeMeta.title}
              description={activeMeta.description}
            >
              {(formData.images?.length || 0) > 0 &&
              !formData.sellerDisclosureChecklist?.items?.some((item) => item.photoUrl?.trim()) ? (
                <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-stone-900">
                  <p className="font-semibold text-stone-900">
                    Listing has {formData.images.length} photo
                    {formData.images.length === 1 ? '' : 's'} in Preview — fill checklist slots below
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-stone-800">
                    Checklist uploads appear in the same Preview gallery and unlock trust badges after you Save.
                  </p>
                </div>
              ) : null}
              <SellerDisclosureForm
                hideTitle
                compact
                category={formData.category || VehicleCategory.FOUR_WHEELER}
                value={formData.sellerDisclosureChecklist}
                sellerEmail={seller.email}
                registrationNumber={formData.registrationNumber}
                vahanVerified={formData.vahanSnapshot?.source === 'surepass'}
                vahanSnapshot={formData.vahanSnapshot}
                onChange={handleChecklistChange}
                onVerifyVahan={async (registrationNumber) => {
                  try {
                    const result = await verifyVahanRegistration(
                      registrationNumber,
                      editingVehicle?.databaseId ?? editingVehicle?.id,
                    );
                    setFormData((prev) =>
                      applyVahanVerifyToVehicleFields(prev, registrationNumber, result),
                    );
                    notify(
                      result.verified ? 'RC verified with government records' : result.message || 'Saved RC — auto-verify unavailable',
                      result.verified ? 'success' : 'warning',
                    );
                    return {
                      verified: result.verified,
                      message: result.message,
                    };
                  } catch (e) {
                    const message = e instanceof Error ? e.message : 'Verification failed';
                    notify(message, 'error');
                    return { verified: false, message };
                  }
                }}
              />
              <ListingTrustProgress vehicle={formData as Vehicle} className="mt-3" />
            </FormFieldset>
            )}

            {activeSection === 'finish' && (
            <FormFieldset title={activeMeta.title} description={activeMeta.description}>
                <div className="space-y-5">
                    <FieldGroup title="Description">
                    <div>
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <label htmlFor="description" className="text-[13px] font-semibold text-stone-800">
                                Buyer-facing copy
                            </label>
                            <button
                                type="button"
                                onClick={applyAutoDescription}
                                disabled={!autoDescription}
                                className="text-xs font-semibold text-reride-orange hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                            >
                                Refresh from details
                            </button>
                        </div>
                        <div className="relative">
                            <textarea
                                id="description"
                                name="description"
                                rows={7}
                                maxLength={VEHICLE_DESCRIPTION_MAX_LENGTH}
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Fill details first to auto-generate a polished description…"
                                className="block w-full resize-y rounded-xl border border-stone-200/90 bg-white p-3.5 font-mono text-sm leading-relaxed text-stone-900 transition hover:border-stone-300 focus:outline-none"
                                onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.14)')}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = '')}
                            />
                            <div className="pointer-events-none absolute bottom-2.5 right-3.5 text-xs font-medium text-stone-500">
                                {(formData.description || '').length} / {VEHICLE_DESCRIPTION_MAX_LENGTH}
                            </div>
                        </div>
                    </div>
                    </FieldGroup>

                    <FieldGroup title="Key features">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={featureInput}
                                onChange={(e) => setFeatureInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                                placeholder="e.g., Sunroof, ABS — press Enter"
                                className="w-full rounded-xl border border-stone-200/90 bg-white px-3.5 py-3 text-sm text-stone-900 transition hover:border-stone-300 focus:outline-none"
                                onFocus={(e) => (e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 107, 53, 0.14)')}
                                onBlur={(e) => (e.currentTarget.style.boxShadow = '')}
                            />
                            <button
                                type="button"
                                onClick={handleAddFeature}
                                disabled={!featureInput.trim()}
                                className="inline-flex shrink-0 items-center rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Add
                            </button>
                        </div>
                        {formData.features.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {formData.features.map(feature => (
                                    <span key={feature} className="inline-flex items-center gap-1.5 rounded-lg bg-stone-100 py-1 pl-2.5 pr-1 text-sm font-medium text-stone-700 ring-1 ring-stone-200/80">
                                        {feature}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFeature(feature)}
                                            className="flex h-5 w-5 items-center justify-center rounded-md text-stone-500 transition-colors hover:bg-stone-200"
                                            aria-label={`Remove ${feature}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </FieldGroup>

                    <FieldGroup title="Listing photos">
                        <div className="lg:hidden mb-3">{renderListingPhotosGallery()}</div>
                        <p className="mb-3 text-sm text-stone-700">
                          All photos (checklist + extras) show in Preview
                          {listingImages.length > 0 ? ` · ${listingImages.length}/${MAX_LISTING_IMAGES}` : ''}.
                        </p>
                        <label
                            htmlFor="file-upload"
                            className={`relative block cursor-pointer rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 p-6 transition hover:border-reride-orange hover:bg-orange-50/40 ${isUploading ? 'cursor-not-allowed opacity-50' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); if (!isUploading) e.currentTarget.classList.add('border-reride-orange', 'bg-orange-50'); }}
                            onDragLeave={(e) => { e.currentTarget.classList.remove('border-reride-orange', 'bg-orange-50'); }}
                            onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.classList.remove('border-reride-orange', 'bg-orange-50');
                                if (isUploading) return;
                                const files = e.dataTransfer.files;
                                if (files && files.length > 0) {
                                    const input = document.getElementById('file-upload') as HTMLInputElement;
                                    if (input) {
                                        const dt = new DataTransfer();
                                        Array.from(files).forEach(f => dt.items.add(f));
                                        input.files = dt.files;
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                    }
                                }
                            }}
                        >
                            <div className="flex flex-col items-center text-center">
                                <p className="text-sm font-semibold text-stone-800">
                                    {isUploading ? 'Uploading…' : 'Drop photos to add to Preview'}
                                </p>
                                <p className="mt-1 text-xs font-medium text-stone-600">or click to browse · JPG/PNG up to 10MB</p>
                            </div>
                            <input id="file-upload" type="file" className="sr-only" multiple accept="image/png, image/jpeg" onChange={handleFileUpload} disabled={isUploading} />
                        </label>
                    </FieldGroup>

                    {editingVehicle && (
                      <FieldGroup title={t('sellerListing.section.listingStatus')}>
                        <div className="max-w-sm">
                          <label htmlFor="listing-status" className="mb-1.5 block text-[13px] font-semibold text-stone-800">
                            {t('sellerListing.label.status')}
                          </label>
                          <select
                            id="listing-status"
                            name="status"
                            value={formData.status}
                            onChange={handleChange}
                            className="block w-full rounded-xl border border-stone-200/90 bg-white px-3.5 py-3 text-sm text-stone-900"
                          >
                            <option value="published">{t('sellerListing.status.published')}</option>
                            <option value="unpublished">{t('sellerListing.status.unpublished')}</option>
                            <option value="sold">{t('sellerListing.status.sold')}</option>
                          </select>
                        </div>
                      </FieldGroup>
                    )}

                    <FieldGroup title="Promotion">
                        <div className="rounded-2xl border border-orange-100/80 bg-gradient-to-br from-orange-50/90 to-white p-5">
                            <p className="text-sm font-semibold text-stone-900">Boost after you publish</p>
                            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-stone-700">
                                Plan credits unlock a 7-day Featured boost from My listings. Paid packs add stronger placements.
                            </p>
                            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-stone-600">
                                Credits · {seller.featuredCredits || 0}
                            </p>
                        </div>
                    </FieldGroup>
                </div>
            </FormFieldset>
            )}
            </div>

            {/* One clear primary action */}
            <div className="sticky bottom-0 z-20 mt-auto flex flex-col-reverse gap-2.5 border-t border-stone-200/70 bg-[#FBF8F5]/95 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex items-center justify-center gap-4 sm:justify-start">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-sm font-semibold text-stone-700 transition hover:text-stone-900"
                    >
                        Cancel
                    </button>
                    {nextSection ? (
                      <button
                        type="submit"
                        disabled={!editingVehicle && isPlanExpired}
                        className="text-sm font-semibold text-stone-600 transition hover:text-stone-900 disabled:opacity-40"
                      >
                        {editingVehicle ? 'Save now' : 'Save draft'}
                      </button>
                    ) : null}
                </div>
                <div className="flex gap-2">
                    {prevSection ? (
                      <button
                        type="button"
                        onClick={() => setActiveSection(prevSection.id)}
                        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-white"
                        style={sellerPremiumGhostBtnStyle}
                      >
                        Back
                      </button>
                    ) : null}
                    {nextSection ? (
                      <button
                        type="button"
                        onClick={() => setActiveSection(nextSection.id)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:flex-none"
                        style={sellerPremiumPrimaryBtnStyle}
                      >
                        Continue
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={!editingVehicle && isPlanExpired}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white sm:flex-none ${
                            !editingVehicle && isPlanExpired ? 'cursor-not-allowed opacity-50' : ''
                        }`}
                        style={sellerPremiumPrimaryBtnStyle}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {editingVehicle ? 'Save changes' : 'List vehicle'}
                      </button>
                    )}
                </div>
            </div>
          </form>

          <aside
            className="hidden border-l border-stone-200/70 bg-stone-50/50 lg:col-span-5 lg:block xl:col-span-4"
          >
              <div className="sticky top-0 space-y-3.5 p-4">
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-stone-600">Preview</p>
                    <div className="mt-2">{renderListingPhotosGallery()}</div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-stone-600">
                        {missingItems.length ? 'Still needed' : 'Ready'}
                      </p>
                      <span className="text-xs font-bold tabular-nums text-stone-700">{completedCount}/{listingChecklist.length}</span>
                    </div>
                    {missingItems.length === 0 ? (
                      <p className="rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-100">
                        Essentials complete. You can save when ready.
                      </p>
                    ) : (
                      <ul
                        className="overflow-hidden rounded-2xl bg-white"
                        style={{ border: '1px solid rgba(28,25,23,0.08)' }}
                      >
                        {missingItems.map((item) => (
                          <li key={item.key} className="border-t border-stone-100 first:border-t-0">
                            <button
                              type="button"
                              onClick={() => setActiveSection(item.section)}
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-orange-50/50"
                            >
                              <span className="text-[13px] font-medium text-stone-800">{item.label}</span>
                              <span className="text-[11px] font-semibold text-reride-orange">Go</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
              </div>
          </aside>
        </div>
      </div>
    );
});
