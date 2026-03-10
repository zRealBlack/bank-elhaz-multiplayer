import React from 'react';
import { motion } from 'motion/react';
import { X, ArrowUp, ArrowDown, Trash2, Home, Building2, Handshake } from 'lucide-react';
import { COLORS } from '../constants';

interface PropertyModalProps {
  property: any;
  owner: any;
  onClose: () => void;
  onUpgrade?: () => void;
  onDowngrade?: () => void;
  onSell?: () => void;
  onMortgage?: () => void;
  isMortgaged?: boolean;
  isCurrentPlayerOwner: boolean;
  canUpgrade: boolean;
  t: any;
  language: "EN" | "AR";
}

const AREA_NAMES: Record<string, { EN: string; AR: string }> = {
  zamalek_giza: { EN: "Zamalek & Giza", AR: "الزمالك والجيزة" },
  sheikh_zayed: { EN: "Sheikh Zayed", AR: "الشيخ زايد" },
  northern_expansions: { EN: "Northern Expansions", AR: "التوسعات الشمالية" },
  sixth_october: { EN: "6th of October", AR: "السادس من أكتوبر" },
  faisal: { EN: "Faisal", AR: "فيصل" },
  haram: { EN: "Al-Haram", AR: "الهرم" },
  mohandeseen: { EN: "Mohandeseen", AR: "المهندسين" },
  boulaq_dakrour: { EN: "Boulaq El-Dakrour", AR: "بولاق الدكرور" },
  dokki_agouza: { EN: "Dokki & Agouza", AR: "الدقي والعجوزة" },
  elmoneeb: { EN: "El-Moneeb", AR: "المنيب" }
};

export const PropertyModal = ({
  property,
  owner,
  onClose,
  onUpgrade,
  onDowngrade,
  onSell,
  onMortgage,
  isMortgaged,
  isCurrentPlayerOwner,
  canUpgrade,
  t,
  language
}: PropertyModalProps) => {
  if (!property) return null;

  const isRTL = language === "AR";
  const tileColor = property.type === "PROPERTY" && property.group ? (COLORS as any)[property.group] : "#87CEEB";
  const currentLevel = property.level || 0;

  const rentRows: { label: string; value: number | string }[] =
    property.type === "PROPERTY" && property.rent ? [
      { label: t.withRent, value: property.rent[0] },
      { label: t.withOneHouse, value: property.rent[1] },
      { label: t.withTwoHouses, value: property.rent[2] },
      { label: t.withThreeHouses, value: property.rent[3] },
      { label: t.withFourHouses, value: property.rent[4] },
      { label: t.withHotel, value: property.rent[5] },
    ] : property.type === "AIRPORT" && property.rent ? [
      { label: language === "AR" ? "مطار واحد" : "1 airport", value: property.rent[0] },
      { label: language === "AR" ? "مطاران" : "2 airports", value: property.rent[1] },
      { label: language === "AR" ? "3 مطارات" : "3 airports", value: property.rent[2] },
      { label: language === "AR" ? "4 مطارات" : "4 airports", value: property.rent[3] },
    ] : property.type === "COMPANY" ? [
      { label: language === "AR" ? "شركة واحدة" : "1 company", value: "dice × 4" },
      { label: language === "AR" ? "الشركتان" : "Both companies", value: "dice × 10" },
    ] : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 28 }}
        className="w-full max-w-xs overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <div
          className="rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-xl"
          style={{
            background: "linear-gradient(160deg, #1a2130ee 0%, #0d1117f5 100%)",
            borderColor: tileColor + "55",
            boxShadow: `0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px ${tileColor}33, 0 0 40px ${tileColor}22`
          }}
        >
          {/* Color bar */}
          {property.group && (
            <div className="h-2 w-full" style={{ backgroundColor: tileColor }} />
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-white/30 hover:text-white transition-colors z-20"
          >
            <X size={18} />
          </button>

          <div className="px-5 pt-4 pb-4">
            {/* Property name and Area name */}
            <div className="text-center mb-4 relative z-10">
              <h3 className="text-xl font-bold text-white tracking-tight">{property.name}</h3>
              {property.group && AREA_NAMES[property.group] && (
                <div className="mt-2 flex justify-center">
                  <div
                    className="px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-widest text-white shadow-sm"
                    style={{
                      backgroundColor: `${tileColor}33`,
                      borderColor: tileColor,
                    }}
                  >
                    {AREA_NAMES[property.group][language]}
                  </div>
                </div>
              )}
              {owner && (
                <div className="flex items-center justify-center gap-2 mt-1.5">
                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: owner.color }} />
                  <span className="text-xs text-white/50 font-medium">{owner.name}</span>
                </div>
              )}
            </div>

            {/* Rent table header */}
            <div className="flex justify-between items-center px-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.when}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.get}</span>
            </div>
            <div className="h-px bg-white/10 mb-2" />

            {/* Rent rows */}
            <div className="space-y-0.5 mb-4">
              {rentRows.map((row, idx) => {
                const isActive = idx === currentLevel;
                return (
                  <div
                    key={idx}
                    className={`flex justify-between items-center px-3 py-1.5 rounded-lg transition-colors ${isActive ? "bg-white/10" : ""}`}
                  >
                    <span className={`text-sm font-medium ${isActive ? "text-white" : "text-white/50"}`}>{row.label}</span>
                    <span className={`text-base font-bold font-mono ${isActive ? "text-white" : "text-white/40"}`}>
                      {typeof row.value === "number" ? (
                        <><span className="text-white/30 text-xs mr-0.5">$</span>{row.value}</>
                      ) : row.value}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action Buttons (Only if owner and current player) */}
            {owner && isCurrentPlayerOwner && (
              <>
                <div className="h-px bg-white/10 mb-3" />
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="relative group/tooltip">
                    <button
                      onClick={onUpgrade}
                      disabled={!canUpgrade}
                      className={`w-10 h-10 flex items-center justify-center border rounded-xl transition-all ${canUpgrade
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30"
                        : "bg-white/5 border-white/10 text-white/20 cursor-not-allowed"
                        }`}
                    >
                      <ArrowUp size={18} />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      -{property.buildCost}$
                    </div>
                  </div>

                  <div className="relative group/tooltip">
                    <button
                      onClick={onDowngrade}
                      className="w-10 h-10 flex items-center justify-center bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-xl text-orange-400 transition-all"
                    >
                      <ArrowDown size={18} />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      +{Math.floor((property.buildCost || 0) / 2)}$
                    </div>
                  </div>

                  <div className="relative group/tooltip">
                    <button
                      onClick={onMortgage}
                      className={`w-10 h-10 flex items-center justify-center border rounded-xl transition-all ${isMortgaged
                        ? "bg-emerald-600/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30"
                        : "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30"
                        }`}
                    >
                      <Handshake size={18} />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      {isMortgaged
                        ? `-${Math.floor((property.price || 0) / 2 * 1.1)}$`
                        : `+${Math.floor((property.price || 0) / 2)}$`}
                    </div>
                  </div>

                  <div className="relative group/tooltip">
                    <button
                      onClick={onSell}
                      className="w-10 h-10 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-red-400 transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-[10px] rounded opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                      +{Math.floor((property.price || 0) / 2)}$
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Owner display when not current player */}
            {owner && !isCurrentPlayerOwner && (
              <>
                <div className="h-px bg-white/10 mb-3" />
                <div className="flex items-center justify-center gap-2 mb-3">
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{t.owner}:</span>
                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: owner.color }} />
                  <span className="text-xs font-bold text-white">{owner.name}</span>
                </div>
              </>
            )}

            {/* Footer stats */}
            {(property.price || property.buildCost) && (
              <>
                <div className="h-px bg-white/10 mb-3" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[10px] text-white/30 uppercase font-bold tracking-wide mb-1">{t.price}</div>
                    <div className="text-sm font-bold text-white font-mono">
                      <span className="text-white/30 text-[10px]">$</span>{property.price}
                    </div>
                  </div>
                  {property.buildCost && (
                    <>
                      <div>
                        <div className="flex justify-center mb-1 text-white/30"><Home size={14} /></div>
                        <div className="text-sm font-bold text-white font-mono">
                          <span className="text-white/30 text-[10px]">$</span>{property.buildCost}
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-center mb-1 text-white/30"><Building2 size={14} /></div>
                        <div className="text-sm font-bold text-white font-mono">
                          <span className="text-white/30 text-[10px]">$</span>{property.buildCost}
                        </div>
                      </div>
                    </>
                  )}
                  {!property.buildCost && (
                    <div className="col-span-2 flex items-center justify-center">
                      <span className="text-[10px] text-white/20 italic">{property.type === "AIRPORT" ? (language === "AR" ? "مطار" : "Airport") : (language === "AR" ? "شركة" : "Company")}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
