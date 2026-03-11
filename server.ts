import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { BOARD_DATA, PLAYER_COLORS, PLAYER_CHARACTERS, EGYPTIAN_NAMES } from "./src/constants";

const TREASURE_CARDS = [
  { text: "خالتك بعتتلك فلوس 🎁", effect: "add_money", amount: 50 },
  { text: "ادفع صدقة لكل لاعب 🤲", effect: "pay_all", amount: 30 },
  { text: "ربحت في اليانصيب 🎰", effect: "add_money", amount: 200 },
  { text: "عطلة مرضية 🏥", effect: "sub_money", amount: 100 },
  { text: "بيع تحف قديمة 🏺", effect: "add_money", amount: 80 },
  { text: "فاتورة الكهرباء جت 💡", effect: "sub_money", amount: 60 },
  { text: "هدية عيد ميلاد من اللاعبين 🎂", effect: "collect_all", amount: 40 },
  { text: "ضريبة الأملاك 🏛️", effect: "property_tax", amount: 50 },
  { text: "مكافأة نهاية السنة 💼", effect: "add_money", amount: 150 },
  { text: "غرامة مخالفة مرور 🚗", effect: "sub_money", amount: 40 },
  { text: "استثمار ناجح في البورصة 📈", effect: "add_money", amount: 120 },
  { text: "دفعت فاتورة النت 📡", effect: "sub_money", amount: 25 },
];

const SURPRISE_CARDS = [
  { text: "ارجع 3 خطوات للوراء ⬅️", effect: "move_back", amount: 3 },
  { text: "روح السجن مباشرة 👮", effect: "go_jail" },
  { text: "انطلق على Salvador 🌴", effect: "go_to", tile: 11 },
  { text: "روح على New York 🗽", effect: "go_to", tile: 39 },
  { text: "تعالى على GO واقبض $200 ➡️", effect: "go_start" },
  { text: "تقدم 4 خطوات للأمام ➡️", effect: "move_forward", amount: 4 },
  { text: "روح على أقرب مطار ✈️", effect: "nearest_airport" },
  { text: "بطاقة الخروج من السجن مجاناً 🔑", effect: "jail_free" },
  { text: "تبادل مكانك مع أي لاعب تختاره 🔄", effect: "swap_position" },
  { text: "ارجع للخلف لحد أول عقار 🔙", effect: "back_to_unowned" },
  { text: "كل اللاعبين يتحركوا خطوة للأمام 🎲", effect: "all_forward_1" },
  { text: "مش هتدفع إيجار الدور الجاي 🛡️", effect: "rent_immunity" },
];

function shuffleArray(array: any[]) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}
import { PrismaClient } from "@prisma/client";
import { OAuth2Client } from "google-auth-library";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json()); // For POST body parsing

  app.post("/api/auth/google", async (req, res) => {
    try {
      const { token } = req.body;
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      if (!payload || !payload.sub) {
        return res.status(400).json({ error: "Invalid token" });
      }

      const user = await prisma.user.upsert({
        where: { id: payload.sub },
        update: {
          picture: payload.picture || null, // Deliberately omit name so we don't overwrite custom names
        },
        create: {
          id: payload.sub,
          email: payload.email || "",
          name: payload.given_name || payload.name || "Unknown",
          picture: payload.picture || null,
          coins: 0,
        },
        include: { unlocks: true }
      });

      res.json({ user });
    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/user/name", async (req, res) => {
    try {
      const { token, newName } = req.body;
      if (!newName || newName.trim() === "") return res.status(400).json({ error: "Name cannot be empty" });

      const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) return res.status(400).json({ error: "Invalid token" });

      const updatedUser = await prisma.user.update({
        where: { id: payload.sub },
        data: { name: newName.trim() },
        include: { unlocks: true }
      });

      res.json({ user: updatedUser });
    } catch (error) {
      console.error("Name update error:", error);
      res.status(500).json({ error: "Failed to update name" });
    }
  });

  app.post("/api/shop/buy", async (req, res) => {
    try {
      const { token, itemId, price } = req.body;
      const ticket = await googleClient.verifyIdToken({ idToken: token, audience: process.env.GOOGLE_CLIENT_ID });
      const payload = ticket.getPayload();
      if (!payload || !payload.sub) return res.status(400).json({ error: "Invalid token" });

      const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { unlocks: true } });
      if (!user) return res.status(404).json({ error: "User not found" });

      if (user.unlocks.some(u => u.itemId === itemId)) {
        return res.status(400).json({ error: "Already owned" });
      }

      if (user.coins < price) {
        return res.status(400).json({ error: "Not enough coins" });
      }

      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          coins: user.coins - price,
          unlocks: { create: { itemId } }
        },
        include: { unlocks: true }
      });

      res.json({ user: updatedUser });
    } catch (error) {
      console.error("Shop error:", error);
      res.status(500).json({ error: "Purchase failed" });
    }
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Game State Management
  const rooms = new Map<string, any>();
  const disconnectTimers = new Map<string, NodeJS.Timeout>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("get_rooms", () => {
      const activeRooms = Array.from(rooms.values())
        .filter(r => r.gameState === "LOBBY" && r.players.length < 6)
        .map(r => ({
          id: r.id,
          playersCount: r.players.length,
          settings: r.settings
        }));
      socket.emit("rooms_list", activeRooms);
    });

    socket.on("join_room", ({ roomId, playerName, color, character, authId }) => {
      socket.join(roomId);

      if (!rooms.has(roomId)) {
        rooms.set(roomId, {
          id: roomId,
          players: [],
          gameState: "LOBBY",
          settings: {
            startingMoney: 1500,
            map: "giza_streets",
            turnTimer: 60,
            auction: true,
            evenBuild: true,
            allowTrading: true,
            doubleRentFullSet: true,
            vacationCash: false,
            prisonNoRent: false,
            mortgage: true,
            randomizePlayerOrder: true
          },
          history: [],
          tradeLog: [],
          pendingTrades: [],
          turn: 0,
          dice: [1, 1],
          hasRolled: false,
          isDouble: false,
          currentAuction: null,
          mustActOnProperty: null,
          propertyLevels: {},
          mortgagedProperties: [],
          board: [],
          vacationCash: 0,
          chanceDeck: shuffleArray(SURPRISE_CARDS),
          treasureDeck: shuffleArray(TREASURE_CARDS)
        });
      }

      const room = rooms.get(roomId);
      if (!room) return;

      // Reconnection Logic: Match by authId OR name (to handle rapid refreshes where disconnect isn't processed yet)
      const existingPlayer = room.players.find((p: any) => 
        (authId && p.authId === authId) || (p.name === playerName)
      );

      if (existingPlayer) {
        const timerKey = `${roomId}:${existingPlayer.name}`;
        if (disconnectTimers.has(timerKey)) {
          clearTimeout(disconnectTimers.get(timerKey)!);
          disconnectTimers.delete(timerKey);
        }

        // If the old socket is still there, make it leave to avoid duplicates
        const oldSocket = io.sockets.sockets.get(existingPlayer.id);
        if (oldSocket && oldSocket.id !== socket.id) {
          oldSocket.leave(roomId);
        }

        existingPlayer.id = socket.id;
        existingPlayer.isDisconnected = false;
        existingPlayer.authId = authId || existingPlayer.authId; // Update authId if it was missing
        
        console.log(`[Room ${roomId}] Player ${playerName} re-joined and claimed existing slot.`);
        io.to(roomId).emit("room_update", room);
        return;
      }

      if (room.gameState !== "LOBBY") {
        socket.emit("error", "Game already started");
        return;
      }

      if (room.players.length >= 6) {
        socket.emit("error", "Room full");
        return;
      }

      // Handle name uniqueness (ignore disconnected players who we might want to re-link to)
      let finalName = playerName;
      let counter = 2;
      while (room.players.some((p: any) => p.name === finalName && !p.isDisconnected)) {
        finalName = `${playerName}${counter}`;
        counter++;
      }

      const newPlayer = {
        id: socket.id,
        authId: authId || null,
        name: finalName,
        color: color || PLAYER_COLORS.find(c => !room.players.some((p: any) => p.color === c)) || PLAYER_COLORS[0],
        character: character || PLAYER_CHARACTERS.find(c => !room.players.some((p: any) => p.character === c)) || PLAYER_CHARACTERS[0],
        money: room.settings.startingMoney,
        position: 0,
        properties: [],
        isBankrupt: false,
        inJail: false,
        jailTurns: 0,
        jailCards: 0,
        isHost: room.players.length === 0,
        isReady: room.players.length === 0, // Host is always ready
        isBot: false,
        isDisconnected: false,
        disconnectTime: null,
        doubleCount: 0,
        rentImmunity: false
      };

      room.players.push(newPlayer);
      io.to(roomId).emit("room_update", room);
    });

    socket.on("select_character", ({ roomId, color, character }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "LOBBY") {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          if (color && !room.players.some((p: any) => p.id !== socket.id && p.color === color)) {
            room.players[playerIndex].color = color;
          }
          if (character && !room.players.some((p: any) => p.id !== socket.id && p.character === character)) {
            room.players[playerIndex].character = character;
          }
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("swap_position", ({ roomId, targetId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const me = room.players.find((p: any) => p.id === socket.id);
        const target = room.players.find((p: any) => p.id === targetId);
        if (me && target && !me.isBankrupt && !target.isBankrupt) {
          const temp = me.position;
          me.position = target.position;
          target.position = temp;
          room.history.push({ type: "swap_position", playerName: me.name, targetName: target.name, playerId: me.id });
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("trade", ({ roomId, targetId, myProperties, theirProperties, myMoney, theirMoney }) => {
      const room = rooms.get(roomId);
      const me = room?.players.find((p: any) => p.id === socket.id);
      const target = room?.players.find((p: any) => p.id === targetId);

      if (me && target && !me.isBankrupt && !target.isBankrupt) {
        const tradeOffer = {
          id: Math.random().toString(36).substr(2, 9),
          senderId: me.id,
          senderName: me.name,
          targetId: target.id,
          targetName: target.name,
          senderProperties: myProperties,
          targetProperties: theirProperties,
          senderMoney: myMoney,
          targetMoney: theirMoney,
          status: "PENDING",
          timestamp: Date.now()
        };

        room.pendingTrades.push(tradeOffer);
        room.tradeLog.push(tradeOffer);
        room.history.push({ type: "send_trade", playerName: me.name, targetName: target.name, playerId: me.id });
        io.to(roomId).emit("room_update", room);

        // If target is a bot, handle it
        if (target.isBot) {
          handleBotTradeResponse(room, roomId, target, tradeOffer);
        }
      }
    });

    socket.on("accept_trade", ({ roomId, tradeId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const tradeIndex = room.pendingTrades.findIndex((t: any) => t.id === tradeId);
      if (tradeIndex === -1) return;

      const trade = room.pendingTrades[tradeIndex];
      const me = room.players.find((p: any) => p.id === trade.senderId);
      const target = room.players.find((p: any) => p.id === trade.targetId);

      if (me && target && !me.isBankrupt && !target.isBankrupt) {
        // Verify resources again
        const hasMyProps = trade.senderProperties.every((id: number) => me.properties.includes(id));
        const hasTheirProps = trade.targetProperties.every((id: number) => target.properties.includes(id));

        if (hasMyProps && hasTheirProps && me.money >= trade.senderMoney && target.money >= trade.targetMoney) {
          // Perform trade
          me.money -= trade.senderMoney;
          me.money += trade.targetMoney;
          target.money -= trade.targetMoney;
          target.money += trade.senderMoney;

          trade.senderProperties.forEach((id: number) => {
            me.properties = me.properties.filter((pid: number) => pid !== id);
            target.properties.push(id);
          });
          trade.targetProperties.forEach((id: number) => {
            target.properties = target.properties.filter((pid: number) => pid !== id);
            me.properties.push(id);
          });

          trade.status = "ACCEPTED";
          room.pendingTrades.splice(tradeIndex, 1);

          // Update status in tradeLog
          const logEntry = room.tradeLog.find((t: any) => t.id === tradeId);
          if (logEntry) logEntry.status = "ACCEPTED";

          room.history.push({ type: "accept_trade", playerName: target.name, senderName: me.name, playerId: target.id });
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("decline_trade", ({ roomId, tradeId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const tradeIndex = room.pendingTrades.findIndex((t: any) => t.id === tradeId);
      if (tradeIndex !== -1) {
        const trade = room.pendingTrades[tradeIndex];
        trade.status = "DECLINED";
        room.pendingTrades.splice(tradeIndex, 1);

        const logEntry = room.tradeLog.find((t: any) => t.id === tradeId);
        if (logEntry) logEntry.status = "DECLINED";

        room.history.push({ type: "decline_trade", playerName: trade.targetName, senderName: trade.senderName, playerId: trade.targetId });
        io.to(roomId).emit("room_update", room);
      }
    });

    socket.on("cancel_trade", ({ roomId, tradeId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      const tradeIndex = room.pendingTrades.findIndex((t: any) => t.id === tradeId);
      if (tradeIndex !== -1) {
        const trade = room.pendingTrades[tradeIndex];
        if (trade.senderId === socket.id) {
          trade.status = "CANCELED";
          room.pendingTrades.splice(tradeIndex, 1);

          const logEntry = room.tradeLog.find((t: any) => t.id === tradeId);
          if (logEntry) logEntry.status = "CANCELED";

          room.history.push({ type: "cancel_trade", playerName: trade.senderName, playerId: trade.senderId });
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("bankrupt", ({ roomId }) => {
      const room = rooms.get(roomId);
      const player = room?.players.find((p: any) => p.id === socket.id);
      if (player && !player.isBankrupt) {
        player.isBankrupt = true;
        player.money = 0;
        // Sell all properties
        player.properties.forEach((propertyId: number) => {
          // Return property to bank (remove owner, reset level)
          delete room.propertyLevels[propertyId];
          // If mortgaged, remove from mortgaged list
          room.mortgagedProperties = room.mortgagedProperties.filter((id: number) => id !== propertyId);
        });
        player.properties = [];
        room.history.push({ type: "bankrupt", playerName: player.name, playerId: player.id });
        io.to(roomId).emit("room_update", room);
      }
    });

    socket.on("add_bot", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "LOBBY" && room.players.length < 6) {
        const host = room.players.find((p: any) => p.id === socket.id);
        if (host?.isHost) {
          const usedNames = room.players.map((p: any) => p.name);
          const usedColors = room.players.map((p: any) => p.color);
          const usedCharacters = room.players.map((p: any) => p.character);

          // Find a unique name
          const availableNames = EGYPTIAN_NAMES.filter(n => !usedNames.includes(n));
          const name = availableNames.length > 0
            ? availableNames[Math.floor(Math.random() * availableNames.length)]
            : `روبوت ${room.players.length}`;

          const color = PLAYER_COLORS.find(c => !usedColors.includes(c)) || "#FFFFFF";
          const character = PLAYER_CHARACTERS.find(c => !usedCharacters.includes(c)) || "🤖";

          const botPlayer = {
            id: `bot_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            color: color,
            character: character,
            money: room.settings.startingMoney,
            position: 0,
            properties: [],
            isBankrupt: false,
            inJail: false,
            jailTurns: 0,
            jailCards: 0,
            isHost: false,
            isReady: true,
            isBot: true,
            doubleCount: 0,
            personality: {
              greed: 0.8 + Math.random() * 0.4,
              risk: 0.5 + Math.random() * 1.0,
              trading: 0.7 + Math.random() * 0.6
            }
          };

          room.players.push(botPlayer);
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("select_character", ({ roomId, color, character }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "LOBBY") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player) {
          // Check if color or character is already taken by someone else
          const colorTaken = room.players.some((p: any) => p.id !== player.id && p.color === color);
          const characterTaken = room.players.some((p: any) => p.id !== player.id && p.character === character);

          if (!colorTaken && !characterTaken) {
            player.color = color;
            player.character = character;
            io.to(roomId).emit("room_update", room);
          } else {
            socket.emit("error", "هذا اللون أو الشخصية مأخوذة بالفعل");
          }
        }
      }
    });

    socket.on("update_settings", ({ roomId, settings }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "LOBBY") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player?.isHost) {
          room.settings = { ...room.settings, ...settings };
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("toggle_ready", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "LOBBY") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player) {
          player.isReady = !player.isReady;
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("start_game", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "LOBBY") {
        const player = room.players.find((p: any) => p.id === socket.id);
        const allReady = room.players.every((p: any) => p.isReady);
        if (player?.isHost && room.players.length >= 2 && allReady) {
          room.gameState = "PLAYING";
          room.turn = 0;
          io.to(roomId).emit("game_started", room);

          // If first player is a bot
          if (room.players[0].isBot) {
            handleBotTurn(room, roomId, room.players[0]);
          }
        }
      }
    });

    socket.on("pay_jail", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players[room.turn];
        if (player.id === socket.id && player.inJail && player.money >= 50) {
          player.money -= 50;
          player.inJail = false;
          player.jailTurns = 0;
          room.history.push({ type: "pay_jail", playerName: player.name, playerId: player.id });
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("roll_dice", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex === room.turn) {
          const currentPlayer = room.players[playerIndex];

          // Prevent rolling twice unless double
          if (room.hasRolled && !room.isDouble) return;

          currentPlayer.rentImmunity = false; // Reset rent immunity at start of their roll

          let d1 = Math.floor(Math.random() * 6) + 1;
          let d2 = Math.floor(Math.random() * 6) + 1;

          // Anti-frustration: reduce double chance by half (prevent it from feeling too frequent)
          if (d1 === d2 && Math.random() > 0.5) {
            d2 = (d2 % 6) + 1;
          }

          room.dice = [d1, d2];
          room.isDouble = (d1 === d2);
          room.hasRolled = true;

          if (currentPlayer.inJail) {
            if (room.isDouble) {
              currentPlayer.inJail = false;
              currentPlayer.jailTurns = 0;
              room.history.push({ type: "jail_double", playerName: currentPlayer.name, playerId: currentPlayer.id });
              // Continue with movement below
            } else {
              currentPlayer.jailTurns += 1;
              if (currentPlayer.jailTurns >= 2) {
                currentPlayer.inJail = false;
                currentPlayer.jailTurns = 0;
                currentPlayer.money -= 50;
                room.history.push({ type: "jail_2_turns", playerName: currentPlayer.name, playerId: currentPlayer.id });
                // Continue with movement below
              } else {
                room.history.push({ type: "still_in_jail", playerName: currentPlayer.name, turns: currentPlayer.jailTurns, playerId: currentPlayer.id });
                io.to(roomId).emit("dice_rolled", {
                  dice: room.dice,
                  player: currentPlayer.id,
                  position: currentPlayer.position,
                  room: room,
                  isDouble: false
                });
                return;
              }
            }
          }

          if (room.isDouble) {
            currentPlayer.doubleCount += 1;
            if (currentPlayer.doubleCount >= 3) {
              currentPlayer.position = 12; // Jail
              currentPlayer.inJail = true;
              currentPlayer.doubleCount = 0;
              room.isDouble = false; // End turn after jail
              room.history.push({ type: "jail_3_doubles", playerName: currentPlayer.name, playerId: currentPlayer.id });
              io.to(roomId).emit("dice_rolled", {
                dice: room.dice,
                player: currentPlayer.id,
                position: currentPlayer.position,
                room: room,
                isDouble: false
              });

              // End turn immediately after going to jail
              setTimeout(() => {
                nextTurn(room, roomId);
              }, 1500);
              return;
            }
          } else {
            currentPlayer.doubleCount = 0;
          }

          const total = d1 + d2;
          const oldPos = currentPlayer.position;
          currentPlayer.position = (currentPlayer.position + total) % 48;

          // Pass START bonus
          if (currentPlayer.position < oldPos) {
            currentPlayer.money += 200;
            room.history.push({ type: "pass_start", playerName: currentPlayer.name, playerId: currentPlayer.id });
          }

          const tile = BOARD_DATA[currentPlayer.position];
          room.history.push({ type: "land_on", playerName: currentPlayer.name, tileName: tile.name, playerId: currentPlayer.id });

          // Handle Tile Action
          handleTileAction(room, currentPlayer, tile, total);

          io.to(roomId).emit("dice_rolled", {
            dice: room.dice,
            player: currentPlayer.id,
            position: currentPlayer.position,
            room: room,
            isDouble: room.isDouble
          });
        }
      }
    });

    socket.on("start_auction", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players[room.turn];
        if (player.id === socket.id && room.hasRolled) {
          const tile = BOARD_DATA[player.position];
          if ((tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY") && !room.players.some((p: any) => p.properties.includes(tile.id))) {
            room.currentAuction = {
              propertyId: tile.id,
              highestBid: 0,
              highestBidder: null,
              timer: 5,
              participants: room.players.filter((p: any) => !p.isBankrupt).map((p: any) => p.id),
              bidLog: []
            };
            room.history.push({ type: "start_auction", playerName: player.name, tileName: tile.name, playerId: player.id });
            io.to(roomId).emit("room_update", room);
            startAuctionTimer(roomId);
          }
        }
      }
    });

    socket.on("place_bid", ({ roomId, amount }) => {
      const room = rooms.get(roomId);
      if (room && room.currentAuction) {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player && !player.isBankrupt && player.money >= room.currentAuction.highestBid + amount) {
          room.currentAuction.highestBid += amount;
          room.currentAuction.highestBidder = player.id;
          room.currentAuction.timer = 5; // Reset timer
          room.currentAuction.bidLog.unshift({
            bidderId: player.id,
            bidderName: player.name,
            amount: room.currentAuction.highestBid,
            timestamp: Date.now()
          });
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    function startAuctionTimer(roomId: string) {
      const interval = setInterval(() => {
        const room = rooms.get(roomId);
        if (!room || !room.currentAuction) {
          clearInterval(interval);
          return;
        }

        room.currentAuction.timer -= 1;

        // Bot bidding logic during auction
        room.players.forEach((p: any) => {
          if (p.isBot && !p.isBankrupt && room.currentAuction) {
            handleBotAuctionBid(room, roomId, p);
          }
        });

        if (room.currentAuction.timer <= 0) {
          clearInterval(interval);
          endAuction(roomId);
        } else {
          io.to(roomId).emit("auction_timer", { timer: room.currentAuction.timer });
        }
      }, 1000);
    }

    function endAuction(roomId: string) {
      const room = rooms.get(roomId);
      if (room && room.currentAuction) {
        const auction = room.currentAuction;
        if (auction.highestBidder) {
          const winner = room.players.find((p: any) => p.id === auction.highestBidder);
          if (winner) {
            winner.money -= auction.highestBid;
            winner.properties.push(auction.propertyId);
            const tile = BOARD_DATA[auction.propertyId];
            room.history.push({ type: "win_auction", playerName: winner.name, tileName: tile.name, amount: auction.highestBid, playerId: winner.id });
          }
        } else {
          room.history.push({ type: "no_one_bought", playerId: null });
        }
        room.currentAuction = null;
        room.mustActOnProperty = null;
        io.to(roomId).emit("room_update", room);
      }
    }

    socket.on("buy_property", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players[room.turn];
        if (player.id === socket.id && room.hasRolled) {
          const tile = BOARD_DATA[player.position];
          if (tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY") {
            const isOwned = room.players.some((p: any) => p.properties.includes(tile.id));
            if (!isOwned && player.money >= (tile.price || 0)) {
              player.money -= (tile.price || 0);
              player.properties.push(tile.id);
              room.propertyLevels[tile.id] = 0;
              room.mustActOnProperty = null;
              room.history.push({ type: "buy_property", playerName: player.name, tileName: tile.name, playerId: player.id });
              io.to(roomId).emit("room_update", room);
            }
          }
        }
      }
    });

    socket.on("upgrade_property", ({ roomId, propertyId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player && player.properties.includes(propertyId)) {
          const tile = BOARD_DATA[propertyId];
          if (tile.type === "PROPERTY") {
            const currentLevel = room.propertyLevels[propertyId] || 0;
            if (currentLevel < 5 && player.money >= (tile.buildCost || 0)) {
              // Check full set rule
              const sameGroupTiles = BOARD_DATA.filter(t => t.group === tile.group);
              const ownerHasFullSet = sameGroupTiles.every(t => player.properties.includes(t.id));
              if (!ownerHasFullSet) {
                socket.emit("error", "لازم تمتلك كل المجموعة عشان تطور");
                return;
              }

              // Check even build rule
              if (room.settings.evenBuild) {
                const otherLevels = sameGroupTiles
                  .filter(t => t.id !== propertyId)
                  .map(t => room.propertyLevels[t.id] || 0);

                if (currentLevel > Math.min(...otherLevels)) {
                  socket.emit("error", "لازم تبني بالتساوي في المجموعة دي");
                  return;
                }
              }

              player.money -= (tile.buildCost || 0);
              room.propertyLevels[propertyId] = currentLevel + 1;
              room.history.push({ type: "upgrade_property", playerName: player.name, tileName: tile.name, level: room.propertyLevels[propertyId], playerId: player.id });
              io.to(roomId).emit("room_update", room);
            }
          }
        }
      }
    });

    socket.on("downgrade_property", ({ roomId, propertyId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player && player.properties.includes(propertyId)) {
          const tile = BOARD_DATA[propertyId];
          const currentLevel = room.propertyLevels[propertyId] || 0;
          if (currentLevel > 0) {
            player.money += Math.floor((tile.buildCost || 0) / 2);
            room.propertyLevels[propertyId] = currentLevel - 1;
            room.history.push({ type: "downgrade_property", playerName: player.name, tileName: tile.name, playerId: player.id });
            io.to(roomId).emit("room_update", room);
          }
        }
      }
    });

    socket.on("mortgage_property", ({ roomId, propertyId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player && player.properties.includes(propertyId)) {
          const currentLevel = room.propertyLevels[propertyId] || 0;
          if (currentLevel === 0) {
            const isMortgaged = room.mortgagedProperties.includes(propertyId);
            const tile = BOARD_DATA[propertyId];
            if (!isMortgaged) {
              player.money += Math.floor((tile.price || 0) / 2);
              room.mortgagedProperties.push(propertyId);
              room.history.push({ type: "mortgage_property", playerName: player.name, tileName: tile.name, playerId: player.id });
            } else {
              const unmortgageCost = Math.floor((tile.price || 0) / 2 * 1.1); // 10% interest
              if (player.money >= unmortgageCost) {
                player.money -= unmortgageCost;
                room.mortgagedProperties = room.mortgagedProperties.filter((id: number) => id !== propertyId);
                room.history.push({ type: "unmortgage_property", playerName: player.name, tileName: tile.name, playerId: player.id });
              }
            }
            io.to(roomId).emit("room_update", room);
          } else {
            socket.emit("error", "لازم تبيع البيوت الأول");
          }
        }
      }
    });

    socket.on("sell_property", ({ roomId, propertyId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player && player.properties.includes(propertyId)) {
          const currentLevel = room.propertyLevels[propertyId] || 0;
          if (currentLevel === 0) {
            const tile = BOARD_DATA[propertyId];
            player.money += Math.floor((tile.price || 0) / 2);
            player.properties = player.properties.filter((id: number) => id !== propertyId);
            room.history.push({ type: "sell_property", playerName: player.name, tileName: tile.name, playerId: player.id });
            io.to(roomId).emit("room_update", room);
          } else {
            socket.emit("error", "لازم تبيع البيوت الأول");
          }
        }
      }
    });

    socket.on("end_turn", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        if (room.players[room.turn].id === socket.id) {
          if (room.mustActOnProperty) {
            socket.emit("error", "لازم تشتري أو تعرض العقار للمزاد قبل ما تنهي دورك");
            return;
          }
          nextTurn(room, roomId);
        }
      }
    });

    function nextTurn(room: any, roomId: string) {
      const currentPlayer = room.players[room.turn];
      if (currentPlayer) currentPlayer.doubleCount = 0;

      room.hasRolled = false;
      room.isDouble = false;
      room.mustActOnProperty = null;
      room.turn = (room.turn + 1) % room.players.length;

      // Skip bankrupt players
      let attempts = 0;
      while (room.players[room.turn].isBankrupt && attempts < room.players.length) {
        room.turn = (room.turn + 1) % room.players.length;
        attempts++;
      }

      // Check if game over
      const activePlayers = room.players.filter((p: any) => !p.isBankrupt);
      if (activePlayers.length <= 1) {
        room.gameState = "GAME_OVER";
        room.history.push({ type: "game_over", winnerName: activePlayers[0]?.name || "محدش", playerId: activePlayers[0]?.id });

        // Distribute Coins to Winner
        const winner = activePlayers[0];
        if (winner && winner.authId) {
          prisma.user.update({
            where: { id: winner.authId },
            data: { coins: { increment: 100 } }
          }).catch(err => console.error("Coin reward error:", err));
        }
      }

      io.to(roomId).emit("room_update", room);

      // Check if next player is a bot
      const nextPlayer = room.players[room.turn];
      if (nextPlayer.isBot) {
        handleBotTurn(room, roomId, nextPlayer);
      }
    }

    async function handleBotTurn(room: any, roomId: string, bot: any) {
      if (bot.isBankrupt) {
        nextTurn(room, roomId);
        return;
      }

      // 0. Strategic Management (Mortgage/Sell if low on cash)
      if (bot.money < 100) {
        handleBotFinancialCrisis(room, roomId, bot);
      }

      // Wait a bit to simulate thinking
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 1. Roll Dice
      let d1 = Math.floor(Math.random() * 6) + 1;
      let d2 = Math.floor(Math.random() * 6) + 1;

      // Anti-frustration: reduce double chance by half
      if (d1 === d2 && Math.random() > 0.5) {
        d2 = (d2 % 6) + 1;
      }

      room.dice = [d1, d2];
      room.isDouble = (d1 === d2);
      room.hasRolled = true;

      if (room.isDouble) {
        bot.doubleCount += 1;
        if (bot.doubleCount >= 3) {
          bot.position = 12; // Jail
          bot.inJail = true;
          bot.doubleCount = 0;
          room.isDouble = false;
          room.history.push({ type: "jail_3_doubles", playerName: bot.name, playerId: bot.id });
          io.to(roomId).emit("dice_rolled", {
            dice: room.dice,
            player: bot.id,
            position: bot.position,
            room: room,
            isDouble: false
          });

          setTimeout(() => {
            nextTurn(room, roomId);
          }, 1500);
          return;
        }
      } else {
        bot.doubleCount = 0;
      }

      const total = d1 + d2;
      const oldPos = bot.position;
      if (!bot.inJail) {
        bot.position = (bot.position + total) % 48;
        if (bot.position < oldPos) {
          bot.money += 200;
          room.history.push({ type: "pass_start", playerName: bot.name, playerId: bot.id });
        }
      }

      const tile = BOARD_DATA[bot.position];
      room.history.push({ type: "land_on", playerName: bot.name, tileName: tile.name, playerId: bot.id });

      handleTileAction(room, bot, tile, total);

      io.to(roomId).emit("dice_rolled", {
        dice: room.dice,
        player: bot.id,
        position: bot.position,
        room: room,
        isDouble: room.isDouble
      });

      // 2. Strategic Buying
      // Increase delay to 3.5s to ensure animation finishes
      await new Promise(resolve => setTimeout(resolve, 3500));
      if (!bot.isBankrupt && (tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY")) {
        const isOwned = room.players.some((p: any) => p.properties.includes(tile.id));
        if (!isOwned) {
          const price = tile.price || 0;
          const shouldBuy = bot.money >= price + 150; // Keep $150 reserve

          if (shouldBuy) {
            bot.money -= price;
            bot.properties.push(tile.id);
            room.propertyLevels[tile.id] = 0;
            room.history.push({ type: "buy_property", playerName: bot.name, tileName: tile.name, playerId: bot.id });
            room.mustActOnProperty = null;
            io.to(roomId).emit("room_update", room);
          } else {
            // Start auction if bot doesn't buy
            room.currentAuction = {
              propertyId: tile.id,
              highestBid: 0,
              highestBidder: null,
              timer: 5,
              participants: room.players.filter((p: any) => !p.isBankrupt).map((p: any) => p.id),
              bidLog: []
            };
            room.history.push({ type: "start_auction", playerName: bot.name, tileName: tile.name, playerId: bot.id });
            io.to(roomId).emit("room_update", room);
            startAuctionTimer(roomId);
          }
        }
      }

      // 3. Strategic Upgrading
      await new Promise(resolve => setTimeout(resolve, 1000));
      handleBotUpgrades(room, roomId, bot);

      // 4. Strategic Trading (Occasionally try to complete sets)
      if (Math.random() < 0.2) {
        handleBotInitiateTrade(room, roomId, bot);
      }

      // 5. Handle Double Roll or End Turn
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (room.isDouble && !bot.isBankrupt && !bot.inJail) {
        handleBotTurn(room, roomId, bot);
      } else {
        nextTurn(room, roomId);
      }
    }

    function handleBotFinancialCrisis(room: any, roomId: string, bot: any) {
      // 1. Sell houses first
      const propertiesWithHouses = bot.properties.filter((id: number) => (room.propertyLevels[id] || 0) > 0);
      for (const propId of propertiesWithHouses) {
        if (bot.money >= 200) break;
        const tile = BOARD_DATA[propId];
        const currentLevel = room.propertyLevels[propId];
        bot.money += Math.floor((tile.buildCost || 0) / 2);
        room.propertyLevels[propId] = currentLevel - 1;
        room.history.push({ type: "sell_house_crisis", playerName: bot.name, tileName: tile.name, playerId: bot.id });
      }

      // 2. Mortgage properties
      const propertiesToMortgage = bot.properties.filter((id: number) => !room.mortgagedProperties.includes(id) && (room.propertyLevels[id] || 0) === 0);
      for (const propId of propertiesToMortgage) {
        if (bot.money >= 200) break;
        const tile = BOARD_DATA[propId];
        bot.money += Math.floor((tile.price || 0) / 2);
        room.mortgagedProperties.push(propId);
        room.history.push({ type: "mortgage_property_crisis", playerName: bot.name, tileName: tile.name, playerId: bot.id });
      }
      io.to(roomId).emit("room_update", room);
    }

    function handleBotUpgrades(room: any, roomId: string, bot: any) {
      // 1. Unmortgage if possible
      const mortgaged = room.mortgagedProperties.filter((id: number) => bot.properties.includes(id));
      for (const propId of mortgaged) {
        const tile = BOARD_DATA[propId];
        const cost = Math.floor((tile.price || 0) / 2 * 1.1);
        if (bot.money >= cost + 500) { // Keep $500 reserve
          bot.money -= cost;
          room.mortgagedProperties = room.mortgagedProperties.filter((id: number) => id !== propId);
          room.history.push({ type: "unmortgage_property", playerName: bot.name, tileName: tile.name, playerId: bot.id });
        }
      }

      // 2. Build houses
      const ownedProperties = bot.properties.filter((id: number) => BOARD_DATA[id].type === "PROPERTY");
      const groups = [...new Set(ownedProperties.map((id: number) => BOARD_DATA[id].group))];

      for (const group of groups) {
        const groupTiles = BOARD_DATA.filter(t => t.group === group);
        const hasFullSet = groupTiles.every(t => bot.properties.includes(t.id));

        if (hasFullSet) {
          // Try to upgrade each property in the set evenly
          for (const tile of groupTiles) {
            const currentLevel = room.propertyLevels[tile.id] || 0;
            const buildCost = tile.buildCost || 0;

            if (currentLevel < 5 && bot.money >= buildCost + 400 * (bot.personality?.risk || 1)) {
              // Even build check
              const otherLevels = groupTiles.filter(t => t.id !== tile.id).map(t => room.propertyLevels[t.id] || 0);
              if (!room.settings.evenBuild || currentLevel <= Math.min(...otherLevels)) {
                bot.money -= buildCost;
                room.propertyLevels[tile.id] = currentLevel + 1;
                room.history.push({ type: "upgrade_property", playerName: bot.name, tileName: tile.name, level: currentLevel + 1, playerId: bot.id });
              }
            }
          }
        }
      }
      io.to(roomId).emit("room_update", room);
    }

    function handleBotAuctionBid(room: any, roomId: string, bot: any) {
      if (!room.currentAuction) return;
      const auction = room.currentAuction;
      const tile = BOARD_DATA[auction.propertyId];
      const baseValue = tile.price || 100;

      // Strategic valuation
      let valuation = baseValue * (bot.personality?.greed || 1);

      // Increase valuation if it completes a set
      if (tile.type === "PROPERTY") {
        const sameGroupTiles = BOARD_DATA.filter(t => t.group === tile.group);
        const ownedInGroup = sameGroupTiles.filter(t => bot.properties.includes(t.id)).length;
        if (ownedInGroup === sameGroupTiles.length - 1) {
          valuation = baseValue * 1.8; // Willing to pay more to complete set
        } else if (ownedInGroup > 0) {
          valuation = baseValue * 1.2;
        }
      }

      if (auction.highestBid < valuation && bot.money >= auction.highestBid + 10 && auction.highestBidder !== bot.id) {
        if (Math.random() < 0.5) {
          const bidIncrease = 5 + Math.floor(Math.random() * 25);
          if (bot.money >= auction.highestBid + bidIncrease) {
            auction.highestBid += bidIncrease;
            auction.highestBidder = bot.id;
            auction.timer = 5;
            auction.bidLog.unshift({
              bidderId: bot.id,
              bidderName: bot.name,
              amount: auction.highestBid,
              timestamp: Date.now()
            });
            io.to(roomId).emit("room_update", room);
          }
        }
      }
    }

    async function handleBotTradeResponse(room: any, roomId: string, bot: any, trade: any) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Evaluate trade
      let score = 0;
      const personality = bot.personality || { greed: 1, risk: 1, trading: 1 };

      // Money evaluation
      score += (trade.senderMoney - trade.targetMoney) / (10 * personality.greed);

      // Property evaluation
      trade.senderProperties.forEach((id: number) => {
        const tile = BOARD_DATA[id];
        score += (tile.price || 100) / 10;
        const sameGroup = BOARD_DATA.filter(t => t.group === tile.group);
        const owned = sameGroup.filter(t => bot.properties.includes(t.id)).length;
        if (owned === sameGroup.length - 1) score += 60;
      });

      trade.targetProperties.forEach((id: number) => {
        const tile = BOARD_DATA[id];
        score -= (tile.price || 100) / 10;
        const sameGroup = BOARD_DATA.filter(t => t.group === tile.group);
        const hasFullSet = sameGroup.every(t => bot.properties.includes(t.id));
        if (hasFullSet) score -= 120;
      });

      if (score > 15 / personality.trading) {
        executeTrade(room, roomId, trade.id);
      } else if (score > -10 && Math.random() < 0.6) {
        // Counter-offer: Try to balance with money
        const diff = Math.floor((15 - score) * 10);
        if (trade.senderMoney + diff <= room.players.find((p: any) => p.id === trade.senderId).money) {
          // Propose counter-offer
          const counterOffer = {
            id: Math.random().toString(36).substr(2, 9),
            senderId: bot.id,
            senderName: bot.name,
            targetId: trade.senderId,
            targetName: trade.senderName,
            senderProperties: trade.targetProperties,
            targetProperties: trade.senderProperties,
            senderMoney: 0,
            targetMoney: Math.max(0, trade.senderMoney + diff),
            status: "PENDING",
            timestamp: Date.now()
          };
          declineTrade(room, roomId, trade.id);
          room.pendingTrades.push(counterOffer);
          room.tradeLog.push(counterOffer);
          room.history.push({ type: "counter_offer", playerName: bot.name, targetName: trade.senderName, playerId: bot.id });
          io.to(roomId).emit("room_update", room);
        } else {
          declineTrade(room, roomId, trade.id);
        }
      } else {
        declineTrade(room, roomId, trade.id);
      }
    }

    function executeTrade(room: any, roomId: string, tradeId: string) {
      const tradeIndex = room.pendingTrades.findIndex((t: any) => t.id === tradeId);
      if (tradeIndex === -1) return;

      const trade = room.pendingTrades[tradeIndex];
      const sender = room.players.find((p: any) => p.id === trade.senderId);
      const target = room.players.find((p: any) => p.id === trade.targetId);

      if (sender && target) {
        sender.money -= trade.senderMoney;
        sender.money += trade.targetMoney;
        target.money -= trade.targetMoney;
        target.money += trade.senderMoney;

        trade.senderProperties.forEach((id: number) => {
          sender.properties = sender.properties.filter((pid: number) => pid !== id);
          target.properties.push(id);
        });
        trade.targetProperties.forEach((id: number) => {
          target.properties = target.properties.filter((pid: number) => pid !== id);
          sender.properties.push(id);
        });

        trade.status = "ACCEPTED";
        room.pendingTrades.splice(tradeIndex, 1);
        const logEntry = room.tradeLog.find((t: any) => t.id === tradeId);
        if (logEntry) logEntry.status = "ACCEPTED";
        room.history.push({ type: "accept_trade", playerName: target.name, senderName: sender.name, playerId: target.id });
        io.to(roomId).emit("room_update", room);
      }
    }

    function declineTrade(room: any, roomId: string, tradeId: string) {
      const tradeIndex = room.pendingTrades.findIndex((t: any) => t.id === tradeId);
      if (tradeIndex !== -1) {
        const trade = room.pendingTrades[tradeIndex];
        trade.status = "DECLINED";
        room.pendingTrades.splice(tradeIndex, 1);
        const logEntry = room.tradeLog.find((t: any) => t.id === tradeId);
        if (logEntry) logEntry.status = "DECLINED";
        room.history.push({ type: "decline_trade", playerName: trade.targetName, senderName: trade.senderName, playerId: trade.targetId });
        io.to(roomId).emit("room_update", room);
      }
    }

    function handleBotInitiateTrade(room: any, roomId: string, bot: any) {
      // 1. Try to complete sets
      const ownedProperties = bot.properties.filter((id: number) => BOARD_DATA[id].type === "PROPERTY");
      const groups = [...new Set(ownedProperties.map((id: number) => BOARD_DATA[id].group))];

      for (const group of groups) {
        const groupTiles = BOARD_DATA.filter(t => t.group === group);
        const missingTiles = groupTiles.filter(t => !bot.properties.includes(t.id));

        if (missingTiles.length === 1) {
          const targetTile = missingTiles[0];
          const owner = room.players.find((p: any) => p.properties.includes(targetTile.id));

          if (owner && !owner.isBankrupt) {
            // Check if we have a property they might want (part of their set)
            const myUselessProps = bot.properties.filter((id: number) => {
              const tile = BOARD_DATA[id];
              if (tile.type !== "PROPERTY") return false;
              const sameGroup = BOARD_DATA.filter(t => t.group === tile.group);
              return sameGroup.filter(t => bot.properties.includes(t.id)).length === 1; // Only have 1 in this group
            });

            const theirUselessPropForMe = myUselessProps.find(id => {
              const tile = BOARD_DATA[id];
              const ownerGroup = BOARD_DATA.filter(t => t.group === tile.group);
              return ownerGroup.filter(t => owner.properties.includes(t.id)).length > 0; // They have at least 1 in this group
            });

            if (theirUselessPropForMe) {
              // Property for Property trade
              const tradeOffer = {
                id: Math.random().toString(36).substr(2, 9),
                senderId: bot.id,
                senderName: bot.name,
                targetId: owner.id,
                targetName: owner.name,
                senderProperties: [theirUselessPropForMe],
                targetProperties: [targetTile.id],
                senderMoney: 0,
                targetMoney: 0,
                status: "PENDING",
                timestamp: Date.now()
              };
              room.pendingTrades.push(tradeOffer);
              room.tradeLog.push(tradeOffer);
              room.history.push({ type: "initiate_trade_prop", playerName: bot.name, myProp: BOARD_DATA[theirUselessPropForMe].name, targetProp: targetTile.name, targetName: owner.name, playerId: bot.id });
              io.to(roomId).emit("room_update", room);

              if (owner.isBot) {
                handleBotTradeResponse(room, roomId, owner, tradeOffer);
              }
              return; // Only one trade per turn
            } else {
              // Money for Property trade
              const offerPrice = (targetTile.price || 100) * 1.8;
              if (bot.money >= offerPrice + 300) {
                const tradeOffer = {
                  id: Math.random().toString(36).substr(2, 9),
                  senderId: bot.id,
                  senderName: bot.name,
                  targetId: owner.id,
                  targetName: owner.name,
                  senderProperties: [],
                  targetProperties: [targetTile.id],
                  senderMoney: Math.floor(offerPrice),
                  targetMoney: 0,
                  status: "PENDING",
                  timestamp: Date.now()
                };
                room.pendingTrades.push(tradeOffer);
                room.tradeLog.push(tradeOffer);
                room.history.push({ type: "initiate_trade_money", playerName: bot.name, amount: Math.floor(offerPrice), targetProp: targetTile.name, targetName: owner.name, playerId: bot.id });
                io.to(roomId).emit("room_update", room);

                if (owner.isBot) {
                  handleBotTradeResponse(room, roomId, owner, tradeOffer);
                }
                return;
              }
            }
          }
        }
      }
    }

    function handleTileAction(room: any, player: any, tile: any, diceTotal: number) {
      if (tile.type === "TAX") {
        // Calculate tax: tile 4 is 15% of total wealth, tile 38 is flat $100
        let taxAmount = 0;
        if (tile.id === 4) { // 15% tax
          const totalWealth = player.money + player.properties.reduce((sum: number, propId: number) => {
            const prop = BOARD_DATA[propId];
            let value = prop.price || 0;
            const level = room.propertyLevels[propId] || 0;
            if (level > 0 && prop.buildCost) value += level * prop.buildCost;
            return sum + value;
          }, 0);
          taxAmount = Math.floor(totalWealth * 0.15);
        } else {
          taxAmount = 100;
        }

        // Ensure player doesn't pay more than they have (bankruptcy handled later if needed, though usually tax bankrupts you too, for simplicity here just take what they have if less, or let it go negative to trigger bankruptcy)
        player.money -= taxAmount;
        if (room.settings.vacationCash) {
          room.vacationCash = (room.vacationCash || 0) + taxAmount;
        }
        room.history.push({ type: "pay_tax", playerName: player.name, amount: taxAmount, playerId: player.id });

        if (player.money < 0) {
          player.isBankrupt = true;
          player.money = 0;
          room.history.push({ type: "bankrupt", playerName: player.name, playerId: player.id });
          player.properties.forEach((propId: number) => {
            delete room.propertyLevels[propId];
            room.mortgagedProperties = room.mortgagedProperties.filter((id: number) => id !== propId);
          });
          player.properties = [];
        }
      } else if (tile.type === "VACATION") {
        if (room.settings.vacationCash && room.vacationCash > 0) {
          const amount = room.vacationCash;
          player.money += amount;
          room.vacationCash = 0;
          room.history.push({ type: "win_vacation_cash", playerName: player.name, amount: amount, playerId: player.id });
        }
      } else if (tile.type === "GO_TO_JAIL") {
        player.position = 12; // Prison
        player.inJail = true;
        room.isDouble = false; // Prevent rolling again if they got here via double
        room.history.push({ type: "go_to_jail", playerName: player.name, playerId: player.id });
      } else if (tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY") {
        const owner = room.players.find((p: any) => p.properties.includes(tile.id) && p.id !== player.id);
        if (owner && !room.mortgagedProperties.includes(tile.id)) {
          if (player.rentImmunity) {
            room.history.push({ type: "used_rent_immunity", playerName: player.name, playerId: player.id });
            player.rentImmunity = false;
          } else {
            let rent = 0;
            if (tile.type === "PROPERTY") {
              const sameGroupTiles = BOARD_DATA.filter(t => t.group === tile.group);
              const ownerHasFullSet = sameGroupTiles.every(t => owner.properties.includes(t.id));
              const level = room.propertyLevels[tile.id] || 0;
              rent = tile.rent[level];
              if (ownerHasFullSet && level === 0 && room.settings.doubleRentFullSet) {
                rent *= 2;
              }
            } else if (tile.type === "AIRPORT") {
              const airportCount = owner.properties.filter((id: number) => BOARD_DATA[id].type === "AIRPORT").length;
              rent = tile.rent[airportCount - 1];
            } else if (tile.type === "COMPANY") {
              const companyCount = owner.properties.filter((id: number) => BOARD_DATA[id].type === "COMPANY").length;
              rent = diceTotal * (companyCount === 1 ? 20 : companyCount === 2 ? 40 : 60);
            }

            player.money -= rent;
            owner.money += rent;
            room.history.push({ type: "pay_rent", playerName: player.name, amount: rent, targetName: owner.name, playerId: player.id });

            if (player.money < 0) {
              player.isBankrupt = true;
              player.money = 0;
              room.history.push({ type: "bankrupt", playerName: player.name, playerId: player.id });
              // Return properties to bank
              player.properties.forEach((propId: number) => {
                room.propertyLevels[propId] = 0;
              });
              player.properties = [];
            }
          }
        } else if (!owner) {
          room.mustActOnProperty = tile.id;
        }
      } else if (tile.type === "SURPRISE" || tile.type === "TREASURE") {
        const deck = tile.type === "SURPRISE" ? room.chanceDeck : room.treasureDeck;
        const card = deck.shift();
        deck.push(card);

        // Emit card_drawn event
        io.to(room.id).emit("card_drawn", { card, playerId: player.id, roomId: room.id, type: tile.type });

        // Apply card effect immediately
        if (card.effect === "add_money") {
          player.money += card.amount;
          room.history.push({ type: "gain_money_card", playerName: player.name, amount: card.amount, title: card.text.split(" ").slice(0, -1).join(" "), card: card, playerId: player.id });
        } else if (card.effect === "sub_money") {
          player.money -= card.amount;
          room.vacationCash = (room.vacationCash || 0) + card.amount;
          room.history.push({ type: "pay_fine_card", playerName: player.name, amount: card.amount, title: card.text.split(" ").slice(0, -1).join(" "), card: card, playerId: player.id });
        } else if (card.effect === "pay_all") {
          const activeOthers = room.players.filter((p: any) => p.id !== player.id && !p.isBankrupt);
          const totalPay = card.amount * activeOthers.length;
          player.money -= totalPay;
          activeOthers.forEach((p: any) => p.money += card.amount);
          room.history.push({ type: "pay_all_card", playerName: player.name, amount: card.amount, playerId: player.id });
        } else if (card.effect === "collect_all") {
          const activeOthers = room.players.filter((p: any) => p.id !== player.id && !p.isBankrupt);
          activeOthers.forEach((p: any) => p.money -= card.amount);
          player.money += (card.amount * activeOthers.length);
          room.history.push({ type: "collect_all_card", playerName: player.name, amount: card.amount, card: card, playerId: player.id });
        } else if (card.effect === "property_tax") {
          const tax = player.properties.length * card.amount;
          player.money -= tax;
          room.vacationCash = (room.vacationCash || 0) + tax;
          room.history.push({ type: "pay_tax_card", playerName: player.name, amount: tax, title: card.text.split(" ").slice(0, -1).join(" "), card: card, playerId: player.id });
        } else if (card.effect === "move_back") {
          player.position = (player.position - card.amount + 48) % 48;
          const newTile = BOARD_DATA[player.position];
          if (newTile.type !== "SURPRISE" && newTile.type !== "TREASURE") {
            handleTileAction(room, player, newTile, 0);
          }
        } else if (card.effect === "go_jail") {
          player.position = 12;
          player.inJail = true;
          room.isDouble = false;
        } else if (card.effect === "go_to") {
          const targetTileStr = card.text.includes("Salvador") ? "Salvador" : "New York";
          const targetIndex = BOARD_DATA.findIndex(t => t.name.includes(targetTileStr));
          if (targetIndex !== -1) {
            if (player.position > targetIndex) player.money += 200; // pass go
            player.position = targetIndex;
            handleTileAction(room, player, BOARD_DATA[targetIndex], 0);
          }
        } else if (card.effect === "go_start") {
          player.position = 0;
          player.money += 200;
        } else if (card.effect === "move_forward") {
          const oldPos = player.position;
          player.position = (player.position + card.amount) % 48;
          if (player.position < oldPos) player.money += 200;
          const newTile = BOARD_DATA[player.position];
          if (newTile.type !== "SURPRISE" && newTile.type !== "TREASURE") {
            handleTileAction(room, player, newTile, 0);
          }
        } else if (card.effect === "nearest_airport") {
          let found = false;
          for (let i = 1; i <= 48; i++) {
            const checkPos = (player.position + i) % 48;
            if (BOARD_DATA[checkPos].type === "AIRPORT") {
              if (checkPos < player.position) player.money += 200; // pass go
              player.position = checkPos;
              handleTileAction(room, player, BOARD_DATA[checkPos], 0);
              found = true;
              break;
            }
          }
        } else if (card.effect === "jail_free") {
          player.jailCards = (player.jailCards || 0) + 1;
        } else if (card.effect === "back_to_unowned") {
          for (let i = 1; i <= 48; i++) {
            const checkPos = (player.position - i + 48) % 48;
            const t = BOARD_DATA[checkPos];
            if (t.type === "PROPERTY" || t.type === "AIRPORT" || t.type === "COMPANY") {
              const o = room.players.find((p: any) => p.properties.includes(checkPos));
              if (!o) {
                player.position = checkPos;
                handleTileAction(room, player, BOARD_DATA[checkPos], 0);
                break;
              }
            }
          }
        } else if (card.effect === "all_forward_1") {
          room.players.forEach((p: any) => {
            if (!p.isBankrupt) {
              const oldPos = p.position;
              p.position = (p.position + 1) % 48;
              if (p.position < oldPos) p.money += 200;
              const destTile = BOARD_DATA[p.position];
              if (destTile.type !== "SURPRISE" && destTile.type !== "TREASURE") {
                handleTileAction(room, p, destTile, 0);
              }
            }
          });
        } else if (card.effect === "rent_immunity") {
          player.rentImmunity = true;
        } else if (card.effect === "swap_position") {
          if (player.isBot) {
            const otherPlayers = room.players.filter((p: any) => p.id !== player.id && !p.isBankrupt);
            if (otherPlayers.length > 0) {
              const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
              const temp = player.position;
              player.position = target.position;
              target.position = temp;
              room.history.push({ type: "swap_position", playerName: player.name, targetName: target.name, playerId: player.id });
            }
          }
        }

        // Bankruptcy check after applying card
        if (player.money < 0) {
          player.isBankrupt = true;
          player.money = 0;
          room.history.push({ type: "bankrupt", playerName: player.name, playerId: player.id });
          player.properties.forEach((propId: number) => {
            room.propertyLevels[propId] = 0;
          });
          player.properties = [];
        }
      }
    }

    socket.on("send_chat", ({ roomId, message }) => {
      const room = rooms.get(roomId);
      if (room) {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player) {
          io.to(roomId).emit("new_chat", {
            sender: player.name,
            color: player.color,
            message
          });
        }
      }
    });

    socket.on("debug_give_properties", ({ roomId }) => {
      const room = rooms.get(roomId);
      if (room && room.gameState === "PLAYING") {
        const player = room.players.find((p: any) => p.id === socket.id);
        if (player) {
          BOARD_DATA.forEach(tile => {
            if ((tile.type === "PROPERTY" || tile.type === "AIRPORT" || tile.type === "COMPANY") && !player.properties.includes(tile.id)) {
              // Remove from other players if owned
              room.players.forEach((p: any) => {
                p.properties = p.properties.filter((id: number) => id !== tile.id);
              });
              player.properties.push(tile.id);
              room.propertyLevels[tile.id] = 0;
            }
          });
          room.history.push({ type: "test_mode_all_props", playerName: player.name, playerId: player.id });
          io.to(roomId).emit("room_update", room);
        }
      }
    });

    socket.on("leave_room", () => {
      rooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          const wasHost = room.players[playerIndex].isHost;
          room.players.splice(playerIndex, 1);
          socket.leave(roomId);

          const onlyBotsLeft = room.players.length > 0 && room.players.every((p: any) => p.isBot);

          if (room.players.length === 0 || wasHost || onlyBotsLeft) {
            console.log(`[Room ${roomId}] Disbanding due to leave_room. Players: ${room.players.length}, wasHost: ${wasHost}, onlyBots: ${onlyBotsLeft}`);
            rooms.delete(roomId);
            io.to(roomId).emit("room_disbanded");
          } else {
            io.to(roomId).emit("room_update", room);
          }
        }
      });
      socket.emit("left_room");
    });

    socket.on("disconnect", () => {
      rooms.forEach((room, roomId) => {
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          const wasHost = player.isHost;

          player.isDisconnected = true;
          player.disconnectTime = Date.now();
          const timerKey = `${roomId}:${player.name}`;

          const timer = setTimeout(() => {
            const currentRoom = rooms.get(roomId);
            if (currentRoom) {
              const p = currentRoom.players.find((cp: any) => cp.name === player.name);
              if (p && p.isDisconnected) {
                if (currentRoom.gameState === "PLAYING") {
                  p.isBankrupt = true;
                  currentRoom.history.push({ 
                    type: "bankrupt", 
                    playerName: p.name, 
                    playerId: p.id,
                    reason: "disconnect_timeout"
                  });

                  // Clear properties
                  p.properties.forEach((propId: number) => {
                    currentRoom.propertyLevels[propId] = 0;
                  });
                  p.properties = [];
                } else {
                  // Lobby: remove player
                  const idx = currentRoom.players.findIndex((cp: any) => cp.name === p.name);
                  if (idx !== -1) {
                    const wasH = currentRoom.players[idx].isHost;
                    currentRoom.players.splice(idx, 1);
                    if (wasH && currentRoom.players.length > 0) {
                      currentRoom.players[0].isHost = true;
                    }
                  }
                }

                // Check if room should be disbanded
                const noHumansLeft = currentRoom.players.every((p: any) => 
                  p.isBot || (p.isBankrupt && p.gameState === "PLAYING") || (p.isDisconnected && currentRoom.gameState === "LOBBY")
                );
                // Actually simpler: if no connected humans AND no humans in grace period anymore?
                // The current humans who are NOT bots and NOT bankrupt.
                const remainingRealPlayers = currentRoom.players.filter((p: any) => !p.isBot && !p.isBankrupt);
                const anyNotDisconnected = remainingRealPlayers.some((p: any) => !p.isDisconnected);

                if (remainingRealPlayers.length === 0 || (currentRoom.players.length > 0 && currentRoom.players.every((p: any) => p.isBot))) {
                  console.log(`[Room ${roomId}] Disbanding after 3m timeout. Humans left: ${remainingRealPlayers.length}`);
                  rooms.delete(roomId);
                  io.to(roomId).emit("room_disbanded");
                } else {
                  io.to(roomId).emit("room_update", currentRoom);
                }
              }
            }
            disconnectTimers.delete(timerKey);
          }, 3 * 60 * 1000); // 3 minutes

          disconnectTimers.set(timerKey, timer);

          // If was host and there are other players, transfer host temporarily?
          // For now, keep host status until timeout to avoid confusion if they refresh quickly.
          io.to(roomId).emit("room_update", room);
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
