import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Store, Lock, Check, Zap, Map, Palette, Crown, Coins, User, ArrowLeft } from 'lucide-react';

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
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 min-h-screen overflow-y-auto bg-gradient-to-br from-matte-blue-deep to-matte-black text-white p-6 flex flex-col font-sans">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-8">
                        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 px-6 py-3 rounded-full flex items-center gap-3 font-bold transition-colors">
                            <ArrowLeft size={20} /> Back to Lobby
                        </button>

                        <div className="bg-matte-blue-deep/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full flex items-center gap-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                            <span className="text-yellow-500 font-bold uppercase tracking-widest text-sm">Balance</span>
                            <Coins className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" size={20} />
                            <span className="font-mono font-black text-white text-xl">{userProfile?.coins || 0}</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full">
                        <div className="text-center mb-10">
                            <Store size={64} className="text-purple-400 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                            <h2 className="text-5xl font-black mb-3 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">Item Shop</h2>
                            <p className="text-gray-400 text-lg font-medium">Unlock exclusive cosmetics, characters, and maps to flex on your opponents!</p>
                            {errorText && <div className="text-red-500 text-sm mt-4 font-bold bg-red-500/10 inline-block px-4 py-2 rounded-lg border border-red-500/20">{errorText}</div>}
                        </div>

                        {/* Tabs */}
                        <div className="flex justify-center gap-3 mb-8 overflow-x-auto custom-scrollbar pb-4">
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

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 content-start pb-20">
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
                                        <div key={item.id} className={`bg-white/5 border ${isOwned ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-white/10'} p-6 rounded-3xl flex flex-col items-center gap-4 hover:bg-white/10 hover:-translate-y-1 transition-all`}>
                                            <div className="w-24 h-24 bg-black/40 rounded-2xl flex items-center justify-center text-5xl shrink-0 shadow-inner">
                                                {item.icon}
                                            </div>
                                            <div className="text-center w-full">
                                                <div className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">{item.tab}</div>
                                                <div className="font-black text-xl leading-tight mb-4">{item.name}</div>
                                            </div>
                                            <div className="mt-auto w-full">
                                                {isOwned ? (
                                                    <button disabled className="w-full flex items-center justify-center gap-2 py-3 bg-green-500/20 text-green-400 rounded-xl font-bold border border-green-500/30">
                                                        <Check size={18} />
                                                        <span className="uppercase tracking-widest">Owned</span>
                                                    </button>
                                                ) : (
                                                    <button onClick={handleBuy} disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-3 bg-matte-blue-light/10 hover:bg-matte-blue-light hover:text-matte-blue-deep rounded-xl font-bold border border-matte-blue-light/30 transition-all disabled:opacity-50">
                                                        <Lock size={16} className={isLoading ? "animate-pulse" : ""} />
                                                        <span className="font-mono text-lg">{item.price}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
