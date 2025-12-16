/**
 * User Model - MongoDB Schema
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  spotifyId: string;
  email: string;
  displayName: string;
  profileImage?: string;
  country?: string;
  product?: string; // free, premium
  refreshToken: string; // Encrypted Spotify refresh token
  lastLogin: Date;
  gamesPlayed: number;
  totalScore: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    spotifyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    product: {
      type: String,
      enum: ['free', 'premium', 'open'],
      default: 'free',
    },
    refreshToken: {
      type: String,
      required: true,
      select: false, // Ne pas retourner par défaut
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    gamesPlayed: {
      type: Number,
      default: 0,
    },
    totalScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // Ajoute createdAt et updatedAt
  }
);

// Indexes pour performance
UserSchema.index({ email: 1 });
UserSchema.index({ spotifyId: 1 });
UserSchema.index({ gamesPlayed: -1 }); // Leaderboard
UserSchema.index({ totalScore: -1 }); // Leaderboard

// Méthode pour update les stats
UserSchema.methods.updateGameStats = function (score: number) {
  this.gamesPlayed += 1;
  this.totalScore += score;
  this.lastLogin = new Date();
  return this.save();
};

export default mongoose.model<IUser>('User', UserSchema);
