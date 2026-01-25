import React, { useEffect } from 'react';
import type { NewCarModel, NewCarVariant } from '../data/newCarsData.js';

interface CarSpecModalProps {
    car: NewCarModel;
    variant: NewCarVariant;
    onClose: () => void;
}

const SpecSection: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h3 className="text-lg font-bold text-reride-text-dark dark:text-reride-text-dark mb-2 border-b border-gray-200-200 dark:border-gray-200-200 pb-1">
            {title}
        </h3>
        {children}
    </div>
);

const SpecDetail: React.FC<{ label: string, value: string | number | undefined }> = ({ label, value }) => (
    <div className="flex justify-between py-1.5 px-2 rounded hover:bg-reride-off-white dark:hover:bg-brand-gray-700">
        <dt className="text-sm text-brand-gray-600 dark:text-reride-text">{label}</dt>
        <dd className="text-sm font-semibold text-reride-text-dark dark:text-brand-gray-200 text-right">{value || '-'}</dd>
    </div>
);

const FeatureList: React.FC<{ features: string[] }> = ({ features }) => {
    if (features.length === 0) {
        return <p className="text-sm text-reride-text italic">No features listed for this category.</p>;
    }
    return (
        <ul className="list-disc list-inside space-y-1 text-sm text-reride-text-dark dark:text-reride-text-dark">
            {features.map(feature => <li key={feature}>{feature}</li>)}
        </ul>
    );
};

const CarSpecModal: React.FC<CarSpecModalProps> = ({ car, variant, onClose }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEsc);

        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100] p-4 animate-fade-in" 
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200-200 dark:border-gray-200-200 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-2xl font-bold text-reride-text-dark dark:text-reride-text-dark">
                            {car.brand_name} {car.model_name}
                        </h2>
                        <p className="text-md text-brand-gray-600 dark:text-reride-text-dark">{variant.variant_name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-reride-text-dark dark:hover:text-white text-3xl">&times;</button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Column 1 */}
                        <div className="space-y-6">
                             <SpecSection title="Key Specifications">
                                <dl>
                                    <SpecDetail label="Engine" value={variant.engine_specs} />
                                    <SpecDetail label="Power" value={variant.power_bhp} />
                                    <SpecDetail label="Torque" value={variant.torque_nm} />
                                    <SpecDetail label="Mileage" value={car.key_specs.mileage} />
                                    <SpecDetail label="Transmission" value={variant.transmission} />
                                    <SpecDetail label="Fuel Type" value={variant.fuel_type} />
                                </dl>
                            </SpecSection>
                             <SpecSection title="Dimensions & Capacity">
                                <dl>
                                    <SpecDetail label="Seating Capacity" value={`${car.key_specs.seating_capacity} Seater`} />
                                    <SpecDetail label="Boot Space" value={car.key_specs.boot_space_litres ? `${car.key_specs.boot_space_litres} litres` : 'N/A'} />
                                </dl>
                            </SpecSection>
                             <SpecSection title="Safety Features">
                                <FeatureList features={variant.features.safety} />
                            </SpecSection>
                              <SpecSection title="Interior Features">
                                <FeatureList features={variant.features.interior} />
                            </SpecSection>
                        </div>
                        {/* Column 2 */}
                        <div className="space-y-6">
                            <SpecSection title="Comfort & Convenience">
                                <FeatureList features={variant.features.comfort_convenience} />
                            </SpecSection>
                             <SpecSection title="Exterior Features">
                                <FeatureList features={variant.features.exterior} />
                            </SpecSection>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CarSpecModal;