import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Store, Lock, Check, Zap, Map, Palette, Crown, Coins, User } from 'lucide-react';

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

    const [activeTab, setActiveTab] = useState<'Characters' | 'Maps' | 'Colors' | 'VIP' | 'Coins'>('Characters');

    // Expanded mock items
    const [items] = useState([
        { id: 'char_pharaoh', name: 'Pharaoh', tab: 'Characters', price: 1000, icon: '👑' },
        { id: 'char_bot', name: 'Robot', tab: 'Characters', price: 500, icon: '🤖' },
        { id: 'char_ninja', name: 'Ninja', tab: 'Characters', price: 1500, icon: '🥷' },

        { id: 'map_mars', name: 'Mars Colony', tab: 'Maps', price: 2000, icon: '🪐' },
        { id: 'map_egypt', name: 'Ancient Egypt', tab: 'Maps', price: 2500, icon: '🏜️' },

        { id: 'color_neon_pink', name: 'Neon Pink', tab: 'Colors', price: 300, icon: '💗' },
        { id: 'color_gold_rush', name: 'Gold Rush', tab: 'Colors', price: 800, icon: '💛' },

        { id: 'vip_pass_monthly', name: 'VIP Pass (30 Days)', tab: 'VIP', price: 5000, icon: '🌟' }
    ]);

    const coinPacks = [
        { id: 'coins_sm', name: 'Handful of Coins', amount: 500, price: '$0.99', icon: '💰' },
        { id: 'coins_md', name: 'Bag of Coins', amount: 3000, price: '$4.99', icon: '💰' },
        { id: 'coins_lg', name: 'Chest of Coins', amount: 10000, price: '$9.99', icon: '💎' },
    ];

    const tabs = [
        { id: 'Characters', icon: <User size={16} /> },
        { id: 'Maps', icon: <Map size={16} /> },
        { id: 'Colors', icon: <Palette size={16} /> },
        { id: 'VIP', icon: <Crown size={16} /> },
        { id: 'Coins', icon: <Coins size={16} /> },
    ] as const;

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

                        {/* Tabs */}
                        <div className="flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-2">
                            {tabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                        ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                        }`}
                                >
                                    {tab.icon} {tab.id}
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {activeTab === 'Coins' ? (
                                coinPacks.map(pack => (
                                    <div key={pack.id} className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/30 p-4 rounded-2xl flex items-center gap-4 hover:shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all">
                                        <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center text-3xl shrink-0">
                                            {pack.icon}
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="font-bold text-lg leading-tight mb-1 text-yellow-400">+{pack.amount} Coins</div>
                                            <div className="text-sm text-gray-400 font-medium">{pack.name}</div>
                                        </div>
                                        <button
                                            onClick={() => alert('Real money purchases are disabled in this demo.')}
                                            className="flex flex-col items-center justify-center w-20 h-16 bg-green-500 hover:bg-green-400 text-white rounded-xl font-bold transition-colors shadow-lg"
                                        >
                                            <span className="text-lg">{pack.price}</span>
                                        </button>
                                    </div>
                                ))
                            ) : (
                                items.filter(item => item.tab === activeTab).map(item => {
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
                                                <div className="text-xs text-purple-400 font-bold uppercase tracking-wider mb-1">{item.tab}</div>
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
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
