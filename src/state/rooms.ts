import { GameRoom, TwoPlayerGameState, Player } from "../types.ts";
import { Result, ok, err } from "../utils/result.ts";

// In-memory storage for game rooms
const gameRooms = new Map<string, GameRoom>();

// SSE connections for real-time updates
const sseConnections = new Map<string, Map<string, ReadableStreamDefaultController>>();

/**
 * Create a new game room
 */
export const createGameRoom = (creatorId: string, creatorName: string): Result<GameRoom, Error> => {
  const roomId = crypto.randomUUID();
  
  const room: GameRoom = {
    id: roomId,
    createdAt: Date.now(),
    createdBy: creatorId,
    player1: {
      id: creatorId,
      name: creatorName,
      connected: true
    },
    player2: null,
    gameState: null,
    status: "waiting"
  };

  gameRooms.set(roomId, room);
  
  // Initialize SSE connections for this room
  sseConnections.set(roomId, new Map());
  
  return ok(room);
};

/**
 * Join an existing game room
 */
export const joinGameRoom = (roomId: string, playerId: string, playerName: string): Result<GameRoom, Error> => {
  const room = gameRooms.get(roomId);
  
  if (!room) {
    return err(new Error("Room not found"));
  }
  
  if (room.status !== "waiting") {
    return err(new Error("Room is not accepting new players"));
  }
  
  if (room.player2) {
    return err(new Error("Room is already full"));
  }
  
  if (room.player1?.id === playerId) {
    return err(new Error("Cannot join your own room"));
  }
  
  const updatedRoom: GameRoom = {
    ...room,
    player2: {
      id: playerId,
      name: playerName,
      connected: true
    },
    status: "playing"
  };
  
  gameRooms.set(roomId, updatedRoom);
  
  // Notify all connected clients in the room
  broadcastToRoom(roomId, {
    type: "playerJoined",
    playerName: playerName
  });
  
  return ok(updatedRoom);
};

/**
 * Get a game room by ID
 */
export const getGameRoom = (roomId: string): GameRoom | undefined => {
  return gameRooms.get(roomId);
};

/**
 * Update game state in a room
 */
export const updateRoomGameState = (roomId: string, gameState: TwoPlayerGameState): Result<GameRoom, Error> => {
  const room = gameRooms.get(roomId);
  
  if (!room) {
    return err(new Error("Room not found"));
  }
  
  const updatedRoom: GameRoom = {
    ...room,
    gameState,
    status: gameState.gameStatus === "playing" ? "playing" : "finished"
  };
  
  gameRooms.set(roomId, updatedRoom);
  
  // Broadcast game update to all connected clients
  broadcastToRoom(roomId, {
    type: "gameUpdate",
    gameState
  });
  
  return ok(updatedRoom);
};

/**
 * Add SSE connection for a player in a room
 */
export const addSSEConnection = (roomId: string, playerId: string, controller: ReadableStreamDefaultController): void => {
  let roomConnections = sseConnections.get(roomId);
  if (!roomConnections) {
    roomConnections = new Map();
    sseConnections.set(roomId, roomConnections);
  }
  
  roomConnections.set(playerId, controller);
};

/**
 * Remove SSE connection for a player
 */
export const removeSSEConnection = (roomId: string, playerId: string): void => {
  const roomConnections = sseConnections.get(roomId);
  if (roomConnections) {
    roomConnections.delete(playerId);
    
    // Clean up empty room connections
    if (roomConnections.size === 0) {
      sseConnections.delete(roomId);
    }
  }
};

/**
 * Broadcast message to all connected clients in a room
 */
export const broadcastToRoom = (roomId: string, message: any): void => {
  const roomConnections = sseConnections.get(roomId);
  if (!roomConnections) return;
  
  const messageData = `data: ${JSON.stringify(message)}\n\n`;
  
  for (const [playerId, controller] of roomConnections) {
    try {
      controller.enqueue(new TextEncoder().encode(messageData));
    } catch (error) {
      console.error(`Failed to send SSE message to player ${playerId}:`, error);
      // Remove failed connection
      roomConnections.delete(playerId);
    }
  }
};

/**
 * Update player connection status
 */
export const updatePlayerConnection = (roomId: string, playerId: string, connected: boolean): Result<GameRoom, Error> => {
  const room = gameRooms.get(roomId);
  
  if (!room) {
    return err(new Error("Room not found"));
  }
  
  let updatedRoom = room;
  
  if (room.player1?.id === playerId) {
    updatedRoom = {
      ...room,
      player1: room.player1 ? { ...room.player1, connected } : null
    };
  } else if (room.player2?.id === playerId) {
    updatedRoom = {
      ...room,
      player2: room.player2 ? { ...room.player2, connected } : null
    };
  }
  
  gameRooms.set(roomId, updatedRoom);
  
  if (!connected) {
    // Notify other players that someone left
    const playerName = room.player1?.id === playerId ? room.player1.name : room.player2?.name;
    if (playerName) {
      broadcastToRoom(roomId, {
        type: "playerLeft",
        playerName
      });
    }
  }
  
  return ok(updatedRoom);
};

/**
 * Clean up old rooms (called periodically)
 */
export const cleanupOldRooms = (): void => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [roomId, room] of gameRooms) {
    if (now - room.createdAt > maxAge) {
      gameRooms.delete(roomId);
      sseConnections.delete(roomId);
    }
  }
};
