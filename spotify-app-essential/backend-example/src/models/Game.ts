/**
 * Game Model - MongoDB Schema
 */

import mongoose, { Schema, Document } from 'mongoose';

interface IPlayer {
  userId: string;
  displayName: string;
  avatar: {
    color: string;
    emoji: string;
  };
  score: number;
}

interface ITrack {
  trackId: string;
  title: string;
  artist: string;
  correctPlayerId: string;
  source: 'Spotify' | 'iTunes' | 'Deezer';
}

export interface IGame extends Document {
  roomId: string;
  hostUserId: string;
  players: IPlayer[];
  tracks: ITrack[];
  status: 'lobby' | 'playing' | 'finished';
  currentRound: number;
  totalRounds: number;
  category: string;
  startedAt?: Date;
  finishedAt?: Date;
  winner?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema: Schema = new Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    hostUserId: {
      type: String,
      required: true,
    },
    players: [
      {
        userId: { type: String, required: true },
        displayName: { type: String, required: true },
        avatar: {
          color: { type: String, required: true },
          emoji: { type: String, required: true },
        },
        score: { type: Number, default: 0 },
      },
    ],
    tracks: [
      {
        trackId: { type: String, required: true },
        title: { type: String, required: true },
        artist: { type: String, required: true },
        correctPlayerId: { type: String, required: true },
        source: {
          type: String,
          enum: ['Spotify', 'iTunes', 'Deezer'],
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ['lobby', 'playing', 'finished'],
      default: 'lobby',
    },
    currentRound: {
      type: Number,
      default: 0,
    },
    totalRounds: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    winner: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
GameSchema.index({ roomId: 1 });
GameSchema.index({ hostUserId: 1 });
GameSchema.index({ status: 1 });
GameSchema.index({ createdAt: -1 });

export default mongoose.model<IGame>('Game', GameSchema);
