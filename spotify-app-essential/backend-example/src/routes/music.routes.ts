/**
 * Music Routes
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth';
import SpotifyService from '../services/SpotifyService';

const router = Router();

/**
 * GET /api/music/top-tracks
 * Get user's top tracks
 */
router.get('/top-tracks', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { timeRange = 'medium_term', limit = '50' } = req.query;
    const userId = req.user!.userId;

    const validTimeRanges = ['short_term', 'medium_term', 'long_term'];
    const range = validTimeRanges.includes(timeRange as string) 
      ? (timeRange as 'short_term' | 'medium_term' | 'long_term')
      : 'medium_term';

    const tracks = await SpotifyService.getTopTracks(
      userId,
      range,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: tracks,
    });

  } catch (error) {
    console.error('❌ Error fetching top tracks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top tracks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/music/recent
 * Get user's recently played tracks
 */
router.get('/recent', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    const userId = req.user!.userId;

    const tracks = await SpotifyService.getRecentlyPlayed(
      userId,
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: tracks,
    });

  } catch (error) {
    console.error('❌ Error fetching recent tracks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent tracks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/music/search
 * Search for tracks
 */
router.get('/search', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { q, limit = '10' } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Search query required',
      });
      return;
    }

    const tracks = await SpotifyService.searchTracks(q, parseInt(limit as string));

    res.json({
      success: true,
      data: tracks,
    });

  } catch (error) {
    console.error('❌ Error searching tracks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search tracks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
