import React, { useState, useCallback } from 'react';
import type { VehicleData } from '../types';
import type { VehicleMake, VehicleModel } from '../vehicleDataTypes';
import { VEHICLE_DATA } from './vehicleData';

interface BulkUploadModalProps {
    onClose: () => void;
    onUpdateData: (newData: VehicleData) => void | Promise<void>;
}

// Robust delimited-text parser (CSV / Excel "CSV" with ; or tab): quoted fields, escaped quotes,
// embedded delimiters, and CRLF. Production CSP blocks third-party script CDNs, so Excel uses
// the bundled `xlsx` package instead of loading SheetJS from a CDN.
const parseDelimitedText = (input: string, delimiter: ',' | ';' | '\t' = ','): string[][] => {
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
        if (ch === delimiter) {
            row.push(current);
            current = '';
            continue;
        }
        if (ch === '\r') {
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

    if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
    }

    return rows.filter(r => r.some(cell => cell && cell.trim().length > 0));
};

const getFirstNonEmptyLine = (input: string): string => {
    const text = input.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (line.trim()) return line;
    }
    return '';
};

/** Excel in many locales exports CSV with `;` instead of `,`. */
const detectDelimiterFromText = (input: string): ',' | ';' | '\t' => {
    const line = getFirstNonEmptyLine(input);
    if (!line) return ',';
    let inQuotes = false;
    const counts = { ',': 0, ';': 0, '\t': 0 };
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                i++;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes) {
            if (ch === ',') counts[',']++;
            else if (ch === ';') counts[';']++;
            else if (ch === '\t') counts['\t']++;
        }
    }
    if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';'] && counts['\t'] > 0) return '\t';
    if (counts[';'] > counts[',']) return ';';
    return ',';
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

// Extract rows from Excel using bundled SheetJS (avoids CSP blocking a CDN script on reride.co.in).
const extractRowsFromExcel = async (file: File): Promise<string[][]> => {
    const XLSX = await import('xlsx');
    const buffer = await readFileAsArrayBuffer(file);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as unknown[][];
    return rows.map(r => (Array.isArray(r) ? r : []).map(cell => (cell == null ? '' : String(cell))));
};

interface ParseResult {
    data: VehicleData;
    rowCount: number;
    skipped: number;
    warnings: string[];
}

type ColumnIndices = { idxCategory: number; idxMake: number; idxModel: number; idxVariant: number };

/** Map header cell text to canonical column, or null if unrecognized. */
const headerCellToField = (cell: string): 'category' | 'make' | 'model' | 'variant' | null => {
    const n = (cell || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (n === 'category' || n === 'categories' || n === 'vehicle category') return 'category';
    if (n === 'make' || n === 'brand' || n === 'manufacturer' || n === 'oem') return 'make';
    if (n === 'model') return 'model';
    if (n === 'variant' || n === 'variants' || n === 'trim' || n === 'version') return 'variant';
    return null;
};

const resolveColumnIndicesFromHeaderRow = (cells: string[]): ColumnIndices | null => {
    const fields: Partial<Record<'category' | 'make' | 'model' | 'variant', number>> = {};
    cells.forEach((cell, colIdx) => {
        const f = headerCellToField(cell);
        if (f && fields[f] === undefined) {
            fields[f] = colIdx;
        }
    });
    const { category, make, model, variant } = fields as Record<string, number | undefined>;
    if (category === undefined || make === undefined || model === undefined) {
        return null;
    }
    return {
        idxCategory: category,
        idxMake: make,
        idxModel: model,
        idxVariant: variant !== undefined ? variant : -1,
    };
};

const findHeaderRowAndIndices = (rows: string[][]): { headerRow: number; indices: ColumnIndices } => {
    const maxScan = Math.min(40, rows.length);
    for (let h = 0; h < maxScan; h++) {
        const indices = resolveColumnIndicesFromHeaderRow(rows[h]);
        if (indices) {
            return { headerRow: h, indices };
        }
    }
    const preview = rows
        .slice(0, 5)
        .map((r, i) => `Row ${i + 1}: ${r.map(c => (c || '').trim()).join(' | ')}`)
        .join('\n');
    throw new Error(
        'Could not find a header row with columns category, make, and model (aliases: brand, manufacturer for make; variant/trim optional). ' +
            'Put those headers on one row — Excel title rows above the table are OK.\n\n' +
            `First rows in file:\n${preview || '(empty)'}`,
    );
};

const buildVehicleDataFromRows = (rows: string[][]): ParseResult => {
    if (rows.length < 1) {
        throw new Error('File is empty.');
    }

    const { headerRow, indices } = findHeaderRowAndIndices(rows);
    const { idxCategory, idxMake, idxModel, idxVariant } = indices;
    const dataRows = rows.slice(headerRow + 1);

    const newData: VehicleData = {};
    const warnings: string[] = [];
    let skipped = 0;
    let rowCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const pad = (idx: number) => (row[idx] != null ? String(row[idx]) : '').trim();
        const category = pad(idxCategory);
        const make = pad(idxMake);
        const model = pad(idxModel);
        const variant = idxVariant >= 0 ? pad(idxVariant) : '';
        const fileRowNumber = headerRow + i + 2;

        if (!category && !make && !model) {
            continue;
        }

        if (!category || !make || !model) {
            skipped++;
            if (warnings.length < 5) {
                warnings.push(`Row ${fileRowNumber}: missing category/make/model — skipped.`);
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
                const delimiter = detectDelimiterFromText(text);
                rows = parseDelimitedText(text, delimiter);
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
                                Required columns: <code>category</code>, <code>make</code> (or <code>brand</code>), <code>model</code>. Optional: <code>variant</code>. Headers are case-insensitive; the header row can be below a title row; CSV may use comma or semicolon separators (Excel regional export).
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
