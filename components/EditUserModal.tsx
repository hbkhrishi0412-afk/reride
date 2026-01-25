import React, { useState, useEffect } from 'react';
import type { User } from '../types.js';

interface EditUserModalProps {
    user: User;
    onClose: () => void;
    onSave: (email: string, details: Partial<User>) => void;
    onVerifyDocument?: (email: string, documentType: 'aadharCard' | 'panCard', verified: boolean) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave, onVerifyDocument }) => {
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        role: 'customer' as User['role'],
    });
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                mobile: user.mobile,
                role: user.role,
            });
        }
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordReset = async () => {
        setPasswordError('');
        if (!newPassword || newPassword.length < 6) {
            setPasswordError('Password must be at least 6 characters long');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }
        setIsResetting(true);
        try {
            // Update password in localStorage
            const users = JSON.parse(localStorage.getItem('reRideUsers') || '[]');
            const updatedUsers = users.map((u: User) => 
                u.email === user.email ? { ...u, password: newPassword } : u
            );
            localStorage.setItem('reRideUsers', JSON.stringify(updatedUsers));
            
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordReset(false);
            alert(`Password reset successfully for ${user.email}`);
        } catch (error) {
            setPasswordError('Failed to reset password');
            console.error('Password reset error:', error);
        } finally {
            setIsResetting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(user.email, formData);
    };

    if (!user) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 md:p-8 lg:p-12 animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} aria-hidden="true"></div>
            <div className="relative bg-white rounded-[24px] shadow-2xl w-full max-w-3xl overflow-hidden transform transition-transform animate-scale-in">
                <header className="bg-gradient-to-r from-orange-500 via-orange-400 to-orange-300 text-white px-8 py-6 flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] font-semibold opacity-80">Edit User</p>
                        <h2 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight">
                            {user.name}
                        </h2>
                        <p className="text-xs md:text-sm opacity-80 mt-1">{user.email}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white text-2xl hover:text-orange-100 transition-colors ml-4"
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </header>
                <form onSubmit={handleSubmit}>
                    <div className="max-h-[70vh] overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar">
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 transition shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                    Mobile Number
                                </label>
                                <input
                                    type="tel"
                                    name="mobile"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 transition shadow-sm"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                    Role
                                </label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 transition shadow-sm bg-white"
                                >
                                    <option value="customer">Customer</option>
                                    <option value="seller">Seller</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                                    Email (Read Only)
                                </label>
                                <input
                                    type="email"
                                    value={user.email}
                                    disabled
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed shadow-sm"
                                />
                            </div>
                        </section>

                        <div className="flex justify-between items-center mb-4">
                           <h2 className="text-xl font-bold text-reride-text-dark dark:text-reride-text-dark">Edit User: {user.name}</h2>
                           <button type="button" onClick={onClose} className="text-reride-text-dark dark:text-reride-text-dark text-2xl hover:text-reride-text-dark dark:hover:text-reride-text-dark">&times;</button>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Email (Cannot be changed)</label>
                                <input type="email" value={user.email} disabled className="mt-1 block w-full p-2 border rounded-md bg-white dark:bg-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Full Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Mobile Number</label>
                                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Role</label>
                                <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full p-2 border rounded-md">
                                    <option value="customer">Customer</option>
                                    <option value="seller">Seller</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                        </div>
                        
                        {/* Password Reset Section */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Password Management</h3>
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowPasswordReset(!showPasswordReset);
                                        setPasswordError('');
                                        setNewPassword('');
                                        setConfirmPassword('');
                                    }}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    {showPasswordReset ? 'Cancel' : 'Reset Password'}
                                </button>
                            </div>
                            
                            {showPasswordReset && (
                                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                                    <div>
                                        <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">
                                            New Password
                                        </label>
                                        <input 
                                            type="password" 
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="Enter new password (min 6 characters)"
                                            className="mt-1 block w-full p-2 border rounded-md"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-1">
                                            Confirm Password
                                        </label>
                                        <input 
                                            type="password" 
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            placeholder="Confirm new password"
                                            className="mt-1 block w-full p-2 border rounded-md"
                                        />
                                    </div>
                                    {passwordError && (
                                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                                            {passwordError}
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handlePasswordReset}
                                        disabled={isResetting}
                                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isResetting ? 'Resetting...' : 'Reset Password'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Verification Status Section */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-4">Verification Status</h3>
                            
                            <div className="space-y-3">
                                {/* Phone Verification */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <span className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Phone Verification</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            user.verificationStatus?.phoneVerified || user.phoneVerified
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {user.verificationStatus?.phoneVerified || user.phoneVerified ? 'Verified' : 'Not Verified'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newStatus = !(user.verificationStatus?.phoneVerified || user.phoneVerified);
                                                onSave(user.email, {
                                                    verificationStatus: {
                                                        ...(user.verificationStatus || {}),
                                                        phoneVerified: newStatus
                                                    },
                                                    phoneVerified: newStatus
                                                });
                                            }}
                                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                                user.verificationStatus?.phoneVerified || user.phoneVerified
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        >
                                            {user.verificationStatus?.phoneVerified || user.phoneVerified ? 'Mark Unverified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>

                                {/* Email Verification */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <span className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Email Verification</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            user.verificationStatus?.emailVerified || user.emailVerified
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {user.verificationStatus?.emailVerified || user.emailVerified ? 'Verified' : 'Not Verified'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newStatus = !(user.verificationStatus?.emailVerified || user.emailVerified);
                                                onSave(user.email, {
                                                    verificationStatus: {
                                                        ...(user.verificationStatus || {}),
                                                        emailVerified: newStatus
                                                    },
                                                    emailVerified: newStatus
                                                });
                                            }}
                                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                                user.verificationStatus?.emailVerified || user.emailVerified
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        >
                                            {user.verificationStatus?.emailVerified || user.emailVerified ? 'Mark Unverified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>

                                {/* ID Verification */}
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                                        </svg>
                                        <span className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">ID Verification</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                            user.verificationStatus?.govtIdVerified || user.govtIdVerified
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {user.verificationStatus?.govtIdVerified || user.govtIdVerified ? 'Verified' : 'Not Verified'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newStatus = !(user.verificationStatus?.govtIdVerified || user.govtIdVerified);
                                                onSave(user.email, {
                                                    verificationStatus: {
                                                        ...(user.verificationStatus || {}),
                                                        govtIdVerified: newStatus
                                                    },
                                                    govtIdVerified: newStatus
                                                });
                                            }}
                                            className={`px-3 py-1 text-xs rounded-md transition-colors ${
                                                user.verificationStatus?.govtIdVerified || user.govtIdVerified
                                                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                                            }`}
                                        >
                                            {user.verificationStatus?.govtIdVerified || user.govtIdVerified ? 'Mark Unverified' : 'Verify'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Document Verification Section */}
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <h3 className="text-sm font-medium text-reride-text-dark dark:text-reride-text-dark mb-4">Document Verification</h3>
                            
                            {/* Aadhar Card Verification */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">Aadhar Card</label>
                                    {user.aadharCard?.isVerified ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            Pending
                                        </span>
                                    )}
                                </div>
                                {user.aadharCard?.number && (
                                    <p className="text-xs text-gray-600 mb-2">Number: {user.aadharCard.number}</p>
                                )}
                                {user.aadharCard?.documentUrl && (
                                    <div className="mb-2">
                                        <a 
                                            href={user.aadharCard.documentUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                                        >
                                            View Document
                                        </a>
                                    </div>
                                )}
                                {onVerifyDocument && (
                                    <button
                                        type="button"
                                        onClick={() => onVerifyDocument(user.email, 'aadharCard', !user.aadharCard?.isVerified)}
                                        className={`mt-2 px-3 py-1 text-xs rounded-md ${
                                            user.aadharCard?.isVerified
                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                    >
                                        {user.aadharCard?.isVerified ? 'Mark as Unverified' : 'Verify Document'}
                                    </button>
                                )}
                            </div>

                            {/* PAN Card Verification */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-reride-text-dark dark:text-reride-text-dark">PAN Card</label>
                                    {user.panCard?.isVerified ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Verified
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                            Pending
                                        </span>
                                    )}
                                </div>
                                {user.panCard?.number && (
                                    <p className="text-xs text-gray-600 mb-2">Number: {user.panCard.number}</p>
                                )}
                                {user.panCard?.documentUrl && (
                                    <div className="mb-2">
                                        <a 
                                            href={user.panCard.documentUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                                        >
                                            View Document
                                        </a>
                                    </div>
                                )}
                                {onVerifyDocument && (
                                    <button
                                        type="button"
                                        onClick={() => onVerifyDocument(user.email, 'panCard', !user.panCard?.isVerified)}
                                        className={`mt-2 px-3 py-1 text-xs rounded-md ${
                                            user.panCard?.isVerified
                                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                        }`}
                                    >
                                        {user.panCard?.isVerified ? 'Mark as Unverified' : 'Verify Document'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="bg-white px-6 py-3 flex justify-end gap-4 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white-dark text-reride-text-dark rounded-md hover:bg-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 btn-brand-primary text-white rounded-md">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;
