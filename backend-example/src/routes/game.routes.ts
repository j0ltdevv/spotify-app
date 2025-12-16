/**
 * Game Routes (REST API for games)
 * Note: Real-time game logic is handled via WebSocket
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import Game from '../models/Game';
import User from '../models/User';

const router = Router();

/**
 * GET /api/game/history
 * Get user's game history
 */
router.get('/history', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { limit = '10', page = '1' } = req.query;

    const limitNum = parseInt(limit as string);
    const pageNum = parseInt(page as string);
    const skip = (pageNum - 1) * limitNum;

    const games = await Game.find({
      'players.userId': userId,
      status: 'finished',
    })
      .sort({ finishedAt: -1 })
      .limit(limitNum)
      .skip(skip);

    const total = await Game.countDocuments({
      'players.userId': userId,
      status: 'finished',
    });

    res.json({
      success: true,
      data: {
        games,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });

  } catch (error) {
    console.error('❌ Error fetching game history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game history',
    });
  }
});

/**
 * GET /api/game/:roomId
 * Get game details by room ID
 */
router.get('/:roomId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    const game = await Game.findOne({ roomId });

    if (!game) {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    res.json({
      success: true,
      data: game,
    });

  } catch (error) {
    console.error('❌ Error fetching game:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch game',
    });
  }
});

/**
 * POST /api/game/finish
 * Mark game as finished and update user stats
 */
router.post('/finish', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { roomId, scores, winner } = req.body;

    if (!roomId || !scores) {
      res.status(400).json({
        success: false,
        message: 'roomId and scores required',
      });
      return;
    }

    // Find game
    const game = await Game.findOne({ roomId });

    if (!game) {
      res.status(404).json({
        success: false,
        message: 'Game not found',
      });
      return;
    }

    // Update game status
    game.status = 'finished';
    game.finishedAt = new Date();
    game.winner = winner;

    // Update player scores in game
    for (const [userId, score] of Object.entries(scores)) {
      const player = game.players.find((p) => p.userId === userId);
      if (player) {
        player.score = score as number;
      }
    }

    await game.save();

    // Update user stats
    for (const [userId, score] of Object.entries(scores)) {
      const user = await User.findById(userId);
      if (user) {
        await user.updateGameStats(score as number);
      }
    }

    console.log(`✅ Game finished: ${roomId}, winner: ${winner}`);

    res.json({
      success: true,
      data: game,
    });

  } catch (error) {
    console.error('❌ Error finishing game:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to finish game',
    });
  }
});

export default router;
