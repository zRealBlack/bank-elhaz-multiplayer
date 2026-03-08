import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, LogOut, Edit2, Check } from 'lucide-react';
import { GoogleLogin, googleLogout } from '@react-oauth/google';

interface AccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: any;
    setUserProfile: React.Dispatch<React.SetStateAction<any>>;
    setUserToken: React.Dispatch<React.SetStateAction<string | null>>;
    userToken: string | null;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, userProfile, setUserProfile, setUserToken, userToken }) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [newNameInput, setNewNameInput] = useState("");
    const [isSaving, setIsSaving] = useState(false);
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
        setIsEditingName(false);
    };

    const handleSaveName = async () => {
        if (!newNameInput.trim() || newNameInput === userProfile.name) {
            setIsEditingName(false);
            return;
        }

        setIsSaving(true);
        try {
            if (!userToken) throw new Error("No user token found");
            const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"}/api/user/name`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: userToken, newName: newNameInput })
            });
            const data = await res.json();
            if (data.user) {
                setUserProfile(data.user);
                setIsEditingName(false);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSaving(false);
        }
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

                                {isEditingName ? (
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <input
                                            type="text"
                                            value={newNameInput}
                                            onChange={(e) => setNewNameInput(e.target.value)}
                                            maxLength={15}
                                            className="bg-black/50 border border-white/20 text-white rounded-lg px-3 py-1 text-center font-bold text-xl outline-none focus:border-blue-500 w-48"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                                        />
                                        <button onClick={handleSaveName} disabled={isSaving} className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-colors">
                                            <Check size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 mb-1 group cursor-pointer" onClick={() => { setIsEditingName(true); setNewNameInput(userProfile.name); }}>
                                        <h2 className="text-2xl font-black">{userProfile.name}</h2>
                                        <Edit2 size={16} className="text-gray-500 group-hover:text-white transition-colors" />
                                    </div>
                                )}

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
