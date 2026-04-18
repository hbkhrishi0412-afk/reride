import React, { useState, useCallback } from 'react';
import type { VehicleData } from '../types';
import type { VehicleMake, VehicleModel } from '../vehicleDataTypes';
import { VEHICLE_DATA } from './vehicleData';

interface BulkUploadModalProps {
    onClose: () => void;
    onUpdateData: (newData: VehicleData) => void | Promise<void>;
}

// Robust CSV line parser: handles quoted fields, escaped quotes, embedded commas, and CRLF.
// Returns rows as arrays of strings. Handles entire text (not line-by-line) so quoted fields
// with embedded newlines still work correctly.
const parseCSVText = (input: string): string[][] => {
    // Strip UTF-8 BOM that Excel adds to CSV files
    const text = input.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let current = '';
    let row: string[] = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    // Escaped quote inside quoted field
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === ',') {
            row.push(current);
            current = '';
            continue;
        }
        if (ch === '\r') {
            // Swallow; treat \r\n as single line break
            continue;
        }
        if (ch === '\n') {
            row.push(current);
            rows.push(row);
            row = [];
            current = '';
            continue;
        }
        current += ch;
    }

    // Flush last field / row
    if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
    }

    // Drop completely empty rows
    return rows.filter(r => r.some(cell => cell && cell.trim().length > 0));
};

// Dynamically load SheetJS from CDN on demand so .xlsx / .xls uploads work
// without adding a build-time dependency.
const SHEETJS_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js';
let sheetJsLoadPromise: Promise<any> | null = null;
const loadSheetJS = (): Promise<any> => {
    if (typeof window === 'undefined') return Promise.reject(new Error('Excel parsing is only available in the browser.'));
    const existing = (window as any).XLSX;
    if (existing) return Promise.resolve(existing);
    if (sheetJsLoadPromise) return sheetJsLoadPromise;
    sheetJsLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SHEETJS_CDN;
        script.async = true;
        script.onload = () => {
            const xlsx = (window as any).XLSX;
            if (xlsx) resolve(xlsx);
            else reject(new Error('Failed to initialize Excel parser.'));
        };
        script.onerror = () => {
            sheetJsLoadPromise = null;
            reject(new Error('Failed to load Excel parser. Please check your internet connection or save the file as CSV.'));
        };
        document.head.appendChild(script);
    });
    return sheetJsLoadPromise;
};

const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read the file.'));
        reader.readAsText(file);
    });

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(new Error('Failed to read the file.'));
        reader.readAsArrayBuffer(file);
    });

// Extract rows from an Excel file using SheetJS, returning a CSV-like string[][]
const extractRowsFromExcel = async (file: File): Promise<string[][]> => {
    const xlsx = await loadSheetJS();
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = xlsx.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as any[][];
    return rows.map(r => r.map(cell => (cell == null ? '' : String(cell))));
};

interface ParseResult {
    data: VehicleData;
    rowCount: number;
    skipped: number;
    warnings: string[];
}

const buildVehicleDataFromRows = (rows: string[][]): ParseResult => {
    if (rows.length < 1) {
        throw new Error('File is empty.');
    }

    const rawHeaders = rows[0].map(h => (h || '').trim().toLowerCase());
    const headerIndex = (name: string) => rawHeaders.indexOf(name);

    const idxCategory = headerIndex('category');
    const idxMake = headerIndex('make');
    const idxModel = headerIndex('model');
    const idxVariant = headerIndex('variant');

    const missing: string[] = [];
    if (idxCategory === -1) missing.push('category');
    if (idxMake === -1) missing.push('make');
    if (idxModel === -1) missing.push('model');
    if (missing.length > 0) {
        throw new Error(
            `File must contain the following column headers (case-insensitive): ${missing.join(', ')}. Found headers: ${rawHeaders.join(', ') || '(none)'}.`
        );
    }

    const newData: VehicleData = {};
    const warnings: string[] = [];
    let skipped = 0;
    let rowCount = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const category = (row[idxCategory] || '').trim();
        const make = (row[idxMake] || '').trim();
        const model = (row[idxModel] || '').trim();
        const variant = idxVariant >= 0 ? (row[idxVariant] || '').trim() : '';

        if (!category || !make || !model) {
            skipped++;
            if (warnings.length < 5) {
                warnings.push(`Row ${i + 1}: missing category/make/model — skipped.`);
            }
            continue;
        }

        if (!newData[category]) {
            newData[category] = [];
        }
        let makeObj = newData[category].find((m: VehicleMake) => m.name === make);
        if (!makeObj) {
            makeObj = { name: make, models: [] };
            newData[category].push(makeObj);
        }
        let modelObj = makeObj.models.find((m: VehicleModel) => m.name === model);
        if (!modelObj) {
            modelObj = { name: model, variants: [] };
            makeObj.models.push(modelObj);
        }
        if (variant && !modelObj.variants.includes(variant)) {
            modelObj.variants.push(variant);
        }
        rowCount++;
    }

    if (rowCount === 0) {
        throw new Error('No valid data rows found. Please check that category, make, and model columns are filled in.');
    }

    return { data: newData, rowCount, skipped, warnings };
};

export const VehicleDataBulkUploadModal: React.FC<BulkUploadModalProps> = ({ onClose, onUpdateData }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [parseResult, setParseResult] = useState<ParseResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
            setParseResult(null);
        }
    };

    const handleParseAndValidate = useCallback(async () => {
        if (!file) return;
        setIsParsing(true);
        setError(null);
        try {
            const name = file.name.toLowerCase();
            const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm');

            let rows: string[][];
            if (isExcel) {
                rows = await extractRowsFromExcel(file);
            } else {
                const text = await readFileAsText(file);
                rows = parseCSVText(text);
            }

            if (rows.length < 2) {
                throw new Error('File must contain a header row and at least one data row.');
            }

            const result = buildVehicleDataFromRows(rows);
            setParseResult(result);
            setStep(2);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to parse file.');
            setParseResult(null);
        } finally {
            setIsParsing(false);
        }
    }, [file]);

    const handleConfirm = async () => {
        if (!parseResult) return;
        setIsSaving(true);
        setError(null);
        try {
            await Promise.resolve(onUpdateData(parseResult.data));

            // Invalidate the VehicleList filter cache so the website picks up the
            // new makes/models/variants immediately instead of waiting up to 5 min.
            try {
                localStorage.removeItem('reRideVehicleDataFilters');
            } catch { /* storage unavailable */ }

            // Notify other tabs / listeners in the same tab to refresh their data
            try {
                localStorage.setItem('reRideVehicleData', JSON.stringify(parseResult.data));
                window.dispatchEvent(new CustomEvent('vehicleDataUpdated', {
                    detail: { vehicleData: parseResult.data }
                }));
            } catch { /* storage unavailable */ }

            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save vehicle data. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const downloadTemplate = () => {
        const rows = [['category', 'make', 'model', 'variant']];
        for (const category in VEHICLE_DATA) {
            for (const make of VEHICLE_DATA[category]) {
                for (const model of make.models) {
                    if (model.variants.length > 0) {
                        for (const variant of model.variants) {
                            rows.push([category, make.name, model.name, variant]);
                        }
                    } else {
                        rows.push([category, make.name, model.name, '']);
                    }
                }
            }
        }
        const escape = (value: string) => {
            if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
            return value;
        };
        const csvContent = rows.map(row => row.map(escape).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'vehicle_data_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const totalMakes = parseResult
        ? Object.values(parseResult.data).reduce((acc: number, makes) => acc + (makes as VehicleMake[]).length, 0)
        : 0;
    const totalModels = parseResult
        ? Object.values(parseResult.data).reduce(
            (acc: number, makes) => acc + (makes as VehicleMake[]).reduce((a, m) => a + m.models.length, 0),
            0
        )
        : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b dark:border-gray-200">
                    <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">Bulk Upload Vehicle Data</h2>
                    <p className="text-sm text-reride-text-dark dark:text-reride-text-dark">Upload makes, models, and variants from a CSV or Excel file.</p>
                </div>

                <div className="p-6 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-4 text-center">
                            <h3 className="font-semibold">Step 1: Prepare Your File</h3>
                            <p>Download our template, fill it with your vehicle data, and upload it here. CSV (.csv) and Excel (.xlsx, .xls) files are supported.</p>
                            <button onClick={downloadTemplate} className="font-semibold hover:underline transition-colors" style={{ color: '#FF6B35' }} onMouseEnter={(e) => e.currentTarget.style.color = 'var(--reride-blue)'} onMouseLeave={(e) => e.currentTarget.style.color = 'var(--reride-orange)'}>Download CSV Template</button>
                            <div className="mt-4 p-6 border-2 border-dashed border-gray-200 dark:border-gray-300 rounded-lg">
                                <input
                                    type="file"
                                    accept=".csv,.xlsx,.xls,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-reride-text-dark file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:text-white"
                                    style={{ ['--file-bg' as any]: 'var(--reride-orange)' }}
                                />
                                {file && (
                                    <p className="text-xs text-gray-500 mt-2">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</p>
                                )}
                            </div>
                            <p className="text-xs text-gray-500">
                                Required columns: <code>category</code>, <code>make</code>, <code>model</code>. Optional column: <code>variant</code>. Column order doesn't matter and headers are case-insensitive.
                            </p>
                            {error && <p className="text-red-600 text-sm mt-2 bg-red-50 border border-red-200 rounded-md p-2 text-left whitespace-pre-wrap">{error}</p>}
                        </div>
                    )}
                    {step === 2 && parseResult && (
                        <div className="space-y-4">
                            <h3 className="font-semibold">Step 2: Review and Confirm</h3>
                            <div className="p-4 bg-white rounded-lg text-sm space-y-2 border border-gray-200">
                                <p className="font-bold text-reride-orange dark:text-reride-orange">
                                    {Object.keys(parseResult.data).length} categories · {totalMakes} makes · {totalModels} models · {parseResult.rowCount} data rows.
                                </p>
                                <ul className="text-gray-700 text-xs space-y-1 list-disc list-inside">
                                    {Object.entries(parseResult.data).map(([cat, makes]) => (
                                        <li key={cat}>
                                            <span className="font-semibold">{cat}</span>: {(makes as VehicleMake[]).length} makes
                                        </li>
                                    ))}
                                </ul>
                                {parseResult.skipped > 0 && (
                                    <div className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                                        Skipped {parseResult.skipped} row(s) due to missing required fields.
                                        {parseResult.warnings.length > 0 && (
                                            <ul className="list-disc list-inside text-xs mt-1">
                                                {parseResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                )}
                                <p>This will <span className="font-bold text-reride-orange">overwrite</span> all existing vehicle dropdown data. This action cannot be undone.</p>
                            </div>
                            {error && <p className="text-red-600 text-sm mt-2 bg-red-50 border border-red-200 rounded-md p-2 whitespace-pre-wrap">{error}</p>}
                        </div>
                    )}
                </div>

                <div className="bg-white px-6 py-3 flex justify-end gap-4 rounded-b-lg mt-auto">
                    <button onClick={onClose} disabled={isSaving} className="px-4 py-2 bg-gray-100 dark:bg-white text-reride-text-dark dark:text-reride-text-dark rounded-md hover:bg-white dark:hover:bg-gray-200 disabled:opacity-50">Cancel</button>
                    {step === 1 && (
                        <button
                            onClick={handleParseAndValidate}
                            disabled={!file || isParsing}
                            className="px-4 py-2 btn-brand-primary text-white rounded-md disabled:opacity-50"
                        >
                            {isParsing ? 'Parsing…' : 'Next: Review'}
                        </button>
                    )}
                    {step === 2 && (
                        <button
                            onClick={handleConfirm}
                            disabled={!parseResult || isSaving}
                            className="px-4 py-2 bg-reride-orange text-white rounded-md hover:bg-reride-orange disabled:opacity-50"
                        >
                            {isSaving ? 'Saving…' : 'Confirm & Overwrite'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
