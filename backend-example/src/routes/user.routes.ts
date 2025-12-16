/**
 * User Routes
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import User from '../models/User';

const router = Router();

/**
 * GET /api/user/profile
 * Get current user profile
 */
router.get('/profile', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        spotifyId: user.spotifyId,
        email: user.email,
        displayName: user.displayName,
        profileImage: user.profileImage,
        country: user.country,
        product: user.product,
        gamesPlayed: user.gamesPlayed,
        totalScore: user.totalScore,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
});

/**
 * GET /api/user/stats
 * Get user statistics
 */
router.get('/stats', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    const averageScore = user.gamesPlayed > 0 
      ? Math.round(user.totalScore / user.gamesPlayed)
      : 0;

    res.json({
      success: true,
      data: {
        gamesPlayed: user.gamesPlayed,
        totalScore: user.totalScore,
        averageScore,
        memberSince: user.createdAt,
        lastPlayed: user.lastLogin,
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

export default router;
