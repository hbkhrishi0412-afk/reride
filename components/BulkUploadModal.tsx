import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../types';
import { VehicleCategory } from '../types';

interface BulkUploadModalProps {
    onClose: () => void;
    onAddMultipleVehicles: (vehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]) => void;
    sellerEmail: string;
}

// RFC 4180-ish CSV parser: handles quoted fields, embedded commas, escaped quotes (""), CRLF.
const parseCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === ',') {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields.map(f => f.trim());
};

const parseCSV = (csvText: string): Record<string, string>[] => {
    // Strip BOM (Excel exports prepend \ufeff) and normalize CRLF → LF.
    const normalized = csvText.replace(/^\ufeff/, '').replace(/\r\n?/g, '\n');
    const rawLines = normalized.split('\n').filter(line => line.trim().length > 0);
    if (rawLines.length < 2) return [];
    const headers = parseCSVLine(rawLines[0]);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < rawLines.length; i++) {
        const values = parseCSVLine(rawLines[i]);
        if (values.length !== headers.length) {
            // Skip malformed rows rather than silently misaligning columns.
            continue;
        }
        const row: Record<string, string> = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx];
        });
        rows.push(row);
    }
    return rows;
};

// CSV Template Content
const CSV_TEMPLATE = `category,make,model,variant,year,price,mileage,fuelType,transmission,color,noOfOwners,city,state,rto,registrationYear,insuranceValidity,insuranceType,features,description
four-wheeler,Tata,Nexon,XZ+,2022,950000,22000,Petrol,Manual,Red,1,Pune,MH,MH12,2022,Aug 2025,Comprehensive,"Sunroof|Alloy Wheels","Excellent condition Nexon with low mileage."
two-wheeler,Royal Enfield,Classic 350,Halcyon,2023,210000,5000,Petrol,Manual,Black,1,Jaipur,RJ,RJ14,2023,Mar 2026,Comprehensive,ABS,"Almost new, single owner bike."
`;

const REQUIRED_FIELDS: (keyof Vehicle)[] = ['category', 'make', 'model', 'year', 'price', 'mileage', 'fuelType', 'transmission', 'city', 'state'];

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ onClose, onAddMultipleVehicles, sellerEmail }) => {
    const { t } = useTranslation();
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[]>([]);
    const [errors, setErrors] = useState<string[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleParseAndValidate = useCallback(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            const jsonData = parseCSV(text);
            const validationErrors: string[] = [];
            const validVehicles: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'>[] = [];

            jsonData.forEach((row, index) => {
                let hasError = false;
                for (const field of REQUIRED_FIELDS) {
                    if (!row[field]) {
                        validationErrors.push(
                            t('dashboard.bulkModal.error.missingField', { row: index + 2, field })
                        );
                        hasError = true;
                    }
                }

                if (hasError) return;

                const newVehicle: Omit<Vehicle, 'id' | 'averageRating' | 'ratingCount'> = {
                    category: row.category as VehicleCategory,
                    make: row.make,
                    model: row.model,
                    variant: row.variant,
                    year: parseInt(row.year, 10),
                    price: parseInt(row.price, 10),
                    mileage: parseInt(row.mileage, 10),
                    fuelType: row.fuelType,
                    transmission: row.transmission,
                    color: row.color,
                    noOfOwners: parseInt(row.noOfOwners, 10) || 1,
                    city: row.city,
                    state: row.state,
                    location: `${row.city}, ${row.state}`,
                    rto: row.rto,
                    registrationYear: parseInt(row.registrationYear, 10) || parseInt(row.year, 10),
                    insuranceValidity: row.insuranceValidity,
                    insuranceType: row.insuranceType,
                    features: row.features ? row.features.split('|').map(f => f.trim()) : [],
                    description: row.description,
                    engine: row.engine || '',
                    fuelEfficiency: row.fuelEfficiency || '',
                    displacement: row.displacement || '',
                    groundClearance: row.groundClearance || '',
                    bootSpace: row.bootSpace || '',
                    images: [`https://picsum.photos/seed/${row.make}${row.model}${index}/800/600`], // Placeholder image
                    sellerEmail,
                    status: 'published',
                    isFeatured: false,
                    views: 0,
                    inquiriesCount: 0,
                    certifiedInspection: null,
                    documents: [],
                    serviceRecords: [],
                    accidentHistory: [],
                };

                // More validation
                if (isNaN(newVehicle.year) || isNaN(newVehicle.price) || isNaN(newVehicle.mileage)) {
                    validationErrors.push(
                        t('dashboard.bulkModal.error.numericFields', { row: index + 2 })
                    );
                    return;
                }
                validVehicles.push(newVehicle);
            });
            
            setErrors(validationErrors);
            setParsedData(validVehicles);
            setStep(2);
        };
        reader.readAsText(file);
    }, [file, sellerEmail, t]);
    
    const handleConfirm = () => {
        if (parsedData.length > 0) {
            onAddMultipleVehicles(parsedData);
        }
        onClose();
    };

    const downloadTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'vehicle_upload_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-200">
                    <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">{t('dashboard.bulkModal.title')}</h2>
                    <p className="text-sm text-reride-text-dark dark:text-reride-text-dark">{t('dashboard.bulkModal.subtitle')}</p>
                </div>

                <div className="p-6 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-4 text-center">
                            <h3 className="font-semibold">{t('dashboard.bulkModal.step1Title')}</h3>
                            <p>{t('dashboard.bulkModal.step1Body')}</p>
                            <button onClick={downloadTemplate} className="font-semibold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>{t('dashboard.bulkModal.downloadTemplate')}</button>
                            <div className="mt-4 p-6 border-2 border-dashed border-gray-200 dark:border-gray-300 rounded-lg">
                                <input type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-reride-text-dark file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:text-white" style={{ ['--file-bg' as any]: 'var(--reride-orange)', ['--file-hover-bg' as any]: 'var(--reride-blue)' }} />
                            </div>
                        </div>
                    )}
                    {step === 2 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold">{t('dashboard.bulkModal.step2Title')}</h3>
                            <div className="p-4 bg-white rounded-lg">
                                <p className="font-bold text-reride-orange dark:text-reride-orange">{t('dashboard.bulkModal.readyCount', { count: parsedData.length })}</p>
                                {errors.length > 0 && <p className="font-bold text-reride-orange dark:text-reride-orange mt-2">{t('dashboard.bulkModal.errorsSkipped', { count: errors.length })}</p>}
                            </div>
                            {errors.length > 0 && (
                                <details className="max-h-48 overflow-y-auto p-2 border rounded-lg">
                                    <summary className="cursor-pointer font-semibold text-sm">{t('dashboard.bulkModal.viewErrors')}</summary>
                                    <ul className="text-xs text-reride-orange list-disc list-inside mt-2">
                                        {errors.map((err, i) => <li key={i}>{err}</li>)}
                                    </ul>
                                </details>
                            )}
                            <p className="text-sm">{t('dashboard.bulkModal.confirmHint', { count: parsedData.length })}</p>
                        </div>
                    )}
                </div>

                <div className="bg-white px-6 py-3 flex justify-end gap-4 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-reride-text-dark rounded-md hover:bg-white">{t('dashboard.bulkModal.cancel')}</button>
                    {step === 1 && <button onClick={handleParseAndValidate} disabled={!file} className="px-4 py-2 btn-brand-primary text-white rounded-md disabled:opacity-50">{t('dashboard.bulkModal.nextReview')}</button>}
                    {step === 2 && <button onClick={handleConfirm} className="px-4 py-2 bg-reride-orange text-white rounded-md hover:bg-reride-orange">{t('dashboard.bulkModal.confirmUpload')}</button>}
                </div>
            </div>
        </div>
    );
};

export default BulkUploadModal;