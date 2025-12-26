/**
 * Analytics Routes
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT, optionalAuth } from '../middleware/auth';
import User from '../models/User';
import Game from '../models/Game';

const router = Router();

/**
 * GET /api/analytics/leaderboard
 * Get global leaderboard
 */
router.get('/leaderboard', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { limit = '10', sort = 'totalScore' } = req.query;

    const sortField = sort === 'gamesPlayed' ? 'gamesPlayed' : 'totalScore';

    const leaders = await User.find()
      .sort({ [sortField]: -1 })
      .limit(parseInt(limit as string))
      .select('displayName profileImage gamesPlayed totalScore');

    const leaderboard = leaders.map((user, index) => ({
      rank: index + 1,
      displayName: user.displayName,
      profileImage: user.profileImage,
      gamesPlayed: user.gamesPlayed,
      totalScore: user.totalScore,
      averageScore: user.gamesPlayed > 0 
        ? Math.round(user.totalScore / user.gamesPlayed)
        : 0,
    }));

    res.json({
      success: true,
      data: leaderboard,
    });

  } catch (error) {
    console.error('❌ Error fetching leaderboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch leaderboard',
    });
  }
});

/**
 * GET /api/analytics/stats
 * Get global statistics
 */
router.get('/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalGames = await Game.countDocuments({ status: 'finished' });
    const activeGames = await Game.countDocuments({ status: 'playing' });

    const allUsers = await User.find();
    const totalScore = allUsers.reduce((sum, user) => sum + user.totalScore, 0);
    const totalGamesPlayed = allUsers.reduce((sum, user) => sum + user.gamesPlayed, 0);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalGames,
        activeGames,
        averageScore: totalGamesPlayed > 0 
          ? Math.round(totalScore / totalGamesPlayed)
          : 0,
      },
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
    });
  }
});

/**
 * POST /api/analytics/event
 * Log custom analytics event
 */
router.post('/event', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    const userId = req.user!.userId;

    // For now, just log to console
    // In production, send to analytics service (Mixpanel, Amplitude, etc.)
    console.log(`📊 Analytics Event: ${event}`, {
      userId,
      displayName: req.user!.displayName,
      data,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: 'Event logged',
    });

  } catch (error) {
    console.error('❌ Error logging event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log event',
    });
  }
});

export default router;
