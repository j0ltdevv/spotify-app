import { io, Socket } from 'socket.io-client';

// URL du backend (À configurer dans .env idéalement, ici localhost pour dev)
// Sur un vrai device via Expo Go (ton cas), il faut l'IP de ton PC
const SERVER_URL = 'http://192.168.1.170:3000'; 

class SocketService {
  private static instance: SocketService;
  public socket: Socket | null = null;

  private constructor() {}

  public static getInstance(): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService();
    }
    return SocketService.instance;
  }

  public connect(token?: string) {
    if (this.socket?.connected) return;

    console.log(`🔌 [SocketService] Connecting to ${SERVER_URL}...`);
    
    this.socket = io(SERVER_URL, {
      auth: { token }, // Envoi du token Firebase pour auth
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('✅ [SocketService] Connected via WebSocket:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ [SocketService] Disconnected');
    });

    this.socket.on('connect_error', (err) => {
      console.log('⚠️ [SocketService] Connection Error:', err.message);
    });
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Méthode générique pour envoyer des actions au serveur
  public emit(event: string, data: any = {}) {
    if (!this.socket) {
      console.warn('⚠️ [SocketService] Cannot emit: Socket not initialized.');
      return;
    }
    console.log(`📤 [SocketService] Emitting: ${event}`, data);
    this.socket.emit(event, data);
  }

  // Méthode pour écouter (utilisée par GameContext)
  public on(event: string, callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  public off(event: string) {
    if (!this.socket) return;
    this.socket.off(event);
  }
}

export default SocketService.getInstance();
