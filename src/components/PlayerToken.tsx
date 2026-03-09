import { motion } from "motion/react";
import { Car } from "lucide-react";

interface PlayerTokenProps {
  color: string;
  character: string;
  direction: "up" | "down" | "left" | "right";
  isCurrentPlayer: boolean;
  key?: any;
}

export const PlayerToken = ({ color, character, isCurrentPlayer, direction }: PlayerTokenProps) => {
  const getRotation = () => {
    switch (direction) {
      case "up": return "-rotate-90";
      case "down": return "rotate-90";
      case "left": return "rotate-180";
      case "right": return "rotate-0";
      default: return "";
    }
  };

  return (
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`relative w-5 h-5 flex items-center justify-center transition-transform duration-300 ${getRotation()}`}
    >
      {/* Car Icon */}
      <div
        className="text-xl drop-shadow-lg select-none"
        style={{ color: color }}
      >
        <Car size={20} strokeWidth={2.5} fill="currentColor" />
      </div>

      {/* Glow effect for active player */}
      {isCurrentPlayer && (
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 rounded-xl bg-matte-blue-light blur-lg -z-10"
        />
      )}

      {/* Selection Ring */}
      {isCurrentPlayer && (
        <div className="absolute -inset-1 border-2 border-matte-blue-light rounded-lg opacity-50 pointer-events-none" />
      )}
    </motion.div>
  );
};
