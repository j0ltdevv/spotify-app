/**
 * Track Roulette Backend - Entry Point
 * Main server setup with Express, MongoDB, Redis, Socket.io
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Configuration
dotenv.config();

// Database & Cache
import { connectDatabase } from './config/database';
import { connectRedis } from './config/redis';

// Routes
import authRoutes from './routes/auth.routes';
import musicRoutes from './routes/music.routes';
import userRoutes from './routes/user.routes';
import gameRoutes from './routes/game.routes';
import analyticsRoutes from './routes/analytics.routes';

// Middleware
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';

// WebSocket
import { initializeGameSocket } from './websocket/gameSocket';

// Constants
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

class Server {
  private app: Application;
  private httpServer: http.Server;
  private io: SocketIOServer;

  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: this.getCorsOrigins(),
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Configure CORS origins
   */
  private getCorsOrigins(): string[] {
    const origins = [process.env.CLIENT_URL || 'http://localhost:19006'];
    if (process.env.CLIENT_URL_PROD) {
      origins.push(process.env.CLIENT_URL_PROD);
    }
    return origins;
  }

  /**
   * Initialize middlewares
   */
  private initializeMiddlewares(): void {
    // Security
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: this.getCorsOrigins(),
      credentials: true,
    }));

    // Body parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Compression
    this.app.use(compression());

    // Logging
    if (NODE_ENV === 'development') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Rate limiting
    this.app.use('/api/', rateLimiter);
  }

  /**
   * Initialize routes
   */
  private initializeRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
      });
    });

    // API Routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/music', musicRoutes);
    this.app.use('/api/user', userRoutes);
    this.app.use('/api/game', gameRoutes);
    this.app.use('/api/analytics', analyticsRoutes);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
      });
    });
  }

  /**
   * Initialize error handling
   */
  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Initialize WebSocket
   */
  private initializeWebSocket(): void {
    initializeGameSocket(this.io);
    console.log('✅ WebSocket initialized');
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      // Connect to databases
      await connectDatabase();
      await connectRedis();

      // Initialize WebSocket
      this.initializeWebSocket();

      // Start server
      this.httpServer.listen(PORT, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎵 Track Roulette Backend Server');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📡 Environment: ${NODE_ENV}`);
        console.log(`🌐 API: http://localhost:${PORT}/api`);
        console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
        console.log(`💚 Health: http://localhost:${PORT}/health`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      });

      // Graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);
      
      this.httpServer.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Close database connections
      // await disconnectDatabase();
      // await disconnectRedis();

      console.log('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

// Start server
const server = new Server();
server.start();

export default server;
