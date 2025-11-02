import React, { useState, useEffect } from 'react';
import type { User } from '../types';

interface EditUserModalProps {
    user: User;
    onClose: () => void;
    onSave: (email: string, details: { name: string; mobile: string; role: User['role'] }) => void;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ user, onClose, onSave }) => {
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6">
                        <div className="flex justify-between items-center mb-4">
                           <h2 className="text-xl font-bold text-spinny-text-dark dark:text-spinny-text-dark">Edit User: {user.name}</h2>
                           <button type="button" onClick={onClose} className="text-spinny-text-dark dark:text-spinny-text-dark text-2xl hover:text-spinny-text-dark dark:hover:text-spinny-text-dark">&times;</button>
                        </div>
                        <div className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Email (Cannot be changed)</label>
                                <input type="email" value={user.email} disabled className="mt-1 block w-full p-2 border rounded-md bg-white dark:bg-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Full Name</label>
                                <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Mobile Number</label>
                                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} required className="mt-1 block w-full p-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Role</label>
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
                                <h3 className="text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark">Password Management</h3>
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
                                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">
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
                                        <label className="block text-sm font-medium text-spinny-text-dark dark:text-spinny-text-dark mb-1">
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
                    </div>
                    <div className="bg-white px-6 py-3 flex justify-end gap-4 rounded-b-lg">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white-dark text-spinny-text-dark rounded-md hover:bg-white">Cancel</button>
                        <button type="submit" className="px-4 py-2 btn-brand-primary text-white rounded-md">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditUserModal;
