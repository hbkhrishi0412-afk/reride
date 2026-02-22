import React, { useState, useCallback } from 'react';
import type { User, SubscriptionPlan } from '../types';

interface ImportUsersModalProps {
    onClose: () => void;
    onImportUsers: (users: Omit<User, 'id' | 'firebaseUid'>[]) => Promise<void>;
}

// Enhanced CSV parser that handles quoted values and commas within fields
const parseCSV = (csvText: string): Record<string, string>[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    // Parse header row
    const headers = parseCSVLine(lines[0]);
    const rows: Record<string, string>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const row = headers.reduce((acc, header, index) => {
                acc[header.trim()] = values[index]?.trim() || '';
                return acc;
            }, {} as Record<string, string>);
            rows.push(row);
        }
    }
    return rows;
};

// Parse a single CSV line, handling quoted values
const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current); // Add last field
    return result;
};

// Required fields for user import
const REQUIRED_FIELDS = ['name', 'email', 'role', 'mobile'];

// CSV Template Content
const CSV_TEMPLATE = `name,email,role,mobile,status,location,dealershipName,bio,subscriptionPlan,isVerified,phoneVerified,emailVerified
John Doe,john.doe@example.com,customer,9876543210,active,Mumbai,,,free,false,false,false
Prestige Motors,prestige@example.com,seller,9876543211,active,Mumbai,Prestige Motors,"Premium car dealership",premium,true,true,true
Admin User,admin@example.com,admin,9876543212,active,Mumbai,,,free,true,true,true
`;

const ImportUsersModal: React.FC<ImportUsersModalProps> = ({ onClose, onImportUsers }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<Omit<User, 'id' | 'firebaseUid'>[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
    const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setErrors([]);
            setParsedData([]);
            setImportResults(null);
        }
    };

    const handleParseAndValidate = useCallback(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const jsonData = parseCSV(text);
                const validationErrors: string[] = [];
                const validUsers: Omit<User, 'id' | 'firebaseUid'>[] = [];

                if (jsonData.length === 0) {
                    setErrors(['CSV file is empty or invalid.']);
                    return;
                }

                jsonData.forEach((row, index) => {
                    const rowNum = index + 2; // +2 because row 1 is header
                    let hasError = false;
                    
                    // Check required fields
                    for (const field of REQUIRED_FIELDS) {
                        if (!row[field] || row[field].trim() === '') {
                            validationErrors.push(`Row ${rowNum}: Missing required field '${field}'.`);
                            hasError = true;
                        }
                    }

                    if (hasError) return;

                    // Validate email format
                    const email = row.email.trim().toLowerCase();
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(email)) {
                        validationErrors.push(`Row ${rowNum}: Invalid email format '${email}'.`);
                        hasError = true;
                    }

                    // Validate role
                    const role = row.role.trim().toLowerCase();
                    if (!['customer', 'seller', 'admin'].includes(role)) {
                        validationErrors.push(`Row ${rowNum}: Invalid role '${role}'. Must be: customer, seller, or admin.`);
                        hasError = true;
                    }

                    // Validate status
                    const status = row.status?.trim().toLowerCase() || 'active';
                    if (!['active', 'inactive'].includes(status)) {
                        validationErrors.push(`Row ${rowNum}: Invalid status '${status}'. Must be: active or inactive.`);
                        hasError = true;
                    }

                    // Validate subscription plan if provided
                    const subscriptionPlan = row.subscriptionPlan?.trim().toLowerCase() || 'free';
                    const validPlans = ['free', 'basic', 'premium', 'enterprise'];
                    if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
                        validationErrors.push(`Row ${rowNum}: Invalid subscription plan '${subscriptionPlan}'. Must be one of: ${validPlans.join(', ')}.`);
                        hasError = true;
                    }

                    if (hasError) return;

                    // Create user object
                    const now = new Date().toISOString();
                    const newUser: Omit<User, 'id' | 'firebaseUid'> = {
                        name: row.name.trim(),
                        email: email,
                        mobile: row.mobile.trim(),
                        role: role as 'customer' | 'seller' | 'admin',
        location: row.location?.trim() || 'Mumbai',
                        status: status as 'active' | 'inactive',
                        createdAt: row.createdAt?.trim() || now,
                        joinedDate: row.joinedDate?.trim() || now,
                        dealershipName: row.dealershipName?.trim(),
                        bio: row.bio?.trim(),
                        subscriptionPlan: (subscriptionPlan === 'basic' ? 'free' : subscriptionPlan === 'enterprise' ? 'premium' : subscriptionPlan) as SubscriptionPlan | undefined,
                        isVerified: row.isVerified?.toLowerCase() === 'true' || false,
                        phoneVerified: row.phoneVerified?.toLowerCase() === 'true' || false,
                        emailVerified: row.emailVerified?.toLowerCase() === 'true' || false,
                        featuredCredits: row.featuredCredits ? parseInt(row.featuredCredits, 10) : 0,
                        usedCertifications: row.usedCertifications ? parseInt(row.usedCertifications, 10) : 0,
                        avatarUrl: row.avatarUrl?.trim(),
                        logoUrl: row.logoUrl?.trim(),
                        alternatePhone: row.alternatePhone?.trim(),
                        preferredContactHours: row.preferredContactHours?.trim(),
                        showEmailPublicly: row.showEmailPublicly?.toLowerCase() === 'true' || false,
                    };

                    validUsers.push(newUser);
                });

                setParsedData(validUsers);
                setErrors(validationErrors);
                
                if (validationErrors.length === 0 && validUsers.length > 0) {
                    setStep(2); // Move to confirmation step
                } else if (validUsers.length === 0) {
                    setErrors([...validationErrors, 'No valid users found in CSV file.']);
                }
            } catch (error) {
                setErrors([`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`]);
            }
        };
        reader.onerror = () => {
            setErrors(['Failed to read file. Please try again.']);
        };
        reader.readAsText(file);
    }, [file]);

    const handleImport = async () => {
        if (parsedData.length === 0) return;
        
        setIsImporting(true);
        setImportProgress({ current: 0, total: parsedData.length });
        const importErrors: string[] = [];
        let successCount = 0;
        let failedCount = 0;

        try {
            // Import users in batches to avoid overwhelming the API
            const batchSize = 5;
            for (let i = 0; i < parsedData.length; i += batchSize) {
                const batch = parsedData.slice(i, i + batchSize);
                
                await Promise.allSettled(
                    batch.map(async (user, batchIndex) => {
                        try {
                            await onImportUsers([user]);
                            successCount++;
                        } catch (error) {
                            failedCount++;
                            const rowNum = i + batchIndex + 2;
                            importErrors.push(`Row ${rowNum} (${user.name} - ${user.email}): ${error instanceof Error ? error.message : 'Failed to import'}`);
                        } finally {
                            setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
                        }
                    })
                );
                
                // Small delay between batches to avoid rate limiting
                if (i + batchSize < parsedData.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            setImportResults({
                success: successCount,
                failed: failedCount,
                errors: importErrors
            });
            setStep(3); // Move to results step
        } catch (error) {
            setErrors([`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        } finally {
            setIsImporting(false);
        }
    };

    const downloadTemplate = () => {
        const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'users_import_template.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import Users</h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="p-6">
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Step 1: Upload CSV File</h3>
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="csv-upload"
                                    />
                                    <label
                                        htmlFor="csv-upload"
                                        className="cursor-pointer flex flex-col items-center"
                                    >
                                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="text-gray-700 dark:text-gray-300 font-medium">
                                            {file ? file.name : 'Click to upload CSV file'}
                                        </span>
                                        <span className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                            CSV files only
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={downloadTemplate}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Download Template
                                </button>
                                <button
                                    onClick={handleParseAndValidate}
                                    disabled={!file}
                                    className={`flex-1 px-4 py-2 rounded-lg text-white ${
                                        file
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'bg-gray-400 cursor-not-allowed'
                                    }`}
                                >
                                    Validate & Continue
                                </button>
                            </div>

                            {errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Validation Errors:</h4>
                                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                                        {errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Step 2: Review & Confirm</h3>
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                                <p className="text-blue-800 dark:text-blue-200">
                                    <strong>{parsedData.length}</strong> users ready to import.
                                </p>
                                {errors.length > 0 && (
                                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                                        {errors.length} row(s) had validation errors and were skipped.
                                    </p>
                                )}
                            </div>

                            <div className="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Email</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Mobile</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                        {parsedData.slice(0, 10).map((user, index) => (
                                            <tr key={index}>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{user.name}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{user.email}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    <span className={`px-2 py-1 text-xs rounded ${
                                                        user.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                                        user.role === 'seller' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                                        'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                    }`}>
                                                        {user.role}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{user.mobile}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">
                                                    <span className={`px-2 py-1 text-xs rounded ${
                                                        user.status === 'active' 
                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                                                    }`}>
                                                        {user.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 10 && (
                                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                        ... and {parsedData.length - 10} more users
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setStep(1);
                                        setErrors([]);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={isImporting}
                                    className={`flex-1 px-4 py-2 rounded-lg text-white ${
                                        isImporting
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-green-600 hover:bg-green-700'
                                    }`}
                                >
                                    {isImporting ? `Importing... (${importProgress.current}/${importProgress.total})` : 'Import Users'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && importResults && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Step 3: Import Results</h3>
                            <div className={`border rounded-lg p-4 ${
                                importResults.failed === 0
                                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                            }`}>
                                <p className={`font-semibold ${
                                    importResults.failed === 0
                                        ? 'text-green-800 dark:text-green-200'
                                        : 'text-yellow-800 dark:text-yellow-200'
                                }`}>
                                    Import Complete: {importResults.success} succeeded, {importResults.failed} failed
                                </p>
                            </div>

                            {importResults.errors.length > 0 && (
                                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                    <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Import Errors:</h4>
                                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-y-auto">
                                        {importResults.errors.map((error, index) => (
                                            <li key={index}>{error}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setStep(1);
                                        setFile(null);
                                        setParsedData([]);
                                        setErrors([]);
                                        setImportResults(null);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                >
                                    Import More
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportUsersModal;

