/**
 * Token Service - JWT generation and validation
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

export interface JWTPayload {
  userId: string;
  spotifyId: string;
  email: string;
  displayName: string;
}

class TokenService {
  private static instance: TokenService;

  private constructor() {
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set, using default (INSECURE)');
    }
  }

  public static getInstance(): TokenService {
    if (!TokenService.instance) {
      TokenService.instance = new TokenService();
    }
    return TokenService.instance;
  }

  /**
   * Generate JWT token
   */
  public generateToken(payload: JWTPayload): string {
    try {
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
        issuer: 'track-roulette-backend',
      });

      console.log(`✅ JWT generated for user: ${payload.displayName}`);
      return token;

    } catch (error) {
      console.error('❌ Error generating JWT:', error);
      throw new Error('Failed to generate token');
    }
  }

  /**
   * Verify JWT token
   */
  public verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'track-roulette-backend',
      }) as JWTPayload;

      return decoded;

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_TOKEN');
      }
      throw new Error('TOKEN_VERIFICATION_FAILED');
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  public decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      console.error('❌ Error decoding token:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  public isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;

      const now = Date.now() / 1000;
      return decoded.exp < now;

    } catch (error) {
      return true;
    }
  }
}

export default TokenService.getInstance();
