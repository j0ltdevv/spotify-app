/**
 * Authentication Routes
 */

import { Router, Request, Response } from 'express';
import SpotifyService from '../services/SpotifyService';
import TokenService from '../services/TokenService';
import User from '../models/User';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * GET /api/auth/spotify
 * Initiate Spotify OAuth flow
 */
router.get('/spotify', (req: Request, res: Response) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  const scopes = [
    'user-read-email',
    'user-top-read',
    'user-read-recently-played',
    'user-library-read',
    'user-library-modify',
  ].join(' ');

  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: 'code',
    client_id: clientId!,
    scope: scopes,
    redirect_uri: redirectUri!,
    show_dialog: 'true',
  })}`;

  res.redirect(authUrl);
});

/**
 * POST /api/auth/spotify/callback
 * Handle Spotify OAuth callback
 */
router.post('/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        message: 'Authorization code required',
      });
      return;
    }

    // Exchange code for tokens
    const tokens = await SpotifyService.exchangeCodeForTokens(code);

    // Get user profile from Spotify
    const spotifyProfile = await SpotifyService.getUserProfile(tokens.access_token);

    // Find or create user in database
    let user = await User.findOne({ spotifyId: spotifyProfile.id });

    if (user) {
      // Update existing user
      user.email = spotifyProfile.email;
      user.displayName = spotifyProfile.display_name;
      user.profileImage = spotifyProfile.images?.[0]?.url;
      user.country = spotifyProfile.country;
      user.product = spotifyProfile.product;
      user.refreshToken = tokens.refresh_token!;
      user.lastLogin = new Date();
      await user.save();

      console.log('✅ Existing user logged in:', user.displayName);
    } else {
      // Create new user
      user = await User.create({
        spotifyId: spotifyProfile.id,
        email: spotifyProfile.email,
        displayName: spotifyProfile.display_name,
        profileImage: spotifyProfile.images?.[0]?.url,
        country: spotifyProfile.country,
        product: spotifyProfile.product,
        refreshToken: tokens.refresh_token!,
        lastLogin: new Date(),
      });

      console.log('✅ New user created:', user.displayName);
    }

    // Generate JWT
    const jwt = TokenService.generateToken({
      userId: user._id.toString(),
      spotifyId: user.spotifyId,
      email: user.email,
      displayName: user.displayName,
    });

    res.json({
      success: true,
      data: {
        jwt,
        user: {
          id: user._id,
          spotifyId: user.spotifyId,
          email: user.email,
          displayName: user.displayName,
          profileImage: user.profileImage,
          country: user.country,
          product: user.product,
        },
      },
    });

  } catch (error) {
    console.error('❌ Auth callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user!.userId);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Generate new JWT
    const jwt = TokenService.generateToken({
      userId: user._id.toString(),
      spotifyId: user.spotifyId,
      email: user.email,
      displayName: user.displayName,
    });

    res.json({
      success: true,
      data: { jwt },
    });

  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh token',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticateJWT, async (req: Request, res: Response) => {
  try {
    // Optionally: Invalidate token in Redis blacklist
    // For now, just confirm logout
    console.log(`✅ User logged out: ${req.user!.displayName}`);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });

  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Logout failed',
    });
  }
});

/**
 * GET /api/auth/validate
 * Validate JWT token
 */
router.get('/validate', authenticateJWT, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      valid: true,
      user: req.user,
    },
  });
});

export default router;
