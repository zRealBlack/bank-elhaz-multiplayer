import { motion } from "motion/react";

interface DiceProps {
  value: number;
  isRolling: boolean;
}

export const Dice = ({ value, isRolling }: DiceProps) => {
  const variants = {
    rolling: {
      rotateX: [0, 360, 720, 1080, 1440],
      rotateY: [0, 180, 360, 540, 720],
      rotateZ: [0, 90, 180, 270, 360],
      scale: [1, 1.2, 1],
      y: [0, -30, 0, -15, 0], // Wobble effect
      transition: { duration: 1.5, ease: "easeInOut" }
    },
    idle: (val: number) => ({
      ...getRotation(val),
      scale: 1,
      y: 0,
      transition: { type: "spring", stiffness: 260, damping: 20 }
    })
  };

  function getRotation(val: number) {
    switch (val) {
      case 1: return { rotateX: 0, rotateY: 0 };
      case 2: return { rotateX: 0, rotateY: -90 };
      case 3: return { rotateX: 0, rotateY: -180 };
      case 4: return { rotateX: 0, rotateY: 90 };
      case 5: return { rotateX: -90, rotateY: 0 };
      case 6: return { rotateX: 90, rotateY: 0 };
      default: return { rotateX: 0, rotateY: 0 };
    }
  }

  return (
    <div className="perspective-1000 w-24 h-24 relative">
      <motion.div
        animate={isRolling ? "rolling" : "idle"}
        custom={value}
        variants={variants}
        style={{
          transformStyle: "preserve-3d",
        }}
        className="w-full h-full relative"
      >
        {/* Dice Core */}
        <div className="absolute inset-[1px] bg-matte-blue-deep rounded-xl" style={{ transform: "translateZ(0)" }} />
        <div className="absolute inset-[1px] bg-matte-blue-deep rounded-xl" style={{ transform: "rotateY(90deg)" }} />
        <div className="absolute inset-[1px] bg-matte-blue-deep rounded-xl" style={{ transform: "rotateX(90deg)" }} />

        {/* Dice Faces */}
        {[1, 2, 3, 4, 5, 6].map((face) => (
          <div
            key={face}
            className="absolute inset-0 bg-white rounded-xl flex items-center justify-center border-2 border-gray-300"
            style={{
              transform: getFaceTransform(face),
              backfaceVisibility: "hidden",
              boxShadow: "inset 0 0 15px rgba(0,0,0,0.1)"
            }}
          >
            <div className="grid grid-cols-3 gap-1.5 p-2">
              {getDots(face).map((dot, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full shadow-inner ${dot ? "bg-black" : "bg-transparent"}`}
                />
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

function getFaceTransform(face: number) {
  const offset = "48px"; // Half of 24rem (w-24)
  switch (face) {
    case 1: return `rotateX(0deg) translateZ(${offset})`;
    case 2: return `rotateY(90deg) translateZ(${offset})`;
    case 3: return `rotateY(180deg) translateZ(${offset})`;
    case 4: return `rotateY(-90deg) translateZ(${offset})`;
    case 5: return `rotateX(90deg) translateZ(${offset})`;
    case 6: return `rotateX(-90deg) translateZ(${offset})`;
    default: return "";
  }
}

function getDots(face: number) {
  const dots = Array(9).fill(false);
  switch (face) {
    case 1: dots[4] = true; break;
    case 2: dots[0] = dots[8] = true; break;
    case 3: dots[0] = dots[4] = dots[8] = true; break;
    case 4: dots[0] = dots[2] = dots[6] = dots[8] = true; break;
    case 5: dots[0] = dots[2] = dots[4] = dots[6] = dots[8] = true; break;
    case 6: dots[0] = dots[2] = dots[3] = dots[5] = dots[6] = dots[8] = true; break;
  }
  return dots;
}
