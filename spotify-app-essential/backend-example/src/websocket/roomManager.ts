/**
 * Room Manager - Track active game rooms
 */

interface Room {
  roomId: string;
  hostSocketId: string;
  hostUserId: string;
  players: Map<string, string>; // socketId -> userId
  createdAt: Date;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private playerRooms: Map<string, string> = new Map(); // socketId -> roomId

  /**
   * Generate unique room ID (6 digits)
   */
  public generateRoomId(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Create a new room
   */
  public createRoom(roomId: string, hostSocketId: string, hostUserId: string): void {
    const room: Room = {
      roomId,
      hostSocketId,
      hostUserId,
      players: new Map([[hostSocketId, hostUserId]]),
      createdAt: new Date(),
    };

    this.rooms.set(roomId, room);
    this.playerRooms.set(hostSocketId, roomId);

    console.log(`✅ Room created: ${roomId}`);
  }

  /**
   * Add player to room
   */
  public addPlayerToRoom(roomId: string, socketId: string, userId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.players.set(socketId, userId);
    this.playerRooms.set(socketId, roomId);

    return true;
  }

  /**
   * Remove player from room
   */
  public removePlayer(socketId: string): void {
    const roomId = this.playerRooms.get(socketId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    if (room) {
      room.players.delete(socketId);

      // If no players left, delete room
      if (room.players.size === 0) {
        this.rooms.delete(roomId);
        console.log(`🗑️  Room deleted: ${roomId}`);
      }
    }

    this.playerRooms.delete(socketId);
  }

  /**
   * Get room by ID
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get player's current room
   */
  public getPlayerRoom(socketId: string): string | undefined {
    return this.playerRooms.get(socketId);
  }
}
