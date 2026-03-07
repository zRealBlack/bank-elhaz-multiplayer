import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Store, Lock, Check } from 'lucide-react';

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
    userProfile: any;
    userToken: string | null;
    setUserProfile: React.Dispatch<React.SetStateAction<any>>;
}

export const ShopModal: React.FC<ShopModalProps> = ({ isOpen, onClose, userProfile, userToken, setUserProfile }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [errorText, setErrorText] = useState("");

    // Hardcoded items for now
    const [items] = useState([
        { id: 'char_pharaoh', name: 'Pharaoh', type: 'Character', price: 1000, icon: '👑' },
        { id: 'char_bot', name: 'Robot', type: 'Character', price: 500, icon: '🤖' },
        { id: 'map_mars', name: 'Mars Colony', type: 'Map', price: 2000, icon: '🪐' },
    ]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-[#1a1c24] border border-white/10 p-8 rounded-3xl max-w-2xl w-full relative shadow-2xl flex flex-col max-h-[80vh]">
                        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10">
                            <X size={24} />
                        </button>

                        <div className="text-center mb-6">
                            <Store size={48} className="text-purple-400 mx-auto mb-4" />
                            <h2 className="text-3xl font-black mb-2 tracking-tighter">Item Shop</h2>
                            <p className="text-gray-400 font-medium">Use your coins to unlock exclusive cosmetics!</p>
                            <div className="mt-4 inline-flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-yellow-500/30">
                                <span className="text-yellow-500 font-bold">Balance:</span>
                                <span className="font-mono text-white text-lg">{userProfile?.coins || 0} Coins</span>
                            </div>
                            {errorText && <div className="text-red-500 text-sm mt-2 font-bold">{errorText}</div>}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {items.map(item => {
                                const isOwned = userProfile?.unlocks?.some((u: any) => u.itemId === item.id);
                                const handleBuy = async () => {
                                    if (!userToken) return setErrorText("You must log in to buy items.");
                                    setIsLoading(true);
                                    setErrorText("");
                                    try {
                                        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"}/api/shop/buy`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ token: userToken, itemId: item.id, price: item.price })
                                        });
                                        const data = await res.json();
                                        if (data.error) setErrorText(data.error);
                                        else if (data.user) setUserProfile(data.user);
                                    } catch (e) {
                                        setErrorText("Failed to purchase item.");
                                    } finally {
                                        setIsLoading(false);
                                    }
                                };

                                return (
                                    <div key={item.id} className={`bg-white/5 border ${isOwned ? 'border-green-500/50' : 'border-white/10'} p-4 rounded-2xl flex items-center gap-4 hover:bg-white/10 transition-colors`}>
                                        <div className="w-16 h-16 bg-black/40 rounded-xl flex items-center justify-center text-3xl shrink-0">
                                            {item.icon}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-1">{item.type}</div>
                                            <div className="font-bold text-lg leading-tight mb-1">{item.name}</div>
                                        </div>
                                        {isOwned ? (
                                            <button disabled className="flex flex-col items-center justify-center w-20 h-16 bg-green-500/20 text-green-400 rounded-xl font-bold border border-green-500/30">
                                                <Check size={16} className="mb-1" />
                                                <span className="text-xs uppercase">Owned</span>
                                            </button>
                                        ) : (
                                            <button onClick={handleBuy} disabled={isLoading} className="flex flex-col items-center justify-center w-20 h-16 bg-matte-blue-deep hover:bg-matte-blue-mid rounded-xl font-bold border border-white/10 transition-colors disabled:opacity-50">
                                                <Lock size={16} className="text-gray-400 mb-1" />
                                                <span className="text-sm font-mono text-yellow-400">{item.price}</span>
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
