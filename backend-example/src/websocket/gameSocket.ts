/**
 * WebSocket Game Logic
 * Real-time multiplayer game management
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import Game from '../models/Game';
import { RoomManager } from './roomManager';

const roomManager = new RoomManager();

export const initializeGameSocket = (io: SocketIOServer): void => {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    /**
     * Create a new game room
     */
    socket.on('create-room', async (data: {
      hostUserId: string;
      hostName: string;
      category: string;
      totalRounds: number;
    }) => {
      try {
        const roomId = roomManager.generateRoomId();

        // Create game in database
        const game = await Game.create({
          roomId,
          hostUserId: data.hostUserId,
          players: [{
            userId: data.hostUserId,
            displayName: data.hostName,
            avatar: { color: '#FF6B6B', emoji: '🎵' },
            score: 0,
          }],
          tracks: [],
          status: 'lobby',
          currentRound: 0,
          totalRounds: data.totalRounds,
          category: data.category,
        });

        // Add room to manager
        roomManager.createRoom(roomId, socket.id, data.hostUserId);

        // Join socket room
        socket.join(roomId);

        socket.emit('room-created', {
          success: true,
          roomId,
          game,
        });

        console.log(`✅ Room created: ${roomId}`);

      } catch (error) {
        console.error('❌ Error creating room:', error);
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    /**
     * Join an existing room
     */
    socket.on('join-room', async (data: {
      roomId: string;
      userId: string;
      displayName: string;
      avatar: { color: string; emoji: string };
    }) => {
      try {
        const { roomId, userId, displayName, avatar } = data;

        // Find game
        const game = await Game.findOne({ roomId });

        if (!game) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        if (game.status !== 'lobby') {
          socket.emit('error', { message: 'Game already started' });
          return;
        }

        // Check if user already in game
        const existingPlayer = game.players.find((p) => p.userId === userId);
        if (existingPlayer) {
          socket.emit('error', { message: 'Already in this game' });
          return;
        }

        // Add player to game
        game.players.push({
          userId,
          displayName,
          avatar,
          score: 0,
        });

        await game.save();

        // Add to room manager
        roomManager.addPlayerToRoom(roomId, socket.id, userId);

        // Join socket room
        socket.join(roomId);

        // Notify all players
        io.to(roomId).emit('player-joined', {
          player: { userId, displayName, avatar },
          players: game.players,
        });

        console.log(`✅ Player joined room ${roomId}: ${displayName}`);

      } catch (error) {
        console.error('❌ Error joining room:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    /**
     * Start the game
     */
    socket.on('start-game', async (data: { roomId: string; tracks: any[] }) => {
      try {
        const { roomId, tracks } = data;

        const game = await Game.findOne({ roomId });

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        // Update game
        game.status = 'playing';
        game.startedAt = new Date();
        game.tracks = tracks;
        game.currentRound = 1;

        await game.save();

        // Notify all players
        io.to(roomId).emit('game-started', {
          tracks: tracks.length,
          currentRound: 1,
          totalRounds: game.totalRounds,
        });

        console.log(`✅ Game started: ${roomId}`);

      } catch (error) {
        console.error('❌ Error starting game:', error);
        socket.emit('error', { message: 'Failed to start game' });
      }
    });

    /**
     * Submit answer
     */
    socket.on('submit-answer', async (data: {
      roomId: string;
      userId: string;
      answerId: string;
      isCorrect: boolean;
    }) => {
      try {
        const { roomId, userId, answerId, isCorrect } = data;

        // Broadcast to room
        io.to(roomId).emit('answer-submitted', {
          userId,
          answerId,
          isCorrect,
        });

        console.log(`📝 Answer submitted in ${roomId} by ${userId}: ${isCorrect ? 'Correct' : 'Wrong'}`);

      } catch (error) {
        console.error('❌ Error submitting answer:', error);
      }
    });

    /**
     * Next round (Standard)
     */
    socket.on('next-round', async (data: { roomId: string }) => {
      try {
        const { roomId } = data;

        const game = await Game.findOne({ roomId });

        if (!game) {
          socket.emit('error', { message: 'Game not found' });
          return;
        }

        game.currentRound += 1;
        await game.save();

        io.to(roomId).emit('round-changed', {
          currentRound: game.currentRound,
          totalRounds: game.totalRounds,
        });

        console.log(`➡️  Room ${roomId} moved to round ${game.currentRound}`);

      } catch (error) {
        console.error('❌ Error moving to next round:', error);
      }
    });

    /**
     * [MIGRATION POC] Next Round (Compatible Mobile App)
     * Ecoute l'événement 'nextRound' envoyé par le GameContext actuel
     */
    socket.on('nextRound', (data: any) => {
        console.log(`🔥 [SERVER] MIGRATION SUCCESS! Received 'nextRound' event from mobile!`, data);
        
        // Pour l'instant, on renvoie juste un accusé de réception pour prouver que ça marche
        socket.emit('migration-success', { message: 'Server received your command!' });
    });

    /**
     * Disconnect
     */
    socket.on('disconnect', () => {
      const room = roomManager.getPlayerRoom(socket.id);
      
      if (room) {
        roomManager.removePlayer(socket.id);
        console.log(`👋 Player disconnected from room: ${room}`);
      }

      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  console.log('✅ Game WebSocket handlers initialized');
};
