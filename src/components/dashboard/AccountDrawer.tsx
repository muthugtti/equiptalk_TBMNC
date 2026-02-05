"use client";

import React, { useState, useEffect } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';

interface AccountDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AccountDrawer({ isOpen, onClose }: AccountDrawerProps) {
    const [appearance, setAppearance] = useState<'dark' | 'light'>('dark');
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, []);

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            onClose(); // Close drawer after sign out (optional, or redirect)
            // You might want to redirect to login page here if not handled by a protected route wrapper
            window.location.href = '/login';
        } catch (error) {
            console.error("Error signing out:", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            {/* Drawer Panel */}
            <div className="relative w-full max-w-sm bg-white shadow-2xl animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="relative h-32 bg-[#1a1f37] rounded-bl-[2rem] rounded-br-[2rem]">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>

                    {/* Centered Avatar Overlapping Header */}
                    <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                        <div className="h-20 w-20 rounded-full border-4 border-white bg-white overflow-hidden shadow-lg">
                            <img
                                src={user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuDpqhkUII6imYBNXQ_tC2fVKezNp9wBFqvFKWZvIhM_BFwQ2v2rbOxLDwXg9-pApQa-Xr_ZTGqBhDZvE8NSqMCLEVhYtEjpc7InGuODI61zdPPe_Dp4fNbfbteoFyDIBxur57u7sxMvSHjoIGBPyWaNvOghhiVUSffuiDBLMjt9o8CpQ7zfywwVsylwifsbuu4Dxm0wkrvRQtckxgVqRiZf2cv1ja_7dWfCPMakrbgYR7x23kPUUe7IlSpQidVobor3hJJjW1ftSp32"}
                                alt="Profile"
                                className="h-full w-full object-cover"
                            />
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="mt-14 px-6 text-center">

                    {/* User Info */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900">{user?.displayName || "Guest User"}</h2>
                        <div className="flex items-center justify-center gap-2 mt-1 text-gray-500 text-sm font-medium">
                            <span className="material-symbols-outlined text-lg">work</span>
                            <span>Equiptalk - User</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-1 text-gray-500 text-sm cursor-pointer hover:text-primary transition-colors">
                            <span>{user?.email || "No email"}</span>
                            <span className="material-symbols-outlined text-base">content_copy</span>
                        </div>
                    </div>

                    {/* IDs Section */}
                    <div className="flex items-center justify-between border-t border-b border-gray-100 py-4 mb-6">
                        <div className="flex-1 text-center border-r border-gray-100 px-2">
                            <p className="text-xs text-gray-500 mb-1">Equiptalk User ID</p>
                            <p className="font-bold text-gray-900 text-sm">823229538</p>
                        </div>
                        <div className="flex-1 text-center px-2">
                            <p className="text-xs text-gray-500 mb-1">Organization ID</p>
                            <p className="font-bold text-gray-900 text-sm">774056691</p>
                        </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-6 mb-6">
                        <button className="flex-1 flex items-center justify-center gap-2 text-primary font-medium text-sm hover:underline border-r border-gray-100">
                            <span className="material-symbols-outlined text-xl">person</span>
                            My Account
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="flex-1 flex items-center justify-center gap-2 text-red-500 font-medium text-sm hover:underline"
                        >
                            <span className="material-symbols-outlined text-xl">logout</span>
                            Sign Out
                        </button>
                    </div>

                    {/* Subscription */}
                    <div className="border border-dashed border-gray-200 rounded-lg p-4 mb-6 text-left">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-bold text-gray-900">Plan : Enterprise</span>
                        </div>
                        <button className="text-sm text-primary font-medium hover:underline">
                            Manage Subscription
                        </button>
                    </div>

                    {/* Appearance */}
                    <div className="text-left">
                        <p className="text-sm font-bold text-gray-900 mb-3">Appearance</p>
                        <div className="flex gap-4">
                            {/* Dark Mode Option */}
                            <button
                                onClick={() => setAppearance('dark')}
                                className={`flex-1 flex flex-col gap-2 p-2 rounded-lg border-2 transition-all ${appearance === 'dark' ? 'border-primary bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="w-full aspect-video bg-[#1a1f37] rounded border border-gray-700 relative overflow-hidden">
                                    {/* Simple visual representation of dark mode side menu */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1/4 bg-[#0f1222] border-r border-gray-700"></div>
                                </div>
                                <div className="flex items-center gap-2 justify-center w-full">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${appearance === 'dark' ? 'border-primary bg-primary' : 'border-gray-400'}`}>
                                        {appearance === 'dark' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                    </div>
                                    <span className="text-xs font-medium text-gray-900">Dark</span>
                                </div>
                            </button>

                            {/* Light Mode Option */}
                            <button
                                onClick={() => setAppearance('light')}
                                className={`flex-1 flex flex-col gap-2 p-2 rounded-lg border-2 transition-all ${appearance === 'light' ? 'border-primary bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}
                            >
                                <div className="w-full aspect-video bg-white rounded border border-gray-200 relative overflow-hidden">
                                    {/* Simple visual representation of light mode side menu */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1/4 bg-gray-50 border-r border-gray-200"></div>
                                </div>
                                <div className="flex items-center gap-2 justify-center w-full">
                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${appearance === 'light' ? 'border-primary bg-primary' : 'border-gray-400'}`}>
                                        {appearance === 'light' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                    </div>
                                    <span className="text-xs font-medium text-gray-900">Light</span>
                                </div>
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
