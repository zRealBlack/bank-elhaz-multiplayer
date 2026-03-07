import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, LogOut } from 'lucide-react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: any;
    setUserProfile: React.Dispatch<React.SetStateAction<any>>;
    setUserToken: React.Dispatch<React.SetStateAction<string | null>>;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, userProfile, setUserProfile, setUserToken }) => {
    const handleLoginSuccess = async (credentialResponse: any) => {
        // We will send this credential to the backend to verify and get/create the user profile
        try {
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/google`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: credentialResponse.credential })
            });
            const data = await res.json();
            if (data.user) {
                setUserProfile(data.user);
                setUserToken(credentialResponse.credential);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        googleLogout();
        setUserProfile(null);
        setUserToken(null);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1c24] border border-white/10 p-8 rounded-3xl max-w-md w-full text-center relative shadow-2xl">
                        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                            <X size={24} />
                        </button>

                        {!userProfile ? (
                            <>
                                <User size={64} className="text-blue-400 mx-auto mb-6" />
                                <h2 className="text-3xl font-black mb-2 tracking-tighter">My Account</h2>
                                <p className="text-gray-400 mb-8">Sign in with Google to save your coins and unlocked items securely across all devices.</p>
                                <div className="flex justify-center flex-col items-center">
                                    <GoogleLogin
                                        onSuccess={handleLoginSuccess}
                                        onError={() => console.error('Login Failed')}
                                        theme="filled_black"
                                        shape="pill"
                                        size="large"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {userProfile.picture ? (
                                    <img src={userProfile.picture} alt="Profile" className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-matte-blue-light/50" />
                                ) : (
                                    <User size={64} className="text-blue-400 mx-auto mb-6" />
                                )}
                                <h2 className="text-2xl font-black mb-1">{userProfile.name}</h2>
                                <p className="text-matte-blue-light font-mono text-xl font-bold mb-6">{userProfile.coins} Coins</p>

                                <button onClick={handleLogout} className="w-full py-3 bg-red-500/20 text-red-500 font-bold border border-red-500/30 rounded-full hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
                                    <LogOut size={18} /> Sign Out
                                </button>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
