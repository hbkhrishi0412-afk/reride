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

    const cardStyle: React.CSSProperties = {
        background: '#FFFFFF',
        border: '1px solid rgba(15,23,42,0.06)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -16px rgba(15,23,42,0.20)'
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
            style={{ background: 'rgba(8,8,12,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={onClose}
        >
            <div
                className="w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-in-up"
                style={{ background: '#FFFFFF', border: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 30px 60px -20px rgba(0,0,0,0.40)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Premium obsidian header */}
                <div
                    className="relative overflow-hidden px-5 pt-5 pb-5 sm:px-6 sm:pt-6 text-white"
                    style={{ background: 'linear-gradient(180deg, #0B0B0F 0%, #16161D 70%, #1C1C24 100%)' }}
                >
                    <div aria-hidden className="pointer-events-none absolute inset-0">
                        <div className="absolute -top-20 -left-16 w-64 h-64 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(255,107,53,0.20), transparent 70%)' }} />
                        <div className="absolute -bottom-24 -right-20 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(168,135,255,0.10), transparent 70%)' }} />
                        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
                    </div>

                    {/* Drag handle (mobile) */}
                    <div className="relative flex justify-center sm:hidden mb-3">
                        <span className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
                    </div>

                    <div className="relative flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                            <span
                                className="w-11 h-11 rounded-2xl grid place-items-center text-white shrink-0"
                                style={{ background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)', boxShadow: '0 10px 22px -10px rgba(255,107,53,0.55), inset 0 1px 0 rgba(255,255,255,0.20)' }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                </svg>
                            </span>
                            <div className="min-w-0">
                                <p className="text-[10.5px] uppercase tracking-[0.22em] text-white/45 font-semibold">Bulk upload</p>
                                <h2 className="text-white font-semibold tracking-tight" style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
                                    {t('dashboard.bulkModal.title')}
                                </h2>
                                <p className="mt-1.5 text-[12px] text-white/55 font-medium">{t('dashboard.bulkModal.subtitle')}</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="w-9 h-9 rounded-full grid place-items-center text-white/85 active:scale-95 transition-transform shrink-0"
                            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Step indicator */}
                    <div className="relative mt-5 flex items-center gap-2">
                        {[1, 2].map((s) => {
                            const isActive = step === s;
                            const isDone = step > s;
                            return (
                                <div key={s} className="flex items-center gap-2 flex-1">
                                    <span
                                        className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold"
                                        style={{
                                            background: isActive || isDone ? 'linear-gradient(135deg, #FF8456, #FF6B35)' : 'rgba(255,255,255,0.08)',
                                            color: '#FFFFFF',
                                            border: `1px solid ${isActive || isDone ? 'transparent' : 'rgba(255,255,255,0.14)'}`
                                        }}
                                    >
                                        {isDone ? '✓' : s}
                                    </span>
                                    <span className="text-[11px] font-semibold text-white/70 tracking-tight">
                                        {s === 1 ? 'Upload' : 'Review'}
                                    </span>
                                    {s === 1 && (
                                        <span aria-hidden className="flex-1 h-px mx-1" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))' }} />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="rounded-2xl p-4" style={cardStyle}>
                                <p className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-slate-400">Step 1</p>
                                <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                                    {t('dashboard.bulkModal.step1Title')}
                                </h3>
                                <p className="mt-1 text-[12.5px] text-slate-500 font-medium leading-snug">
                                    {t('dashboard.bulkModal.step1Body')}
                                </p>
                                <button
                                    type="button"
                                    onClick={downloadTemplate}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold active:scale-95 transition-transform"
                                    style={{ background: 'rgba(255,107,53,0.10)', color: '#EA580C', border: '1px solid rgba(255,107,53,0.20)' }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                    </svg>
                                    {t('dashboard.bulkModal.downloadTemplate')}
                                </button>
                            </div>

                            <label
                                htmlFor="bulk-csv-file"
                                className="block rounded-2xl p-6 text-center cursor-pointer transition-all active:scale-[0.99]"
                                style={{
                                    background: file ? 'linear-gradient(180deg, #FFF7F2, #FFFFFF)' : 'rgba(15,23,42,0.025)',
                                    border: `1.5px dashed ${file ? '#FF6B35' : 'rgba(15,23,42,0.18)'}`
                                }}
                            >
                                <span
                                    className="w-12 h-12 mx-auto mb-3 rounded-2xl grid place-items-center"
                                    style={{
                                        background: file ? 'linear-gradient(135deg, #FF8456, #FF6B35)' : 'rgba(15,23,42,0.05)',
                                        color: file ? '#FFFFFF' : '#475569',
                                        boxShadow: file ? '0 10px 22px -10px rgba(255,107,53,0.45)' : 'none'
                                    }}
                                >
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                                    </svg>
                                </span>
                                <p className="text-[13.5px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                                    {file ? file.name : 'Tap to choose a CSV file'}
                                </p>
                                <p className="mt-1 text-[11.5px] text-slate-500 font-medium">
                                    {file ? `${(file.size / 1024).toFixed(1)} KB · CSV` : 'Supports the Reride template'}
                                </p>
                                <input
                                    id="bulk-csv-file"
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileChange}
                                    className="sr-only"
                                />
                            </label>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="rounded-2xl p-4" style={cardStyle}>
                                <p className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-slate-400">Step 2</p>
                                <h3 className="text-[15px] font-semibold text-slate-900 tracking-tight" style={{ letterSpacing: '-0.01em' }}>
                                    {t('dashboard.bulkModal.step2Title')}
                                </h3>
                                <div className="mt-3 grid grid-cols-2 gap-2.5">
                                    <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)' }}>
                                        <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-emerald-700">Ready</p>
                                        <p className="text-[20px] font-bold text-emerald-700 mt-0.5 tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                                            {parsedData.length}
                                        </p>
                                        <p className="text-[10.5px] text-emerald-700/70 font-medium">{t('dashboard.bulkModal.readyCount', { count: parsedData.length })}</p>
                                    </div>
                                    <div className="rounded-xl p-3" style={{ background: errors.length > 0 ? 'rgba(220,38,38,0.06)' : 'rgba(15,23,42,0.04)', border: `1px solid ${errors.length > 0 ? 'rgba(220,38,38,0.20)' : 'rgba(15,23,42,0.06)'}` }}>
                                        <p className="text-[10px] uppercase tracking-[0.16em] font-bold" style={{ color: errors.length > 0 ? '#B91C1C' : '#475569' }}>Skipped</p>
                                        <p className="text-[20px] font-bold mt-0.5 tracking-tight" style={{ color: errors.length > 0 ? '#B91C1C' : '#475569', letterSpacing: '-0.02em' }}>
                                            {errors.length}
                                        </p>
                                        <p className="text-[10.5px] font-medium" style={{ color: errors.length > 0 ? '#B91C1C99' : '#64748B' }}>
                                            {errors.length > 0 ? t('dashboard.bulkModal.errorsSkipped', { count: errors.length }) : 'No issues'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {errors.length > 0 && (
                                <details
                                    className="rounded-2xl p-3"
                                    style={{ background: '#FFFFFF', border: '1px solid rgba(220,38,38,0.18)' }}
                                >
                                    <summary className="cursor-pointer text-[12.5px] font-semibold text-rose-700 px-1">
                                        {t('dashboard.bulkModal.viewErrors')}
                                    </summary>
                                    <ul className="mt-2 max-h-40 overflow-y-auto space-y-1 px-1">
                                        {errors.map((err, i) => (
                                            <li key={i} className="text-[11.5px] text-rose-700 font-medium leading-snug">• {err}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            <p className="text-[12px] text-slate-500 font-medium leading-snug px-1">
                                {t('dashboard.bulkModal.confirmHint', { count: parsedData.length })}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    className="px-5 sm:px-6 py-3.5 flex gap-2.5"
                    style={{ background: 'rgba(248,250,252,0.85)', borderTop: '1px solid rgba(15,23,42,0.06)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 inline-flex items-center justify-center rounded-2xl py-3 text-[13px] font-semibold text-slate-700 active:scale-[0.98] transition-transform"
                        style={{ background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.06)' }}
                    >
                        {t('dashboard.bulkModal.cancel')}
                    </button>
                    {step === 1 && (
                        <button
                            type="button"
                            onClick={handleParseAndValidate}
                            disabled={!file}
                            className="flex-[1.4] inline-flex items-center justify-center rounded-2xl py-3 text-[13px] font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                            style={{
                                background: file
                                    ? 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)'
                                    : 'linear-gradient(135deg, #14141C 0%, #0B0B11 100%)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                boxShadow: file
                                    ? '0 14px 30px -12px rgba(255,107,53,0.45)'
                                    : '0 14px 30px -14px rgba(11,11,15,0.55)'
                            }}
                        >
                            {t('dashboard.bulkModal.nextReview')}
                        </button>
                    )}
                    {step === 2 && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="flex-[1.4] inline-flex items-center justify-center rounded-2xl py-3 text-[13px] font-semibold text-white active:scale-[0.98] transition-transform"
                            style={{
                                background: 'linear-gradient(135deg, #FF8456 0%, #FF6B35 100%)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                boxShadow: '0 14px 30px -12px rgba(255,107,53,0.45)'
                            }}
                        >
                            {t('dashboard.bulkModal.confirmUpload')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkUploadModal;