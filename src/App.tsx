/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  Settings as SettingsIcon,
  Play,
  MessageSquare,
  Send,
  ArrowUp,
  ArrowDown,
  Handshake,
  LogOut,
  X,
  Palmtree,
  Lock,
  Skull,
  ArrowRight,
  GraduationCap,
  Home,
  Building2,
  AlertTriangle,
  History,
  ArrowRightLeft,
  RefreshCw,
  Check,
  Trash2,
  Gavel,
  Store,
  User,
  Coins,
  List
} from "lucide-react";
import { BOARD_DATA, COLORS, EGYPTIAN_ARABIC, ENGLISH, ENGLISH_BOARD_DATA, PLAYER_COLORS, PLAYER_CHARACTERS } from "./constants";
import { Dice } from "./components/Dice";
import { PlayerToken } from "./components/PlayerToken";
import { PropertyModal } from "./components/PropertyModal";
import { AccountModal } from "./components/AccountModal";
import { ShopModal } from "./components/ShopModal";

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

const SCHOOL_FULL_NAMES: Record<string, { EN: string; AR: string }> = {
  "OES": { EN: "Orman English School", AR: "مدرسة الأورمان الإنجليزية" },
  "LRDL": { EN: "La Rose De Lisieux Schools", AR: "مدارس لا روز دي ليزيه" },
  "NIS": { EN: "Nefertari International School", AR: "مدرسة نفرتاري الدولية" },
  "NVIS": { EN: "New Vision International School", AR: "مدرسة الرؤية الجديدة الدولية" }
};

type GameState = "LOBBY" | "PLAYING" | "GAME_OVER";

interface Player {
  id: string;
  name: string;
  color: string;
  character: string; // Added
  money: number;
  position: number;
  properties: number[];
  isBankrupt: boolean;
  inJail: boolean;
  jailTurns: number;
  jailCards: number;
  isHost: boolean;
  isReady: boolean;
  isBot: boolean;
  doubleCount: number;
}

interface Room {
  id: string;
  players: Player[];
  gameState: GameState;
  settings: {
    startingMoney: number;
    map: string;
    turnTimer: number;
    auction: boolean;
    evenBuild: boolean;
    allowTrading: boolean;
    doubleRentFullSet: boolean;
    vacationCash: boolean;
    prisonNoRent: boolean;
    mortgage: boolean;
    randomizePlayerOrder: boolean;
  };
  turn: number;
  dice: [number, number];
  history: any[];
  hasRolled: boolean;
  isDouble: boolean;
  currentAuction: {
    propertyId: number;
    highestBid: number;
    highestBidder: string | null;
    timer: number;
    participants: string[];
    bidLog: any[]; // Added
  } | null;
  propertyLevels: Record<number, number>;
  mortgagedProperties: number[];
  pendingTrades: any[];
  tradeLog: any[];
  mustActOnProperty: number | null;
  vacationCash: number; // Added
}

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [roomId, setRoomId] = useState("");
  const [language, setLanguage] = useState<"EN" | "AR">("AR");
  const t = language === "EN" ? ENGLISH : EGYPTIAN_ARABIC;
  const currentBoardData = language === "AR" ? BOARD_DATA : ENGLISH_BOARD_DATA;
  const [isJoined, setIsJoined] = useState(false);
  const [isTradeLogOpen, setIsTradeLogOpen] = useState(false);
  const [viewingTrade, setViewingTrade] = useState<any>(null);

  // Title Screen & Rooms State
  const [showRooms, setShowRooms] = useState(false);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<"PLAY" | "ROOMS" | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userToken, setUserToken] = useState<string | null>(null);

  const [chatMessage, setChatMessage] = useState("");
  const [chats, setChats] = useState<{ sender: string; color: string; message: string }[]>([]);
  const [isRolling, setIsRolling] = useState(false);
  const [battleLog, setBattleLog] = useState<any[]>([]);
  const [visualPositions, setVisualPositions] = useState<Record<string, number>>({});
  const visualPositionsRef = useRef<Record<string, number>>({});
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [expandedTileId, setExpandedTileId] = useState<number | null>(null);

  const [drawnCard, setDrawnCard] = useState<{ card: any; playerId: string; roomId: string; type: string } | null>(null);
  const [showSwapSelection, setShowSwapSelection] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    visualPositionsRef.current = visualPositions;
  }, [visualPositions]);

  const copyInviteLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("Invite link copied to clipboard!");
  };

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || undefined;
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    newSocket.on("room_update", (updatedRoom: Room) => {
      setRoom(updatedRoom);
      if (updatedRoom.history.length > 0) {
        setBattleLog(updatedRoom.history.slice(-5));
      }
    });

    newSocket.on("game_started", (startedRoom: Room) => {
      setRoom(startedRoom);
      setBattleLog([{ type: "game_started" }]);
    });

    newSocket.on("dice_rolled", async ({ dice, player, room: updatedRoom }) => {
      setIsRolling(true);

      // Capture the old room state from ref
      const oldRoom = roomRef.current;

      // Update room state with new dice values immediately, but keep old positions
      const tempRoom = {
        ...updatedRoom,
        players: updatedRoom.players.map(p => {
          const oldPlayer = oldRoom?.players.find(op => op.id === p.id);
          return {
            ...p,
            position: oldPlayer ? oldPlayer.position : p.position
          };
        })
      };
      setRoom(tempRoom);

      // Wait for dice animation (1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));
      if ((window as any).finishRollingAndDraw) {
        // Handled by the custom wrapper below if no jump
      } else {
        setIsRolling(false);
      }

      const currentPlayer = updatedRoom.players.find((p: any) => p.id === player);
      if (!currentPlayer) return;

      // Use oldRoom to find the start position
      const startPos = visualPositionsRef.current[player] ?? oldRoom?.players.find((p: any) => p.id === player)?.position ?? 0;
      const endPos = currentPlayer.position;
      const totalTiles = 48;
      let currentPos = startPos;

      // Animate jumping through tiles
      while (currentPos !== endPos) {
        currentPos = (currentPos + 1) % totalTiles;
        setVisualPositions(prev => ({ ...prev, [player]: currentPos }));
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Finally update the room state with the new positions
      setRoom(updatedRoom);

      if (updatedRoom.history.length > 0) {
        setBattleLog(updatedRoom.history.slice(-5));
      }

      if ((window as any).finishRollingAndDraw) {
        (window as any).finishRollingAndDraw(false);
      }
    });

    newSocket.on("new_chat", (chat) => {
      setChats(prev => [...prev, chat]);
    });

    let pendingCardDraw: any = null;

    newSocket.on("card_drawn", (data) => {
      pendingCardDraw = data;
    });

    // We'll check for pendingCardDraw when isRolling becomes false.
    // However, the cleanest way without refactoring hooks too much is a dedicated useEffect
    // that watches `isRolling` and `pendingCardDraw`. Let's just use `setIsRolling` wrapper.
    const _setIsRolling = setIsRolling;
    const updateIsRolling = (val: boolean) => {
      _setIsRolling(val);
      if (!val && pendingCardDraw) {
        setDrawnCard(pendingCardDraw);
        if (pendingCardDraw.card.effect !== "swap_position" || pendingCardDraw.playerId !== newSocket.id) {
          setTimeout(() => setDrawnCard(null), 3000);
        } else {
          setTimeout(() => {
            setDrawnCard(null);
            setShowSwapSelection(true);
          }, 3000);
        }
        pendingCardDraw = null;
      }
    };
    (window as any).finishRollingAndDraw = updateIsRolling;

    newSocket.on("auction_timer", ({ timer }) => {
      setRoom(prev => prev ? { ...prev, currentAuction: prev.currentAuction ? { ...prev.currentAuction, timer } : null } : null);
    });

    newSocket.on("rooms_list", (roomsList) => {
      setActiveRooms(roomsList);
    });

    newSocket.on("left_room", () => {
      setIsJoined(false);
      setRoom(null);
    });

    newSocket.on("room_disbanded", () => {
      setIsJoined(false);
      setRoom(null);
      alert(language === "EN" ? "Room has been disbanded" : "تم إلغاء الغرفة");
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isJoined && socket) {
      socket.emit("get_rooms");
      const interval = setInterval(() => socket.emit("get_rooms"), 3000);
      return () => clearInterval(interval);
    }
  }, [isJoined, socket]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  useEffect(() => {
    if (userProfile && userProfile.name) {
      setPlayerName(userProfile.name);
    }
  }, [userProfile]);

  useEffect(() => {
    if (room && Object.keys(visualPositions).length === 0) {
      const initialPositions: Record<string, number> = {};
      room.players.forEach(p => {
        initialPositions[p.id] = p.position;
      });
      setVisualPositions(initialPositions);
    }
  }, [room]);

  const joinRoom = () => {
    if (playerName && roomId && socket) {
      socket.emit("join_room", { roomId, playerName });
      setIsJoined(true);
    }
  };

  const startGame = () => {
    if (socket && room?.id) {
      socket.emit("start_game", { roomId: room.id });
    }
  };

  const rollDice = () => {
    if (socket && room?.id && !isRolling) {
      socket.emit("roll_dice", { roomId: room.id });
    }
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage && socket && room?.id) {
      socket.emit("send_chat", { roomId: room.id, message: chatMessage });
      setChatMessage("");
    }
  };

  const [isTradeOpen, setIsTradeOpen] = useState(false);
  const [tradeTarget, setTradeTarget] = useState<Player | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [negotiationData, setNegotiationData] = useState<any>(null);
  const [isIncomingTradeOpen, setIsIncomingTradeOpen] = useState(false);
  const [activeIncomingTrade, setActiveIncomingTrade] = useState<any>(null);
  const [seenTrades, setSeenTrades] = useState<string[]>([]);

  useEffect(() => {
    if (room && socket) {
      const myIncomingTrade = room.pendingTrades.find((t: any) => t.targetId === socket.id && !seenTrades.includes(t.id));
      if (myIncomingTrade) {
        setActiveIncomingTrade(myIncomingTrade);
        setIsIncomingTradeOpen(true);
        setSeenTrades(prev => [...prev, myIncomingTrade.id]);
      }
    }
  }, [room, socket, seenTrades]);

  const TradeDetailModal = () => {
    if (!viewingTrade || !room) return null;

    // Find the latest version of this trade in the room data
    const latestTrade = room.pendingTrades.find((t: any) => t.id === viewingTrade.id) ||
      room.tradeLog.find((t: any) => t.id === viewingTrade.id);

    if (!latestTrade) {
      setViewingTrade(null);
      return null;
    }

    const isSender = latestTrade.senderId === socket?.id;
    const isTarget = latestTrade.targetId === socket?.id;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[210] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-matte-blue-deep border border-white/10 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Handshake className="text-matte-blue-light" /> {language === "EN" ? "Trade Details" : "تفاصيل المقايضة"}
            </h3>
            <button onClick={() => setViewingTrade(null)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center space-y-2">
                <div className="text-lg font-bold">{latestTrade.senderName}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">{language === "EN" ? "Sender" : "المرسل"}</div>
              </div>
              <div className="flex flex-col items-center">
                <ArrowRightLeft className="text-matte-blue-light" size={24} />
                <div className={`mt-2 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ${latestTrade.status === "PENDING" ? "bg-matte-blue-mid/20 text-matte-blue-light" :
                  latestTrade.status === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-400" :
                    "bg-rose-500/20 text-rose-400"
                  }`}>
                  {latestTrade.status}
                </div>
              </div>
              <div className="flex-1 text-center space-y-2">
                <div className="text-lg font-bold">{latestTrade.targetName}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">{language === "EN" ? "Receiver" : "المستلم"}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{latestTrade.senderName} {language === "EN" ? "Gives" : "يعطي"}:</p>
                <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5 min-h-[100px]">
                  {latestTrade.senderProperties.map((id: number) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBoardData[id].color }} />
                      {currentBoardData[id].name}
                    </div>
                  ))}
                  {latestTrade.senderMoney > 0 && <div className="text-emerald-400 font-mono text-sm font-bold">+ ${latestTrade.senderMoney}</div>}
                  {latestTrade.senderProperties.length === 0 && latestTrade.senderMoney === 0 && <div className="text-gray-600 italic text-sm">لا شيء</div>}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{latestTrade.targetName} {language === "EN" ? "Gives" : "يعطي"}:</p>
                <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5 min-h-[100px]">
                  {latestTrade.targetProperties.map((id: number) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBoardData[id].color }} />
                      {currentBoardData[id].name}
                    </div>
                  ))}
                  {latestTrade.targetMoney > 0 && <div className="text-emerald-400 font-mono text-sm font-bold">+ ${latestTrade.targetMoney}</div>}
                  {latestTrade.targetProperties.length === 0 && latestTrade.targetMoney === 0 && <div className="text-gray-600 italic text-sm">لا شيء</div>}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end gap-3">
            {latestTrade.status === "PENDING" ? (
              <>
                {isSender ? (
                  <button
                    onClick={() => {
                      socket?.emit("cancel_trade", { roomId: room.id, tradeId: latestTrade.id });
                      setViewingTrade(null);
                    }}
                    className="group relative flex items-center justify-center p-3 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20"
                  >
                    <Trash2 size={20} />
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {language === "EN" ? "Cancel Trade" : "إلغاء المقايضة"}
                    </span>
                  </button>
                ) : isTarget ? (
                  <>
                    <button
                      onClick={() => {
                        const sender = room.players.find(p => p.id === latestTrade.senderId);
                        if (sender) {
                          setTradeTarget(sender);
                          setNegotiationData(latestTrade);
                          setIsTradeOpen(true);
                          setViewingTrade(null);
                        }
                      }}
                      className="group relative flex items-center justify-center p-3 rounded-xl bg-matte-blue-mid/10 text-matte-blue-light hover:bg-matte-blue-mid/20 transition-all border border-matte-blue-mid/20"
                    >
                      <RefreshCw size={20} />
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {language === "EN" ? "Negotiate" : "تفاوض"}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        socket?.emit("decline_trade", { roomId: room.id, tradeId: latestTrade.id });
                        setViewingTrade(null);
                      }}
                      className="group relative flex items-center justify-center p-3 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all border border-rose-500/20"
                    >
                      <X size={20} />
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {language === "EN" ? "Decline" : "رفض"}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        socket?.emit("accept_trade", { roomId: room.id, tradeId: latestTrade.id });
                        setViewingTrade(null);
                      }}
                      className="group relative flex items-center justify-center p-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
                    >
                      <Check size={20} />
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {language === "EN" ? "Accept" : "قبول"}
                      </span>
                    </button>
                  </>
                ) : (
                  <div className="text-sm text-gray-500 italic">{language === "EN" ? "Waiting for response..." : "في انتظار الرد..."}</div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                <div className={`w-2 h-2 rounded-full ${latestTrade.status === "ACCEPTED" ? "bg-emerald-400" : "bg-rose-400"
                  }`} />
                <span className="text-sm font-bold uppercase tracking-widest opacity-50">
                  {latestTrade.status}
                </span>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const IncomingTradeModal = () => {
    if (!activeIncomingTrade) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-gradient-to-br from-matte-blue-deep to-matte-blue-mid border border-white/10 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Handshake className="text-matte-blue-light" /> {language === "EN" ? "New Trade Offer" : "عرض مقايضة جديد"}
            </h3>
            <button onClick={() => setIsIncomingTradeOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-6">
            <div className="text-center">
              <p className="text-lg"><span className="font-bold text-matte-blue-light">{activeIncomingTrade.senderName}</span> {language === "EN" ? "sent you an offer:" : "أرسل لك عرضاً:"}</p>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{language === "EN" ? "You Receive:" : "سوف تحصل على:"}</p>
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  {activeIncomingTrade.senderProperties.map((id: number) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBoardData[id].color }} />
                      {currentBoardData[id].name}
                    </div>
                  ))}
                  {activeIncomingTrade.senderMoney > 0 && (
                    <div className="text-emerald-400 font-mono font-bold">+ ${activeIncomingTrade.senderMoney}</div>
                  )}
                  {activeIncomingTrade.senderProperties.length === 0 && activeIncomingTrade.senderMoney === 0 && (
                    <div className="text-gray-500 italic text-sm">{language === "EN" ? "Nothing" : "لا شيء"}</div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{language === "EN" ? "You Give:" : "سوف تعطي:"}</p>
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  {activeIncomingTrade.targetProperties.map((id: number) => (
                    <div key={id} className="flex items-center gap-2 text-sm">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBoardData[id].color }} />
                      {currentBoardData[id].name}
                    </div>
                  ))}
                  {activeIncomingTrade.targetMoney > 0 && (
                    <div className="text-emerald-400 font-mono font-bold">+ ${activeIncomingTrade.targetMoney}</div>
                  )}
                  {activeIncomingTrade.targetProperties.length === 0 && activeIncomingTrade.targetMoney === 0 && (
                    <div className="text-gray-500 italic text-sm">{language === "EN" ? "Nothing" : "لا شيء"}</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-black/40 border-t border-white/5 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                socket?.emit("accept_trade", { roomId: room.id, tradeId: activeIncomingTrade.id });
                setIsIncomingTradeOpen(false);
              }}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 text-white font-bold hover:bg-emerald-400 transition-all flex items-center gap-2"
            >
              <Check size={18} /> {language === "EN" ? "Accept" : "قبول"}
            </button>
            <button
              onClick={() => {
                const sender = room.players.find((p: any) => p.id === activeIncomingTrade.senderId);
                if (sender) {
                  setTradeTarget(sender);
                  setNegotiationData(activeIncomingTrade);
                  setIsTradeOpen(true);
                  setIsIncomingTradeOpen(false);
                }
              }}
              className="px-6 py-2.5 rounded-xl bg-matte-blue-mid text-white font-bold hover:bg-matte-blue-light transition-all flex items-center gap-2"
            >
              <RefreshCw size={18} /> {language === "EN" ? "Negotiate" : "تفاوض"}
            </button>
            <button
              onClick={() => {
                socket?.emit("decline_trade", { roomId: room.id, tradeId: activeIncomingTrade.id });
                setIsIncomingTradeOpen(false);
              }}
              className="px-6 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold hover:bg-rose-500/20 transition-all flex items-center gap-2"
            >
              <X size={18} /> {language === "EN" ? "Decline" : "رفض"}
            </button>
            <button
              onClick={() => setIsIncomingTradeOpen(false)}
              className="px-6 py-2.5 rounded-xl bg-white/5 text-gray-300 font-bold hover:bg-white/10 transition-all"
            >
              {language === "EN" ? "Decide Later" : "قرر لاحقاً"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const TradeModal = () => {
    if (!room || !tradeTarget) return null;
    const me = room.players.find(p => p.id === socket?.id);
    if (!me) return null;
    const [offeredMoney, setOfferedMoney] = useState(negotiationData ? (negotiationData.targetId === socket?.id ? negotiationData.targetMoney : negotiationData.senderMoney) : 0);
    const [requestedMoney, setRequestedMoney] = useState(negotiationData ? (negotiationData.targetId === socket?.id ? negotiationData.senderMoney : negotiationData.targetMoney) : 0);
    const [mySelectedProperties, setMySelectedProperties] = useState<number[]>(negotiationData ? (negotiationData.targetId === socket?.id ? negotiationData.targetProperties : negotiationData.senderProperties) : []);
    const [theirSelectedProperties, setTheirSelectedProperties] = useState<number[]>(negotiationData ? (negotiationData.targetId === socket?.id ? negotiationData.senderProperties : negotiationData.targetProperties) : []);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-gradient-to-br from-matte-blue-deep to-matte-blue-mid border border-white/10 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl"
        >
          <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Handshake className="text-matte-blue-light" /> {t.trade}
            </h3>
            <button onClick={() => setIsTradeOpen(false)} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          <div className="grid grid-cols-2 divide-x divide-white/5">
            {/* My Side */}
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: me.color }} />
                <span className="font-bold text-lg">{t.you}</span>
              </div>
              <div className="bg-matte-blue-deep/40 rounded-2xl p-4 border border-white/5 h-64 overflow-y-auto space-y-2 custom-scrollbar">
                <p className="text-xs font-bold text-matte-blue-light/60 uppercase tracking-widest mb-2">{t.yourProperties}</p>
                {me.properties.map(id => (
                  <label key={id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${mySelectedProperties.includes(id) ? "bg-matte-blue-mid/20 border-matte-blue-mid/50" : "bg-white/5 border-white/5 hover:bg-white/10"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: currentBoardData[id].color }} />
                      <span className="text-sm font-medium">{currentBoardData[id].name}</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-matte-blue-mid focus:ring-matte-blue-mid focus:ring-offset-0"
                      checked={mySelectedProperties.includes(id)}
                      onChange={(e) => {
                        if (e.target.checked) setMySelectedProperties([...mySelectedProperties, id]);
                        else setMySelectedProperties(mySelectedProperties.filter(pid => pid !== id));
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.offeredMoney}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={me.money}
                    value={offeredMoney}
                    onChange={(e) => setOfferedMoney(Number(e.target.value))}
                    className="flex-1 accent-matte-blue-mid"
                  />
                  <input
                    type="number"
                    min="0"
                    max={me.money}
                    value={offeredMoney}
                    onChange={(e) => {
                      const val = Math.min(me.money, Math.max(0, Number(e.target.value)));
                      setOfferedMoney(val);
                    }}
                    className="w-24 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-center font-mono text-sm"
                  />
                </div>
                <div className="text-center font-mono text-lg text-matte-blue-light">{offeredMoney}$</div>
              </div>
            </div>

            {/* Target Side */}
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tradeTarget.color }} />
                <span className="font-bold text-lg">{tradeTarget.name}</span>
              </div>
              <div className="bg-matte-blue-deep/40 rounded-2xl p-4 border border-white/5 h-64 overflow-y-auto space-y-2 custom-scrollbar">
                <p className="text-xs font-bold text-matte-blue-light/60 uppercase tracking-widest mb-2">{t.theirProperties}</p>
                {tradeTarget.properties.map(id => (
                  <label key={id} className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group ${theirSelectedProperties.includes(id) ? "bg-matte-blue-mid/20 border-matte-blue-mid/50" : "bg-white/5 border-white/5 hover:bg-white/10"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: currentBoardData[id].color }} />
                      <span className="text-sm font-medium">{currentBoardData[id].name}</span>
                    </div>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-matte-blue-mid focus:ring-matte-blue-mid focus:ring-offset-0"
                      checked={theirSelectedProperties.includes(id)}
                      onChange={(e) => {
                        if (e.target.checked) setTheirSelectedProperties([...theirSelectedProperties, id]);
                        else setTheirSelectedProperties(theirSelectedProperties.filter(pid => pid !== id));
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.requestedMoney}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={tradeTarget.money}
                    value={requestedMoney}
                    onChange={(e) => setRequestedMoney(Number(e.target.value))}
                    className="flex-1 accent-matte-blue-mid"
                  />
                  <input
                    type="number"
                    min="0"
                    max={tradeTarget.money}
                    value={requestedMoney}
                    onChange={(e) => {
                      const val = Math.min(tradeTarget.money, Math.max(0, Number(e.target.value)));
                      setRequestedMoney(val);
                    }}
                    className="w-24 bg-black/20 border border-white/10 rounded-lg px-2 py-1 text-center font-mono text-sm"
                  />
                </div>
                <div className="text-center font-mono text-lg text-matte-blue-light">{requestedMoney}$</div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end gap-4">
            <button onClick={() => { setIsTradeOpen(false); setNegotiationData(null); }} className="px-8 py-3 rounded-xl border border-white/10 hover:bg-white/5 transition-all">{t.cancel}</button>
            <button
              onClick={() => {
                socket?.emit("trade", {
                  roomId: room.id,
                  targetId: tradeTarget.id,
                  myProperties: mySelectedProperties,
                  theirProperties: theirSelectedProperties,
                  myMoney: offeredMoney,
                  theirMoney: requestedMoney
                });
                setIsTradeOpen(false);
                setNegotiationData(null);
              }}
              className="px-8 py-3 rounded-xl bg-matte-blue-mid text-white font-bold hover:bg-matte-blue-light transition-all shadow-lg shadow-matte-blue-mid/20"
            >{negotiationData ? "إرسال عرض مضاد" : t.confirmOffer}</button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const formatLog = (log: any) => {
    if (typeof log === "string") return log;
    let text = t[`history_${log.type}` as keyof typeof t] || log.type;
    if (log.playerName) text = text.replace("{player}", log.playerName);
    if (log.tileName) text = text.replace("{tile}", log.tileName);
    if (log.targetName) text = text.replace("{target}", log.targetName);
    if (log.senderName) text = text.replace("{sender}", log.senderName);
    if (log.winnerName) text = text.replace("{winner}", log.winnerName);
    if (log.amount !== undefined) text = text.replace("{amount}", log.amount.toString());
    if (log.total !== undefined) text = text.replace("{total}", log.total.toString());
    if (log.level !== undefined) text = text.replace("{level}", log.level.toString());
    if (log.turns !== undefined) text = text.replace("{turns}", log.turns.toString());
    if (log.myProp) text = text.replace("{myProp}", log.myProp);
    if (log.targetProp) text = text.replace("{targetProp}", log.targetProp);
    if (log.title) text = text.replace("{title}", log.title);
    return text;
  };

  const handlePlayClick = () => {
    if (!playerName.trim()) {
      setActiveInput("PLAY");
      return;
    }
    const bestRoom = activeRooms.sort((a, b) => b.playersCount - a.playersCount)[0];
    if (bestRoom) {
      if (socket) {
        socket.emit("join_room", { roomId: bestRoom.id, playerName, authId: userProfile?.id });
        setIsJoined(true);
      }
    } else {
      setShowRooms(true);
    }
  };

  const handleRoomsClick = () => {
    if (!playerName.trim()) {
      setActiveInput("ROOMS");
      return;
    }
    setShowRooms(true);
  };

  if (!isJoined) {
    if (showRooms) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-matte-blue-deep to-matte-black text-white flex flex-col p-8 font-sans">
          <div className="relative z-10 max-w-5xl mx-auto w-full flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-4xl font-black mb-2 flex items-center gap-3">
                  <List className="text-matte-blue-light" />
                  Available Rooms
                </h1>
                <p className="text-gray-400 font-medium">Find a game to join or create your own</p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowRooms(false)}
                  className="px-6 py-3 rounded-full bg-matte-blue-deep/60 hover:bg-white/10 transition-all font-bold backdrop-blur-md border border-white/10"
                >
                  <ArrowRightLeft className="inline mr-2" /> Back
                </button>
                <button
                  onClick={() => {
                    const newId = Math.random().toString(36).substring(2, 8).toUpperCase();
                    socket?.emit("join_room", { roomId: newId, playerName, authId: userProfile?.id });
                    setIsJoined(true);
                  }}
                  className="px-8 py-3 rounded-full bg-matte-blue-mid text-white font-bold hover:shadow-[0_0_20px_rgba(135,206,235,0.4)] transition-all hover:-translate-y-1 border border-matte-blue-light/50"
                >
                  Create Room
                </button>
              </div>
            </div>

            <div className="flex-1 bg-matte-blue-deep/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 overflow-hidden flex flex-col shadow-2xl">
              {activeRooms.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                  <Palmtree size={64} className="mb-4 text-matte-blue-light" />
                  <p className="text-2xl font-bold mb-2">No active rooms found</p>
                  <p>Be the first to create one!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar">
                  {activeRooms.map((r, i) => (
                    <motion.div
                      key={r.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-matte-blue-deep/60 border border-white/10 p-6 rounded-2xl hover:bg-matte-blue-deep transition-all group shadow-xl"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="font-bold text-2xl tracking-widest bg-black/40 px-3 py-1 rounded-lg border border-white/5">{r.id}</div>
                        <div className="flex items-center gap-2 bg-matte-blue-light/20 text-matte-blue-light px-3 py-1 rounded-full text-sm font-bold border border-matte-blue-light/20">
                          <Users size={14} /> {r.playersCount}/6
                        </div>
                      </div>
                      <div className="space-y-2 mb-6 text-sm text-gray-400">
                        <div className="flex justify-between"><span>Map:</span> <span className="text-white capitalize">{r.settings.map.replace('_', ' ')}</span></div>
                        <div className="flex justify-between"><span>Start Cash:</span> <span className="text-green-400 font-mono">${r.settings.startingMoney}</span></div>
                        <div className="flex justify-between"><span>Trading:</span> <span className="text-white">{r.settings.allowTrading ? 'On' : 'Off'}</span></div>
                      </div>
                      <button
                        onClick={() => {
                          socket?.emit("join_room", { roomId: r.id, playerName, authId: userProfile?.id });
                          setIsJoined(true);
                        }}
                        className="w-full py-3 rounded-xl bg-matte-blue-light/10 border border-matte-blue-light/20 hover:bg-matte-blue-light hover:text-matte-blue-deep font-bold transition-all mt-auto"
                      >
                        Join Game
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-matte-blue-deep to-matte-black text-white flex flex-col relative overflow-hidden font-sans">
        {/* Top Navbar */}
        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLanguage(l => l === "EN" ? "AR" : "EN")}
              className="bg-black/40 hover:bg-white/10 backdrop-blur-md border border-white/10 px-6 py-2.5 rounded-full font-bold transition-all flex items-center gap-2 text-sm uppercase tracking-widest"
            >
              <ArrowRightLeft size={16} />
              {language === "EN" ? "عربي" : "English"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-matte-blue-deep/60 backdrop-blur-md border border-white/10 px-5 py-2.5 rounded-full flex items-center gap-3 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <Coins className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" size={18} />
              <span className="font-mono font-black text-white text-lg tracking-wide">{userProfile?.coins || 0}</span>
            </div>
            <button onClick={() => setShowShop(true)} className="w-12 h-12 rounded-full bg-matte-blue-deep/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all group shadow-lg">
              <Store className="text-white group-hover:text-matte-blue-light transition-colors" size={20} />
            </button>
            <button onClick={() => setShowAccount(true)} className="w-12 h-12 rounded-full bg-matte-blue-deep/60 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/10 hover:scale-110 transition-all group shadow-lg">
              <User className="text-white group-hover:text-matte-blue-light transition-colors" size={20} />
            </button>
          </div>
        </div>

        {/* Main Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="mb-16 relative"
          >
            <div className="absolute inset-0 bg-matte-blue-light/20 blur-[100px] rounded-full" />
            <h1 className="text-7xl md:text-9xl font-black text-center tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-blue-100 to-matte-blue-light drop-shadow-[0_0_30px_rgba(135,206,235,0.3)]">
              BANK ELHAZ<span className="align-top text-2xl md:text-4xl -ml-2">.io</span>
            </h1>
            <p className="text-center mt-4 text-xl md:text-2xl text-matte-blue-light/60 font-medium tracking-widest uppercase">The ultimate monopoly experience</p>
          </motion.div>

          <div className="w-full max-w-sm space-y-4">
            {activeInput === "PLAY" ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePlayClick(); }}
                  autoFocus
                  placeholder={t.enterName}
                  className="w-full bg-matte-blue-deep/60 backdrop-blur-md border-2 border-matte-blue-light/50 rounded-[2rem] px-8 py-5 text-xl font-bold focus:outline-none focus:border-matte-blue-light focus:shadow-[0_0_30px_rgba(135,206,235,0.3)] transition-all text-center"
                />
                <button onClick={handlePlayClick} className="absolute inset-y-2 right-2 px-6 rounded-full bg-matte-blue-mid hover:bg-matte-blue-light hover:text-matte-blue-deep font-bold shadow-lg transition-colors">Let's Go</button>
              </motion.div>
            ) : (
              <button
                onClick={handlePlayClick}
                className="w-full bg-gradient-to-r from-matte-blue-deep to-matte-blue-mid text-white font-black text-2xl py-5 rounded-[2rem] hover:scale-105 active:scale-95 transition-all shadow-[0_0_40px_rgba(135,206,235,0.2)] hover:shadow-[0_0_60px_rgba(135,206,235,0.4)] flex items-center justify-center gap-3 border border-matte-blue-light/30"
              >
                <Play size={28} className="fill-white" />
                PLAY
              </button>
            )}

            {activeInput === "ROOMS" ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleRoomsClick(); }}
                  autoFocus
                  placeholder={t.enterName}
                  className="w-full bg-matte-blue-deep/60 backdrop-blur-md border-2 border-white/20 rounded-[2rem] px-8 py-5 text-xl font-bold focus:outline-none focus:border-white/50 focus:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all text-center"
                />
                <button onClick={handleRoomsClick} className="absolute inset-y-2 right-2 px-6 rounded-full bg-white/20 hover:bg-white/30 font-bold shadow-lg transition-colors">Let's Go</button>
              </motion.div>
            ) : (
              <button
                onClick={handleRoomsClick}
                className="w-full bg-matte-blue-deep/40 backdrop-blur-md border border-white/10 text-white font-bold text-xl py-5 rounded-[2rem] hover:bg-matte-blue-deep/60 hover:border-white/30 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                <List size={24} />
                ROOMS
              </button>
            )}

            <div className="mt-8 text-center">
              <span className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">
                by GAML STUDIOS
              </span>
            </div>
          </div>
        </div>

        {/* Modals for Shop/Account */}
        <ShopModal
          isOpen={showShop}
          onClose={() => setShowShop(false)}
          userProfile={userProfile}
          userToken={userToken}
          setUserProfile={setUserProfile}
        />
        <AccountModal
          isOpen={showAccount}
          onClose={() => setShowAccount(false)}
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          setUserToken={setUserToken}
          userToken={userToken}
        />
      </div>
    );
  }

  if (isJoined && !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-matte-blue-deep to-matte-black text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-white/20 border-t-matte-blue-light rounded-full animate-spin" />
          <h2 className="text-2xl font-bold tracking-widest text-matte-blue-light animate-pulse uppercase">Connecting to Server...</h2>
        </div>
      </div>
    );
  }

  if (room?.gameState === "GAME_OVER") {
    const winner = room.players.find(p => !p.isBankrupt);
    return (
      <div className="min-h-screen bg-gradient-to-br from-matte-blue-deep to-matte-black text-white flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-matte-blue-deep/90 backdrop-blur-xl p-12 rounded-3xl border border-white/10 shadow-2xl text-center max-w-md w-full"
        >
          <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/30">
            <Skull size={48} className="text-yellow-500" />
          </div>
          <h1 className="text-5xl font-black mb-2 tracking-tighter">{t.winner}</h1>
          <p className="text-xl text-matte-blue-light mb-8 font-bold">{winner?.name || t.none}</p>

          <button
            onClick={() => socket?.emit("leave_room")}
            className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-all"
          >
            {t.endTurn}
          </button>
        </motion.div>
      </div>
    );
  }

  if (room?.gameState === "LOBBY") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-matte-blue-deep to-matte-black text-white p-8 font-sans">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Room Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-matte-blue-deep/60 backdrop-blur-xl p-8 rounded-2xl border border-white/10">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">{t.room}: {room.id}</h2>
                  <p className="text-gray-400 mt-1">{t.waiting}</p>
                </div>
                <div className="flex items-center gap-2 bg-matte-blue-light/20 px-4 py-2 rounded-full border border-white/10">
                  <Users size={18} />
                  <span>{room.players.length} / 6</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {room.players.map((player) => (
                  <div key={player.id} className="flex items-center justify-between bg-matte-blue-deep/40 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: player.color }} />
                      <span className="font-medium">
                        {player.name}
                        {player.id === socket?.id && ` (${t.you})`}
                      </span>
                      {player.isHost && <span className="text-xs bg-matte-blue-light/20 text-matte-blue-light px-2 py-0.5 rounded-full border border-matte-blue-light/30">{t.host}</span>}
                      {!player.isHost && (
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${player.isReady ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                          {player.isReady ? 'Ready' : 'Not Ready'}
                        </span>
                      )}
                    </div>
                    {room.players.find(p => p.id === socket?.id)?.isHost && player.id !== socket?.id && (
                      <button className="text-red-400 hover:text-red-300 transition-colors">
                        <X size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Character & Color Selection */}
              <div className="mt-8 pt-8 border-t border-white/5">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Users className="text-matte-blue-light" /> {t.selectCharacter}
                </h3>

                <div className="space-y-8">
                  {/* Colors */}
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">{t.yourColor}</p>
                    <div className="flex flex-wrap gap-3">
                      {PLAYER_COLORS.map(color => {
                        const isTaken = room.players.some(p => p.id !== socket?.id && p.color === color);
                        const isMine = room.players.find(p => p.id === socket?.id)?.color === color;

                        return (
                          <button
                            key={color}
                            disabled={isTaken}
                            onClick={() => socket?.emit("select_character", { roomId: room.id, color, character: room.players.find(p => p.id === socket?.id)?.character })}
                            className={`w-10 h-10 rounded-full border-2 transition-all ${isMine ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"} ${isTaken ? "opacity-20 cursor-not-allowed grayscale" : "cursor-pointer"}`}
                            style={{ backgroundColor: color }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invite Link */}
              <div className="mt-8 bg-black/20 p-6 rounded-2xl border border-white/10 space-y-4">
                <h3 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                  <Users size={16} /> {t.shareGame}
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={window.location.href}
                    className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none"
                  />
                  <button
                    onClick={copyInviteLink}
                    className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
                  >
                    {t.copy}
                  </button>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="bg-matte-blue-deep/60 backdrop-blur-xl p-8 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2 mb-6">
                <SettingsIcon size={20} className="text-gray-400" />
                <h3 className="text-xl font-bold">{t.roomSettings}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.startingMoney}</span>
                    {room?.players.find(p => p.id === socket?.id)?.isHost ? (
                      <select
                        value={room?.settings?.startingMoney}
                        onChange={(e) => socket?.emit("update_settings", { roomId: room.id, settings: { startingMoney: Number(e.target.value) } })}
                        className="bg-matte-blue-deep border border-white/10 rounded-lg px-2 py-1 font-mono text-sm focus:outline-none"
                      >
                        {[500, 1000, 1500, 2000, 2500, 3000].map(amount => (
                          <option key={amount} value={amount}>${amount}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="font-mono">${room?.settings?.startingMoney}</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.turnTimer}</span>
                    <span className="font-mono">{room?.settings?.turnTimer}s</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.auction}</span>
                    <div
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${room?.settings?.auction ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}
                      onClick={() => room?.players.find(p => p.id === socket?.id)?.isHost && socket?.emit("update_settings", { roomId: room.id, settings: { auction: !room.settings.auction } })}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.auction ? "right-1" : "left-1"}`} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.allowTrading}</span>
                    <div
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${room?.settings?.allowTrading ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}
                      onClick={() => room?.players.find(p => p.id === socket?.id)?.isHost && socket?.emit("update_settings", { roomId: room.id, settings: { allowTrading: !room.settings.allowTrading } })}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.allowTrading ? "right-1" : "left-1"}`} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.vacationCash}</span>
                    <div
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${room?.settings?.vacationCash ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}
                      onClick={() => room?.players.find(p => p.id === socket?.id)?.isHost && socket?.emit("update_settings", { roomId: room.id, settings: { vacationCash: !room.settings.vacationCash } })}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.vacationCash ? "right-1" : "left-1"}`} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.prisonNoRent}</span>
                    <div
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${room?.settings?.prisonNoRent ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}
                      onClick={() => room?.players.find(p => p.id === socket?.id)?.isHost && socket?.emit("update_settings", { roomId: room.id, settings: { prisonNoRent: !room.settings.prisonNoRent } })}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.prisonNoRent ? "right-1" : "left-1"}`} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-matte-blue-light/60">{t.randomizePlayerOrder}</span>
                    <div
                      className={`w-10 h-5 rounded-full relative transition-colors cursor-pointer ${room?.settings?.randomizePlayerOrder ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}
                      onClick={() => room?.players.find(p => p.id === socket?.id)?.isHost && socket?.emit("update_settings", { roomId: room.id, settings: { randomizePlayerOrder: !room.settings.randomizePlayerOrder } })}
                    >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.randomizePlayerOrder ? "right-1" : "left-1"}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Selection */}
              <div className="mt-8 pt-8 border-t border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Palmtree size={20} className="text-gray-400" />
                  <h3 className="text-xl font-bold">Select Map</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Giza Streets */}
                  <div className="relative rounded-xl border-2 border-matte-blue-light overflow-hidden group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                    <img
                      src="https://images.unsplash.com/photo-1572252009286-268acec5ca0a?q=80&w=2070&auto=format&fit=crop"
                      alt="Giza Streets"
                      className="w-full h-32 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute bottom-3 left-3 z-20">
                      <h4 className="font-bold text-white">Giza Streets</h4>
                      <p className="text-xs text-matte-blue-light">Current Map</p>
                    </div>
                    <div className="absolute top-3 right-3 z-20 bg-matte-blue-light text-matte-blue-deep text-xs font-bold px-2 py-1 rounded-full">
                      Selected
                    </div>
                  </div>

                  {/* Locked Map */}
                  <div className="relative rounded-xl border-2 border-white/5 overflow-hidden opacity-60">
                    <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-sm">
                      <div className="text-center">
                        <Lock size={24} className="mx-auto mb-2 text-white/50" />
                        <span className="text-sm font-bold text-white/50 uppercase tracking-widest">Soon</span>
                      </div>
                    </div>
                    <img
                      src="https://images.unsplash.com/photo-1539667468225-eebb663053e6?q=80&w=2069&auto=format&fit=crop"
                      alt="Alexandria Coast"
                      className="w-full h-32 object-cover grayscale"
                    />
                    <div className="absolute bottom-3 left-3 z-20">
                      <h4 className="font-bold text-white/50">Alexandria Coast</h4>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chat & Actions */}
          <div className="space-y-8">
            <div className="bg-matte-blue-deep/60 backdrop-blur-xl h-[400px] flex flex-col rounded-2xl border border-white/10 overflow-hidden">
              <div className="p-4 border-bottom border-white/10 bg-white/5">
                <h3 className="font-bold flex items-center gap-2">
                  <MessageSquare size={18} /> {t.chat}
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chats.map((chat, i) => (
                  <div key={i} className="text-sm">
                    <span style={{ color: chat.color }} className="font-bold">{chat.sender}: </span>
                    <span className="text-gray-300">{chat.message}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="p-4 bg-black/20 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  placeholder={t.chatPlaceholder}
                />
                <button type="submit" className="bg-white text-black p-2 rounded-lg hover:bg-gray-200 transition-all">
                  <Send size={18} />
                </button>
              </form>
            </div>

            <div className="space-y-4">
              {room?.players?.find(p => p.id === socket?.id)?.isHost ? (
                <>
                  <button
                    onClick={() => socket?.emit("add_bot", { roomId: room.id })}
                    disabled={(room?.players?.length || 0) >= 6}
                    className="w-full bg-white/10 text-white border border-white/10 font-bold py-4 rounded-xl hover:bg-white/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Users size={20} /> {t.addBot}
                  </button>
                  <button
                    onClick={startGame}
                    disabled={(room?.players?.length || 0) < 2 || !room?.players.every(p => p.isReady)}
                    className="w-full bg-matte-blue-mid text-white font-bold py-4 rounded-xl hover:bg-matte-blue-light transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={20} /> {t.startGame} {!room?.players.every(p => p.isReady) && `(${t.waiting})`}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => socket?.emit("toggle_ready", { roomId: room.id })}
                  className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 ${room?.players.find(p => p.id === socket?.id)?.isReady
                    ? "bg-green-500 hover:bg-green-400 text-white"
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                    }`}
                >
                  {room?.players.find(p => p.id === socket?.id)?.isReady ? "Ready!" : "Click to Ready"}
                </button>
              )}
              
              <button
                onClick={() => socket?.emit("leave_room")}
                className="w-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={20} /> {language === "EN" ? "Leave Room" : "مغادرة الغرفة"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Game View
  return (
    <div className="min-h-screen bg-gradient-to-br from-matte-blue-deep to-matte-black text-white overflow-hidden font-sans flex flex-col">
      <AnimatePresence>
        {isTradeOpen && <TradeModal />}
        {isIncomingTradeOpen && <IncomingTradeModal />}
        {viewingTrade && <TradeDetailModal />}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: GUI & Chat */}
        <aside className="w-80 border-r border-white/5 bg-matte-blue-deep/40 backdrop-blur-md flex flex-col z-50">
          <div className="p-6 border-b border-white/5">
            <h1 className="text-2xl font-black tracking-tighter mb-4">BANK ELHAZ <span className="text-sm lowercase">.io</span></h1>
            <div className="flex gap-2">
              <button
                onClick={() => socket?.emit("debug_give_properties", { roomId: room?.id })}
                className="flex-1 flex items-center justify-center gap-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 py-2 rounded-xl transition-all text-sm font-bold"
              >
                <Handshake size={16} /> {language === "EN" ? "Debug" : "تجربة"}
              </button>
            </div>
            <div className="mt-2 bg-black/20 p-3 rounded-xl border border-white/10 space-y-2">
              <h3 className="text-[10px] font-bold text-gray-400 flex items-center gap-2">
                <Users size={12} /> {t.shareGame}
              </h3>
              <div className="flex gap-1">
                <input
                  type="text"
                  readOnly
                  value={window.location.href}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-mono text-gray-300 focus:outline-none"
                />
                <button
                  onClick={copyInviteLink}
                  className="bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                >
                  {t.copy}
                </button>
              </div>
            </div>
            <button
              onClick={() => setLanguage(l => l === "EN" ? "AR" : "EN")}
              className="w-full mt-3 bg-white/5 hover:bg-white/10 border border-white/10 py-2 rounded-xl text-xs font-bold transition-all"
            >
              {language === "EN" ? "عربي" : "English"}
            </button>
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-white/5 bg-matte-blue-light/10 flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-widest text-matte-blue-light">{t.chat}</span>
              <MessageSquare size={16} className="text-matte-blue-light/60" />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chats.map((chat, i) => (
                <div key={i} className="text-sm">
                  <span style={{ color: chat.color }} className="font-bold">{chat.sender}: </span>
                  <span className="text-gray-300">{chat.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={sendChat} className="p-4 bg-black/20 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder={t.chatPlaceholder}
              />
              <button type="submit" className="bg-white text-black p-2 rounded-lg hover:bg-gray-200 transition-all">
                <Send size={18} />
              </button>
            </form>
          </div>
        </aside>

        {/* Main Content: Board */}
        <main
          className="flex-1 relative flex items-center justify-center p-4 overflow-hidden"
          style={{
            backgroundImage: `linear-gradient(to bottom, rgba(12, 14, 12, 0.7), rgba(37, 45, 56, 0.85)), url("https://images.unsplash.com/photo-1572252009286-268acec5ca0a?q=80&w=2070&auto=format&fit=crop")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Auction Overlay */}
          <AnimatePresence>
            {room?.currentAuction && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none"
              >
                <div className="bg-matte-blue-deep/90 backdrop-blur-xl border border-matte-blue-light/30 rounded-[2rem] p-8 shadow-2xl w-[800px] max-w-[95vw] pointer-events-auto flex items-stretch gap-8 relative overflow-hidden">

                  {/* Left Side: Property Card matching PropertyModal EXACTLY */}
                  <div className="w-[300px] shrink-0 relative z-10 flex flex-col">
                    {(() => {
                      const auctionTile = currentBoardData[room.currentAuction.propertyId];
                      const auctionColor = (COLORS as any)[auctionTile.group || ""] || "#87CEEB";

                      const rentRows = [
                        { label: t.withRent, value: auctionTile.rent[0] },
                        { label: t.withOneHouse, value: auctionTile.rent[1] },
                        { label: t.withTwoHouses, value: auctionTile.rent[2] },
                        { label: t.withThreeHouses, value: auctionTile.rent[3] },
                        { label: t.withFourHouses, value: auctionTile.rent[4] },
                        { label: t.withHotel, value: auctionTile.rent[5] }
                      ];

                      return (
                        <div className="flex-1 rounded-[2rem] overflow-hidden flex flex-col bg-matte-blue-deep shadow-2xl relative border border-white/5">
                          {/* Inner Container */}
                          <div className="absolute inset-2 bg-[#1a1c24] rounded-3xl overflow-hidden flex flex-col border border-white/5">

                            {/* Color Header */}
                            <div className="h-20 w-full relative flex items-center justify-center shrink-0 border-b border-white/10" style={{ backgroundColor: auctionColor }}>
                              <div className="absolute inset-0 bg-black/10" />
                              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
                              <h3 className="text-xl font-bold text-white tracking-tight relative z-10 px-4 text-center">
                                {SCHOOL_FULL_NAMES[auctionTile.name]?.[language] || auctionTile.name}
                              </h3>
                            </div>

                            <div className="flex-1 p-5 flex flex-col">
                              {/* Rent table header */}
                              <div className="flex justify-between items-center px-2 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.when}</span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">{t.get}</span>
                              </div>
                              <div className="h-px bg-white/10 mb-2" />

                              {/* Rent rows */}
                              <div className="space-y-0.5 mb-2 flex-1">
                                {rentRows.map((row, idx) => (
                                  <div
                                    key={idx}
                                    className="flex justify-between items-center px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    <span className="text-sm font-medium text-white/50">{row.label}</span>
                                    <span className="text-base font-bold font-mono text-white/40">
                                      {typeof row.value === "number" ? (
                                        <><span className="text-white/30 text-xs mr-0.5">$</span>{row.value}</>
                                      ) : row.value}
                                    </span>
                                  </div>
                                ))}
                              </div>

                              {/* Footer Stats Row */}
                              <div className="h-px bg-white/10 mb-3" />
                              <div className="w-full flex justify-between items-center px-2">
                                <div className="text-center">
                                  <div className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-1">{t.price}</div>
                                  <div className="font-mono text-sm font-bold text-white/70">${auctionTile.price || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="flex justify-center text-white/30 mb-1"><Home size={12} /></div>
                                  <div className="font-mono text-sm font-bold text-white/70">${auctionTile.buildCost || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="flex justify-center text-white/30 mb-1"><Building2 size={12} /></div>
                                  <div className="font-mono text-sm font-bold text-white/70">${auctionTile.buildCost || 0}</div>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Side: Controls & Log */}
                  <div className="flex-1 flex flex-col relative z-10 w-1/2 justify-center pl-6 border-l border-white/10">
                    <div className="text-center text-matte-blue-light font-bold tracking-widest uppercase mb-8 text-xl">
                      {t.auctionTitle}
                    </div>

                    <div className="flex justify-between items-end mb-6 h-[80px]">
                      <div>
                        <div className="text-gray-400 text-sm mb-3 font-medium uppercase tracking-widest">Current bid</div>
                        <div className="flex items-center gap-4">
                          {(() => {
                            const highestBidder = room.players.find((p: any) => p.id === room.currentAuction?.highestBidder);
                            if (highestBidder) {
                              return (
                                <div
                                  className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg border-4"
                                  style={{ backgroundColor: highestBidder.color, borderColor: `${highestBidder.color}40`, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
                                >
                                  {highestBidder.character}
                                </div>
                              );
                            }
                            return <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-2xl border-4 border-white/10 shadow-inner">?</div>;
                          })()}
                          <div className="text-6xl font-black text-white font-mono tracking-tighter drop-shadow-lg">${room.currentAuction.highestBid}</div>
                        </div>
                      </div>

                      {room.currentAuction.bidLog && room.currentAuction.bidLog.length > 0 && (
                        <motion.div
                          key={room.currentAuction.bidLog[0].timestamp}
                          initial={{ opacity: 0, scale: 0.5, y: 20 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          className="text-green-400 font-bold tracking-wider text-2xl mb-2 drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]"
                        >
                          +${room.currentAuction.bidLog[0].amount - (room.currentAuction.bidLog[1]?.amount || 0)}
                        </motion.div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-8 mt-4">
                      <div className="flex justify-end items-center gap-2 text-sm text-gray-400 font-bold mb-3 uppercase tracking-widest">
                        <span>Sold in {room.currentAuction.timer}s...</span>
                        <Gavel size={16} className="text-red-400 ml-1" />
                      </div>
                      <div className="h-4 bg-black/40 rounded-full overflow-hidden shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] border border-white/5 relative">
                        <motion.div
                          className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-orange-400 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                          initial={{ width: "100%" }}
                          animate={{ width: `${(room.currentAuction.timer / 5) * 100}%` }}
                          transition={{ ease: "linear", duration: 1 }}
                        />
                      </div>
                    </div>

                    <div className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-4">I'm bidding...</div>
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      {[
                        { add: 5, label: "+$5" },
                        { add: 10, label: "+$10" },
                        { add: 100, label: "+$100" }
                      ].map((btn) => {
                        const newBid = room.currentAuction.highestBid + btn.add;
                        const canAfford = room.players[room.turn]?.id && room.players.find((p: any) => p.id === socket?.id)?.money >= newBid;

                        return (
                          <button
                            key={btn.add}
                            onClick={() => socket?.emit("place_bid", { roomId: room.id, amount: btn.add })}
                            disabled={!canAfford}
                            className={`rounded-[1.5rem] py-4 flex flex-col items-center justify-center transition-all border ${canAfford
                              ? "bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-[0_4px_15px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_25px_rgba(255,255,255,0.1)] hover:-translate-y-1"
                              : "bg-black/20 border-white/5 text-gray-500 cursor-not-allowed"
                              }`}
                          >
                            <span className="font-black text-2xl font-mono">${newBid}</span>
                            <span className="text-[10px] font-bold tracking-widest uppercase mt-1 opacity-70">{btn.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Bid Log */}
                    <div className="flex-1 min-h-[120px] relative overflow-hidden bg-black/20 rounded-2xl border border-white/5 p-4 flex flex-col justify-end">
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1a1c24] to-transparent z-10 pointer-events-none rounded-b-2xl" />
                      <div className="flex flex-col gap-2 relative z-0">
                        <AnimatePresence initial={false}>
                          {room.currentAuction.bidLog?.slice(0, 4).map((log: any, index: number) => {
                            const bidder = room.players.find((p: any) => p.id === log.bidderId);
                            const isNewest = index === 0;
                            return (
                              <motion.div
                                key={log.timestamp + log.bidderId}
                                initial={{ opacity: 0, x: -20, height: 0 }}
                                animate={{ opacity: 1 - (index * 0.25), x: 0, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className={`flex items-center gap-3 text-sm bg-white/[0.03] p-2 rounded-xl border border-white/[0.02] ${isNewest ? 'text-white border-white/[0.08] bg-white/[0.08] shadow-sm' : 'text-gray-400 font-medium'}`}
                              >
                                {bidder && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border border-white/20" style={{ backgroundColor: bidder.color, fontSize: '12px' }}>
                                      {bidder.character}
                                    </div>
                                    <span className={isNewest ? "font-bold" : ""}>{bidder.name}</span>
                                  </div>
                                )}
                                <span className={`opacity-50 text-xs italic ${isNewest ? 'text-gray-300' : ''}`}>bids</span>
                                <span className={`font-mono ml-auto ${isNewest ? "font-black text-green-400 text-base drop-shadow-md" : "font-bold"}`}>${log.amount}</span>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* The Board Container */}
          <div className="w-full h-full flex items-center justify-center">
            <div
              className="relative rounded-3xl p-1.5 shrink-0 overflow-visible"
              style={{
                width: "min(98vh, 98%)",
                aspectRatio: "1/1",
                display: "grid",
                gridTemplateColumns: "1.8fr repeat(11, 1fr) 1.8fr",
                gridTemplateRows: "1.8fr repeat(11, 1fr) 1.8fr",
                gap: "6px"
              }}
              onClick={() => setExpandedTileId(null)}
            >
              {/* Grid Layout - Tiles */}
              {currentBoardData.map((tile, index) => {
                // Calculate grid position for 13x13 grid
                let gridArea = "";
                let side: 'top' | 'right' | 'bottom' | 'left' | 'corner' = 'corner';

                if (index === 0 || index === 12 || index === 24 || index === 36) side = 'corner';
                else if (index < 12) side = 'top';
                else if (index < 24) side = 'right';
                else if (index < 36) side = 'bottom';
                else side = 'left';

                if (index <= 12) gridArea = `1 / ${index + 1}`; // Top row
                else if (index <= 24) gridArea = `${index - 11} / 13`; // Right column
                else if (index <= 36) gridArea = `13 / ${13 - (index - 24)}`; // Bottom row
                else gridArea = `${13 - (index - 36)} / 1`; // Left column

                const isExpandable = tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY";
                const isExpanded = expandedTileId === tile.id;
                // Expand toward board center so tile stays in frame
                const expandOrigin = side === "top" || (side === "corner" && (index === 0 || index === 12)) ? "top center"
                  : side === "bottom" || (side === "corner" && index === 24) ? "bottom center"
                    : side === "left" || (side === "corner" && index === 36) ? "center left"
                      : "center right";

                const tileColor = tile.type === "PROPERTY" && tile.group ? (COLORS as any)[tile.group] : "#87CEEB";
                // Determine popover position based on side — always expand toward board center / upward
                const isUpperHalf = side === 'right' ? index <= 18 : side === 'left' ? index >= 42 : false;
                const popoverStyle: React.CSSProperties = isExpanded ? (
                  side === 'top' ? { top: '105%', left: '50%', transform: 'translateX(-50%)' } :
                    side === 'bottom' ? { bottom: '105%', left: '50%', transform: 'translateX(-50%)' } :
                      side === 'left' ? (isUpperHalf ? { left: '105%', top: '0' } : { left: '105%', bottom: '0' }) :
                        side === 'right' ? (isUpperHalf ? { right: '105%', top: '0' } : { right: '105%', bottom: '0' }) :
                          { bottom: '105%', left: '50%', transform: 'translateX(-50%)' }
                ) : {};

                return (
                  <motion.div
                    key={tile.id}
                    style={{
                      gridArea,
                      zIndex: isExpanded ? 50 : undefined,
                      transformOrigin: isExpanded ? expandOrigin : "center center",
                      ...(isExpanded && tile.type === "PROPERTY" && tile.group ? {
                        boxShadow: `0 0 0 2px ${tileColor}cc, 0 0 20px ${tileColor}55`
                      } : {})
                    }}
                    title={tile.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isExpandable) {
                        if (isExpanded) {
                          setSelectedPropertyId(tile.id);
                          setExpandedTileId(null);
                        } else {
                          setExpandedTileId(tile.id);
                        }
                      }
                    }}
                    initial={false}
                    animate={{ scale: isExpanded ? 1.25 : 1 }}
                    transition={{ type: "spring", stiffness: 380, damping: 26 }}
                    className={`rounded-xl border flex flex-col items-center justify-between p-0.5 text-center relative group shadow-lg cursor-pointer ${isExpanded ? "overflow-visible border-white/20" : "overflow-hidden border-white/5"} ${!isExpanded ? "hover:bg-white/10 hover:scale-[1.02] transition-all" : ""} ${tile.type === "START" || tile.type === "PRISON" || tile.type === "VACATION" || tile.type === "GO_TO_JAIL" ? "bg-white/10" : "bg-transparent"}`}
                  >
                    {tile.type === "PROPERTY" && (
                      <div
                        className={`absolute z-20 ${side === 'top' ? 'bottom-0 left-0 right-0 h-3' :
                          side === 'bottom' ? 'top-0 left-0 right-0 h-3' :
                            side === 'left' ? 'top-0 bottom-0 right-0 w-3' :
                              side === 'right' ? 'top-0 bottom-0 left-0 w-3' :
                                side === 'corner' ? 'top-0 left-0 right-0 h-3' : ''
                          }`}
                        style={{ backgroundColor: (COLORS as any)[tile.group || ""] }}
                      />
                    )}

                    {/* Watermark / Stamp System */}
                    {(() => {
                      const owner = room?.players.find(p => p.properties.includes(tile.id));
                      if (owner) {
                        return (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden opacity-80">
                            <div
                              className="-rotate-45 border-4 rounded-md px-1 py-0.5 text-[11px] font-black tracking-[0.2em] uppercase"
                              style={{
                                borderColor: owner.color,
                                color: owner.color,
                                backgroundColor: owner.color + '1a'
                              }}
                            >
                              OWNED
                            </div>
                          </div>
                        );
                      } else if (tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY") {
                        return (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                            <div className="text-[28px] font-black text-white opacity-[0.06] -rotate-45 select-none whitespace-nowrap">
                              ${tile.price}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className={`flex flex-col items-center ${side === 'top' ? 'justify-start pt-0.5' : 'justify-center'} h-full w-full z-20 py-0.5 gap-0.5 relative`}>
                      {tile.type === "START" && (
                        <div className="flex flex-col items-center text-white scale-90 sm:scale-100 md:scale-110">
                          <ArrowRight size={40} strokeWidth={3} />
                          <span className="text-base font-black tracking-tighter italic">GO</span>
                        </div>
                      )}
                      {tile.type === "PRISON" && (
                        <div className="flex flex-col items-center gap-1 scale-90 sm:scale-100 md:scale-110">
                          <Lock size={32} className="text-gray-400" />
                          <div className="flex gap-1">
                            {[1, 2, 3, 4].map(i => <div key={i} className="w-0.5 h-8 bg-gray-600 rounded-full" />)}
                          </div>
                        </div>
                      )}
                      {tile.type === "VACATION" && (
                        <div className="flex flex-col items-center scale-90 sm:scale-100 md:scale-110 relative">
                          <Palmtree size={36} className="text-yellow-400" />
                          {room?.vacationCash > 0 && (
                            <div className="absolute -bottom-4 bg-black/60 px-1 py-0.5 rounded border border-yellow-400/30">
                              <span className="text-yellow-400 font-mono font-bold text-[10px]">${room.vacationCash}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {tile.type === "GO_TO_JAIL" && (
                        <div className="flex flex-col items-center scale-90 sm:scale-100 md:scale-110">
                          <Skull size={36} className="text-red-500" />
                        </div>
                      )}
                      {tile.type === "AIRPORT" && (
                        side === 'top' ? (
                          <>
                            <span className="text-[9px] line-clamp-1">{language === "AR" ? `مدرسة ${tile.name}` : tile.name}</span>
                            <GraduationCap size={20} className="text-blue-400 mt-auto" />
                          </>
                        ) : (
                          <div className="flex flex-col items-center">
                            <GraduationCap size={20} className="text-blue-400" />
                            <span className="text-[9px] line-clamp-1">{language === "AR" ? `مدرسة ${tile.name}` : tile.name}</span>
                          </div>
                        )
                      )}
                      {tile.type === "COMPANY" && (
                        side === 'top' ? (
                          <>
                            <span className="text-[9px] line-clamp-1">{tile.name}</span>
                            <Building2 size={20} className="text-purple-400 mt-auto" />
                          </>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Building2 size={20} className="text-purple-400" />
                            <span className="text-[9px] line-clamp-1">{tile.name}</span>
                          </div>
                        )
                      )}
                      {(tile.type === "TREASURE" || tile.type === "SURPRISE") && (
                        side === 'top' ? (
                          <>
                            <span className="text-[9px] line-clamp-1">{tile.name}</span>
                            <div className={`mt-auto p-2 rounded-xl bg-white/5 w-full flex items-center justify-center ${tile.type === "TREASURE" ? "text-2xl" : "text-2xl font-black text-matte-blue-light"}`}>
                              {tile.type === "TREASURE" ? "💰" : "?"}
                            </div>
                          </>
                        ) : (
                          <div className={`p-2 rounded-xl bg-white/5 w-full h-full flex items-center justify-center ${tile.type === "TREASURE" ? "text-2xl" : "text-2xl font-black text-matte-blue-light"}`}>
                            {tile.type === "TREASURE" ? "💰" : "?"}
                          </div>
                        )
                      )}
                      {tile.type === "TAX" && (
                        side === 'top' ? (
                          <>
                            <span className="text-[9px] line-clamp-1">{tile.name}</span>
                            <div className="mt-auto flex flex-col items-center">
                              <AlertTriangle size={20} className="text-red-400" />
                              <span className="text-[9px] text-red-400 font-mono">{tile.id === 4 ? "15%" : "$100"}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center">
                            <AlertTriangle size={20} className="text-red-400" />
                            <span className="text-[9px] line-clamp-1 text-center leading-tight">{tile.name}</span>
                            <span className="text-[9px] text-red-400 font-mono">{tile.id === 4 ? "15%" : "$100"}</span>
                          </div>
                        )
                      )}

                      {tile.type === "PROPERTY" && (
                        side === 'top' ? (
                          <span className="text-[9px] font-black uppercase tracking-tighter line-clamp-2 text-center">{tile.name}</span>
                        ) : (
                          <div className="mt-auto flex flex-col items-center w-full px-1">
                            <span className="text-[9px] font-black uppercase tracking-tighter line-clamp-2 text-center">{tile.name}</span>
                          </div>
                        )
                      )}
                    </div>

                    {/* Owner Indicator - REMOVED */}

                    {/* Property Level Indicator */}
                    {tile.type === "PROPERTY" && room?.propertyLevels[tile.id] > 0 && (
                      <div className="absolute z-30 inset-0 flex items-center justify-center pointer-events-none">
                        {room.propertyLevels[tile.id] === 5 ? (
                          <div className="drop-shadow-md">
                            <Building2
                              size={24}
                              style={{ color: (COLORS as any)[tile.group || ""] }}
                            />
                          </div>
                        ) : (
                          <div className="relative flex items-center justify-center w-12 h-6">
                            {Array.from({ length: room.propertyLevels[tile.id] }).map((_, i) => {
                              const offset = (i - (room.propertyLevels[tile.id] - 1) / 2) * 10;
                              return (
                                <div
                                  key={i}
                                  className="absolute drop-shadow-md"
                                  style={{
                                    left: `calc(50% + ${offset}px - 9px)`,
                                    color: (COLORS as any)[tile.group || ""]
                                  }}
                                >
                                  <Home size={18} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Players on this tile */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {room?.players?.filter(p => (visualPositions[p.id] ?? p.position) === index).map((p, i, arr) => {
                          const offset = (i - (arr.length - 1) / 2) * 8;
                          return (
                            <motion.div
                              key={p.id}
                              layoutId={`player-token-${p.id}`}
                              initial={false}
                              animate={{
                                x: offset,
                                y: -5
                              }}
                              transition={{
                                type: "spring",
                                stiffness: 200,
                                damping: 25,
                                mass: 0.8
                              }}
                              className="z-40"
                            >
                              <PlayerToken
                                color={p.color}
                                character={p.character}
                                direction={
                                  index <= 12 ? "right" :
                                    index <= 24 ? "down" :
                                      index <= 36 ? "left" : "up"
                                }
                                isCurrentPlayer={room?.players[room?.turn]?.id === p.id}
                              />
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                    {/* Popover card — rent details tethered to tile */}
                    {isExpandable && isExpanded && (() => {
                      const currentLevel = room?.propertyLevels[tile.id] || 0;
                      const owner = room?.players.find(p => p.properties.includes(tile.id));
                      const rentRows: { label: string; value: number | string }[] =
                        tile.type === "PROPERTY" && tile.rent ? [
                          { label: t.withRent, value: tile.rent[0] },
                          { label: t.withOneHouse, value: tile.rent[1] },
                          { label: t.withTwoHouses, value: tile.rent[2] },
                          { label: t.withThreeHouses, value: tile.rent[3] },
                          { label: t.withFourHouses, value: tile.rent[4] },
                          { label: t.withHotel, value: tile.rent[5] },
                        ] : tile.type === "AIRPORT" && tile.rent ? [
                          { label: language === "AR" ? "مدرسة واحدة" : "1 school", value: tile.rent[0] },
                          { label: language === "AR" ? "مدرستان" : "2 schools", value: tile.rent[1] },
                          { label: language === "AR" ? "3 مدارس" : "3 schools", value: tile.rent[2] },
                          { label: language === "AR" ? "4 مدارس" : "4 schools", value: tile.rent[3] },
                        ] : tile.type === "COMPANY" ? [
                          { label: language === "AR" ? "شركة واحدة" : "1 company", value: "dice × 4" },
                          { label: language === "AR" ? "الشركتان" : "Both companies", value: "dice × 10" },
                        ] : [];

                      return (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.18, ease: "easeOut" }}
                          className="absolute z-50 pointer-events-none"
                          style={{ width: "220px", ...popoverStyle }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            className="rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-xl"
                            style={{
                              background: "linear-gradient(160deg, #1a2130ee 0%, #0d1117f5 100%)",
                              borderColor: tileColor + "55",
                              boxShadow: `0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px ${tileColor}33`
                            }}
                          >
                            {/* Color bar */}
                            {tile.type === "PROPERTY" && tile.group && (
                              <div className="h-1.5 w-full" style={{ backgroundColor: tileColor }} />
                            )}

                            <div className="px-4 pt-3 pb-2">
                              {/* Property name */}
                              <div className="text-center mb-3">
                                <h3 className="text-sm font-bold text-white tracking-tight text-center px-1">
                                  {SCHOOL_FULL_NAMES[tile.name as keyof typeof SCHOOL_FULL_NAMES]?.[language] || tile.name}
                                </h3>
                                {tile.type === "PROPERTY" && tile.group && AREA_NAMES[tile.group] && (
                                  <div className="mt-1.5 flex justify-center">
                                    <div
                                      className="px-2 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-widest text-white shadow-sm"
                                      style={{
                                        backgroundColor: `${tileColor}33`,
                                        borderColor: tileColor,
                                      }}
                                    >
                                      {AREA_NAMES[tile.group][language]}
                                    </div>
                                  </div>
                                )}
                                {owner && (
                                  <div className="flex items-center justify-center gap-1.5 mt-1">
                                    <div className="w-2.5 h-2.5 rounded-full border border-white/20" style={{ backgroundColor: owner.color }} />
                                    <span className="text-[10px] text-white/50 font-medium">{owner.name}</span>
                                  </div>
                                )}
                              </div>

                              {/* Rent table header */}
                              <div className="flex justify-between items-center px-1 mb-1.5">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{t.when}</span>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">{t.get}</span>
                              </div>
                              <div className="h-px bg-white/10 mb-1.5" />

                              {/* Rent rows */}
                              <div className="space-y-0.5">
                                {rentRows.map((row, idx) => {
                                  const isActive = idx === currentLevel;
                                  return (
                                    <div
                                      key={idx}
                                      className={`flex justify-between items-center px-2 py-1 rounded-lg transition-colors ${isActive ? "bg-white/10" : ""}`}
                                    >
                                      <span className={`text-[11px] font-medium ${isActive ? "text-white" : "text-white/50"}`}>{row.label}</span>
                                      <span className={`text-[12px] font-bold font-mono ${isActive ? "text-white" : "text-white/40"}`}>
                                        {typeof row.value === "number" ? (
                                          <><span className="text-white/30 text-[10px] mr-0.5">$</span>{row.value}</>
                                        ) : row.value}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Footer stats */}
                              {(tile.price || tile.buildCost) && (
                                <>
                                  <div className="h-px bg-white/10 mt-2.5 mb-2" />
                                  <div className="grid grid-cols-3 gap-1 text-center">
                                    <div>
                                      <div className="text-[9px] text-white/30 uppercase font-bold tracking-wide mb-0.5">{t.price}</div>
                                      <div className="text-[11px] font-bold text-white font-mono">
                                        <span className="text-white/30 text-[9px]">$</span>{tile.price}
                                      </div>
                                    </div>
                                    {tile.buildCost && (
                                      <>
                                        <div>
                                          <div className="flex justify-center mb-0.5 text-white/30"><Home size={10} /></div>
                                          <div className="text-[11px] font-bold text-white font-mono">
                                            <span className="text-white/30 text-[9px]">$</span>{tile.buildCost}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="flex justify-center mb-0.5 text-white/30"><Building2 size={10} /></div>
                                          <div className="text-[11px] font-bold text-white font-mono">
                                            <span className="text-white/30 text-[9px]">$</span>{tile.buildCost}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                    {!tile.buildCost && (
                                      <div className="col-span-2 flex items-center justify-center">
                                        <span className="text-[9px] text-white/20 italic">{language === "AR" ? "اضغط للمزيد" : "Tap again for details"}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-2 text-center">
                                    <span className="text-[9px] text-white/20 italic">{language === "AR" ? "اضغط مجدداً لفتح التفاصيل" : "Tap again for full details"}</span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </motion.div>
                );
              })}

              {/* Center Area */}
              <div
                className="bg-matte-blue-deep/40 backdrop-blur-sm border border-white/5 rounded-3xl flex flex-col items-center justify-center p-4 relative overflow-hidden"
                style={{ gridArea: "2 / 2 / 13 / 13" }}
              >
                {/* Background Logo */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.03] z-0">
                  <h1 className="text-[10vw] font-black tracking-tighter text-white whitespace-nowrap">
                    BANK ELHAZ <span className="text-[3vw] lowercase">.io</span>
                  </h1>
                </div>

                <div className="flex flex-col items-center gap-6 z-10">
                  <div className="flex gap-12">
                    <Dice value={room?.dice[0] || 1} isRolling={isRolling} />
                    <Dice value={room?.dice[1] || 1} isRolling={isRolling} />
                  </div>

                  {room?.players[room?.turn]?.id === socket?.id && !isRolling && (
                    <div className="flex flex-col items-center gap-4">
                      {room.players[room.turn].inJail && (
                        <button
                          onClick={() => socket?.emit("pay_jail", { roomId: room.id })}
                          className="bg-rose-600 text-white font-black text-sm px-8 py-3 rounded-xl hover:bg-rose-500 transition-all shadow-lg shadow-rose-500/20 active:scale-95 flex items-center gap-2"
                        >
                          <Lock size={16} /> {t.pay_jail || "دفع 50$ للخروج"}
                        </button>
                      )}
                      {(!room.hasRolled || room.isDouble) ? (
                        <button
                          onClick={rollDice}
                          className="bg-white text-black font-black text-xl px-16 py-4 rounded-xl hover:bg-gray-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
                        >
                          {t.roll}
                        </button>
                      ) : (
                        <button
                          onClick={() => socket?.emit("end_turn", { roomId: room.id })}
                          className="bg-white/10 border border-white/10 text-white font-black text-sm px-12 py-3 rounded-xl hover:bg-white/20 transition-all active:scale-95"
                        >
                          {t.endTurn}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Battle Log */}
                <div className="w-full max-w-md flex flex-col mt-4 text-center">
                  <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2 flex items-center justify-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-matte-blue-light/50 animate-pulse" />
                    {t.battleLog}
                  </h4>
                  <div
                    className="h-32 overflow-y-auto space-y-1 text-[11px] font-medium text-gray-500 scrollbar-hide pr-1"
                    style={{
                      maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                      WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)'
                    }}
                  >
                    {battleLog.map((log, i) => {
                      const player = log.playerId ? room?.players.find(p => p.id === log.playerId) : null;
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={i}
                          className="leading-relaxed flex items-center justify-center gap-2"
                        >
                          {player && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: player.color }} />}
                          <span className="truncate">
                            {formatLog(log)}
                            {log.card && (
                              <button
                                onClick={() => {
                                  setDrawnCard({ roomId: room?.id || "", card: log.card, playerId: log.playerId, type: log.card.effect === "add_money" || log.card.effect === "sub_money" || log.card.effect === "pay_all" || log.card.effect === "property_tax" ? (log.card.amount > 0 ? "TREASURE" : "SURPRISE") : "SURPRISE" });
                                  setTimeout(() => setDrawnCard(null), 3000);
                                }}
                                className="ml-2 text-[9px] font-black text-white px-2 py-0.5 rounded backdrop-blur-sm transition-all hover:scale-110 active:scale-95 border uppercase tracking-widest"
                                style={{
                                  backgroundColor: log.type === "gain_money_card" ? "rgba(201, 168, 76, 0.2)" : "rgba(168, 85, 247, 0.2)",
                                  borderColor: log.type === "gain_money_card" ? "#C9A84C" : "#A855F7",
                                  color: log.type === "gain_money_card" ? "#C9A84C" : "#A855F7"
                                }}
                              >
                                VIEW
                              </button>
                            )}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Property Actions Overlay */}
                {room?.players[room?.turn]?.id === socket?.id && room.hasRolled && !isRolling && !room.currentAuction && (
                  <div className="mt-4 flex gap-4">
                    {(() => {
                      const player = room?.players[room?.turn];
                      if (!player) return null;
                      const tile = currentBoardData[player.position];
                      const isOwned = room?.players?.some(p => p.properties.includes(tile.id));
                      const canBuy = (tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY") && !isOwned;

                      if (canBuy) {
                        return (
                          <>
                            <button
                              onClick={() => socket?.emit("buy_property", { roomId: room.id })}
                              className="bg-emerald-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                            >
                              {t.buy} (${tile.price})
                            </button>
                            <button
                              onClick={() => socket?.emit("start_auction", { roomId: room.id })}
                              className="bg-white/10 border border-white/10 text-white font-bold px-8 py-3 rounded-xl hover:bg-white/20 transition-all active:scale-95"
                            >
                              {t.auction}
                            </button>
                          </>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Players & Settings */}
        <aside className="w-80 border-l border-white/5 bg-matte-blue-deep/40 backdrop-blur-md flex flex-col z-50">
          <div className="p-4 border-b border-white/5 bg-matte-blue-light/10 flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-widest text-matte-blue-light">{t.playerList}</span>
            <Users size={16} className="text-matte-blue-light/60" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Player List */}
            <div className="space-y-2">
              {room?.players?.map((player) => (
                <div key={player.id} className="relative">
                  <button
                    onClick={() => setSelectedPlayerId(selectedPlayerId === player.id ? null : player.id)}
                    className={`w-full relative overflow-hidden flex items-center justify-between p-3 rounded-xl border transition-all ${room?.players[room?.turn]?.id === player.id ? "border-matte-blue-light/50 bg-matte-blue-light/10 shadow-[0_0_15px_rgba(48,58,72,0.1)]" : "border-white/5 bg-white/5 hover:bg-white/10"}`}
                  >
                    {/* Character Background */}

                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: player.color }} />
                      <div className="text-left">
                        <div className="text-sm font-bold flex items-center gap-2">
                          {player.name}
                          {player.id === socket?.id && <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded uppercase">{t.you}</span>}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono">${player.money}</div>
                      </div>
                    </div>

                    {player.id === socket?.id && !player.isBankrupt && (
                      <button
                        onClick={(e) => { e.stopPropagation(); socket?.emit("bankrupt", { roomId: room?.id }); }}
                        className="relative z-20 flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-2 py-1 rounded-lg transition-all text-[10px] font-bold"
                      >
                        <AlertTriangle size={12} /> {language === "EN" ? "Bankrupt" : "إفلاس"}
                      </button>
                    )}

                    {room?.players[room?.turn]?.id === player.id && (
                      <div className="relative z-10 w-2 h-2 rounded-full bg-matte-blue-light animate-pulse" />
                    )}
                  </button>

                  <AnimatePresence>
                    {selectedPlayerId === player.id && player.id !== socket?.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute top-full mt-1 right-0 left-0 bg-[#1a1a1a] border border-white/10 rounded-xl p-2 shadow-2xl z-[100]"
                      >
                        <button
                          onClick={() => {
                            setTradeTarget(player);
                            setIsTradeOpen(true);
                            setSelectedPlayerId(null);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs transition-colors"
                        >
                          <Handshake size={14} className="text-matte-blue-light" /> {t.trade}
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs transition-colors text-gray-500">
                          <ArrowUp size={14} /> {t.steal}
                        </button>
                        <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs transition-colors">
                          <MessageSquare size={14} className="text-blue-400" /> {t.privateChat}
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Active Trades */}
            {room?.pendingTrades && room.pendingTrades.length > 0 && (
              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Handshake size={18} className="text-matte-blue-light" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-matte-blue-light">
                      {language === "EN" ? "Active Trades" : "المقايضات النشطة"}
                    </h3>
                  </div>
                  <div className="px-2 py-0.5 bg-matte-blue-mid/20 text-matte-blue-light text-[10px] font-bold rounded-full border border-matte-blue-mid/30">
                    {room.pendingTrades.length}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                  {room.pendingTrades.map((trade: any) => {
                    const isIncoming = trade.targetId === socket?.id;
                    return (
                      <button
                        key={trade.id}
                        onClick={() => setViewingTrade(trade)}
                        className={`w-full border rounded-2xl p-4 text-left transition-all group relative overflow-hidden ${isIncoming
                          ? "bg-matte-blue-mid/5 border-matte-blue-mid/20 hover:bg-matte-blue-mid/10"
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                          }`}
                      >
                        {isIncoming && (
                          <div className="absolute top-0 right-0 px-2 py-0.5 bg-matte-blue-mid text-white text-[8px] font-bold uppercase tracking-tighter rounded-bl-lg">
                            {language === "EN" ? "Incoming" : "وارد"}
                          </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[11px] font-bold text-gray-300 uppercase tracking-tight">
                            {trade.senderName} ↔ {trade.targetName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <div className="flex -space-x-1">
                            {trade.senderProperties.slice(0, 3).map((id: number) => (
                              <div key={id} className="w-2 h-2 rounded-full border border-black" style={{ backgroundColor: currentBoardData[id].color }} />
                            ))}
                            {trade.senderProperties.length > 3 && <div className="text-[8px] pl-1">+{trade.senderProperties.length - 3}</div>}
                          </div>
                          <span className="truncate">
                            {trade.senderMoney > 0 ? `$${trade.senderMoney}` : ""}
                            {trade.senderProperties.length > 0 && trade.senderMoney > 0 ? " + " : ""}
                            {trade.senderProperties.length > 0 ? `${trade.senderProperties.length} props` : ""}
                            {trade.senderProperties.length === 0 && trade.senderMoney === 0 ? "Nothing" : ""}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-[9px] text-matte-blue-light font-bold flex items-center gap-1">
                            <History size={10} /> {language === "EN" ? "View Details" : "عرض التفاصيل"}
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-matte-blue-light animate-pulse" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <SettingsIcon size={16} className="text-gray-400" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">{t.roomSettings}</h3>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.startingMoney}</span>
                  <span className="font-mono text-gray-300">${room?.settings?.startingMoney}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.turnTimer}</span>
                  <span className="font-mono text-gray-300">{room?.settings?.turnTimer}s</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.auction}</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${room?.settings?.auction ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.auction ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.allowTrading}</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${room?.settings?.allowTrading ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.allowTrading ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.vacationCash}</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${room?.settings?.vacationCash ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.vacationCash ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.prisonNoRent}</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${room?.settings?.prisonNoRent ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.prisonNoRent ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-matte-blue-light/60">{t.randomizePlayerOrder}</span>
                  <div className={`w-8 h-4 rounded-full relative transition-colors ${room?.settings?.randomizePlayerOrder ? "bg-matte-blue-mid" : "bg-matte-blue-deep"}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${room?.settings?.randomizePlayerOrder ? "right-0.5" : "left-0.5"}`} />
                  </div>
                </div>
              </div>
            </div>

            {/* Trade Log Button */}
            <div className="pt-4 border-t border-white/5">
              <button
                onClick={() => setIsTradeLogOpen(true)}
                className="w-full bg-matte-blue-light/10 hover:bg-matte-blue-light/20 border border-matte-blue-light/20 text-matte-blue-light py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm font-bold"
              >
                <History size={16} /> {t.tradeLog}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Trade Log Modal */}
      <AnimatePresence>
        {isTradeLogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-matte-blue-deep border border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Handshake className="text-matte-blue-light" /> {t.tradeLog}
                </h3>
                <button onClick={() => setIsTradeLogOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                {room?.tradeLog?.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <History size={48} className="mx-auto mb-4 opacity-20" />
                    <p>{t.noActiveTrades}</p>
                  </div>
                ) : (
                  room?.tradeLog?.filter((t: any) => t.status !== "PENDING").slice().reverse().map((trade: any) => (
                    <div
                      key={trade.id}
                      onClick={() => setViewingTrade(trade)}
                      className="bg-white/5 rounded-2xl p-6 border border-white/5 space-y-4 cursor-pointer hover:bg-white/10 transition-all"
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className="text-lg font-bold">{trade.senderName}</div>
                          <div className="text-matte-blue-light">↔</div>
                          <div className="text-lg font-bold">{trade.targetName}</div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${trade.status === "ACCEPTED" ? "bg-emerald-500/20 text-emerald-400" :
                          trade.status === "DECLINED" ? "bg-rose-500/20 text-rose-400" :
                            trade.status === "CANCELED" ? "bg-gray-500/20 text-gray-400" :
                              "bg-matte-blue-mid/20 text-matte-blue-light animate-pulse"
                          }`}>
                          {trade.status === "ACCEPTED" ? "مقبول" :
                            trade.status === "DECLINED" ? "مرفوض" :
                              trade.status === "CANCELED" ? "ملغي" : "معلق"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{trade.senderName} يعطي:</p>
                          <div className="space-y-1">
                            {trade.senderProperties.map((id: number) => (
                              <div key={id} className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBoardData[id].color }} />
                                {currentBoardData[id].name}
                              </div>
                            ))}
                            {trade.senderMoney > 0 && <div className="text-emerald-400 font-mono text-sm">+ ${trade.senderMoney}</div>}
                            {trade.senderProperties.length === 0 && trade.senderMoney === 0 && <div className="text-gray-600 italic text-sm">لا شيء</div>}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{trade.targetName} يعطي:</p>
                          <div className="space-y-1">
                            {trade.targetProperties.map((id: number) => (
                              <div key={id} className="flex items-center gap-2 text-sm">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentBoardData[id].color }} />
                                {currentBoardData[id].name}
                              </div>
                            ))}
                            {trade.targetMoney > 0 && <div className="text-emerald-400 font-mono text-sm">+ ${trade.targetMoney}</div>}
                            {trade.targetProperties.length === 0 && trade.targetMoney === 0 && <div className="text-gray-600 italic text-sm">لا شيء</div>}
                          </div>
                        </div>
                      </div>

                      {trade.status === "PENDING" && (
                        <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                          {trade.senderId === socket?.id ? (
                            <button
                              onClick={() => socket?.emit("cancel_trade", { roomId: room.id, tradeId: trade.id })}
                              className="px-4 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all text-sm font-bold"
                            >
                              إلغاء العرض
                            </button>
                          ) : trade.targetId === socket?.id ? (
                            <>
                              <button
                                onClick={() => socket?.emit("decline_trade", { roomId: room.id, tradeId: trade.id })}
                                className="px-4 py-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all text-sm font-bold"
                              >
                                رفض
                              </button>
                              <button
                                onClick={() => socket?.emit("accept_trade", { roomId: room.id, tradeId: trade.id })}
                                className="px-4 py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 transition-all text-sm font-bold"
                              >
                                قبول
                              </button>
                            </>
                          ) : (
                            <div className="text-xs text-gray-500 italic">في انتظار الرد...</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedPropertyId !== null && (
          <PropertyModal
            property={{
              ...currentBoardData.find(p => p.id === selectedPropertyId),
              level: room?.propertyLevels[selectedPropertyId || -1] || 0
            }}
            owner={room?.players.find(p => p.properties.includes(selectedPropertyId || -1))}
            onClose={() => setSelectedPropertyId(null)}
            onUpgrade={() => socket?.emit("upgrade_property", { roomId: room?.id, propertyId: selectedPropertyId })}
            onDowngrade={() => socket?.emit("downgrade_property", { roomId: room?.id, propertyId: selectedPropertyId })}
            onSell={() => socket?.emit("sell_property", { roomId: room?.id, propertyId: selectedPropertyId })}
            onMortgage={() => socket?.emit("mortgage_property", { roomId: room?.id, propertyId: selectedPropertyId })}
            isMortgaged={room?.mortgagedProperties.includes(selectedPropertyId || -1)}
            isCurrentPlayerOwner={room?.players.find(p => p.properties.includes(selectedPropertyId || -1))?.id === socket?.id}
            canUpgrade={(() => {
              if (selectedPropertyId === null) return false;
              const property = currentBoardData.find(p => p.id === selectedPropertyId);
              const owner = room?.players.find(p => p.properties.includes(selectedPropertyId || -1));
              if (!property || !owner || property.type !== "PROPERTY") return false;
              const sameGroupTiles = currentBoardData.filter(t => t.group === property.group);
              const ownerHasFullSet = sameGroupTiles.every(t => owner.properties.includes(t.id));

              let evenBuildAllowed = true;
              if (room?.settings.evenBuild) {
                const currentLevel = room?.propertyLevels[selectedPropertyId] || 0;
                const otherLevels = sameGroupTiles
                  .filter(t => t.id !== selectedPropertyId)
                  .map(t => room?.propertyLevels[t.id] || 0);
                if (currentLevel > Math.min(...otherLevels)) {
                  evenBuildAllowed = false;
                }
              }

              return ownerHasFullSet && (room?.propertyLevels[selectedPropertyId] || 0) < 5 && evenBuildAllowed;
            })()}
            t={t}
            language={language}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawnCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -50 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDrawnCard(null)}
          >
            <div className={`w-80 max-w-full rounded-3xl p-8 border-4 shadow-2xl flex flex-col items-center text-center bg-[#252D38]
              ${drawnCard.type === "TREASURE" ? "border-[#C9A84C]" : "border-purple-500"}
              relative overflow-hidden`}>
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30
                ${drawnCard.type === "TREASURE" ? "bg-[#C9A84C]" : "bg-purple-500"}`} />

              <h2 className={`text-2xl font-black mb-6 uppercase tracking-widest z-10
                ${drawnCard.type === "TREASURE" ? "text-[#C9A84C]" : "text-purple-400"}`}>
                {drawnCard.type === "TREASURE" ? "صندوق الكنز 🪙" : "المفاجأة ❓"}
              </h2>

              <div className="text-6xl mb-6 z-10 drop-shadow-lg">
                {drawnCard.card.text.split(" ").pop()}
              </div>

              <p className="text-xl font-bold text-white z-10 leading-relaxed">
                {drawnCard.card.text.split(" ").slice(0, -1).join(" ")}
              </p>

              {drawnCard.playerId !== socket?.id && (
                <div className="mt-6 text-sm text-gray-400 z-10 font-medium">
                  {room?.players.find((p: any) => p.id === drawnCard.playerId)?.name} drew this...
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSwapSelection && room && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a1c24] border border-white/10 p-8 rounded-3xl max-w-md w-full text-center relative shadow-2xl">
              <button onClick={() => setShowSwapSelection(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
              <h2 className="text-2xl font-black mb-6">اختر لاعب للتبديل معه 🔄</h2>
              <div className="space-y-3">
                {room.players.filter((p: any) => !p.isBankrupt && p.id !== socket?.id).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      socket?.emit("swap_position", { roomId: room.id, targetId: p.id });
                      setShowSwapSelection(false);
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-bold group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: p.color }} />
                      <span>{p.name}</span>
                    </div>
                    <ArrowRightLeft size={16} className="text-gray-500 group-hover:text-white" />
                  </button>
                ))}
                {room.players.filter((p: any) => !p.isBankrupt && p.id !== socket?.id).length === 0 && (
                  <p className="text-gray-400 py-4">لا يوجد لاعبين آخرين للتبديل معهم.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
