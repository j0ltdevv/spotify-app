/**
 * Utilitaires pour la gestion des utilisateurs et des profils
 */

export const getBestImage = (images: any[]): string | null => {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return null;
  }
  // Spotify renvoie souvent les images de la plus grande à la plus petite.
  // On prend la première (la plus grande) pour une bonne qualité, 
  // ou une moyenne si on veut économiser de la bande passante (index 1).
  // Pour l'instant, on privilégie la qualité.
  return images[0]?.url || null;
};

export const getInitials = (name: string): string => {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
};

export const getRandomEmoji = (): string => {
  const emojis = ['🎵', '🎧', '🎸', '🎹', '🎷', '🎺', '🎤', '🥁', '🎼', '🎶'];
  return emojis[Math.floor(Math.random() * emojis.length)];
};

export const getRandomColor = (): string => {
  const colors = [
    '#FF6B6B', // Rouge doux
    '#4ECDC4', // Turquoise
    '#FFD93D', // Jaune
    '#1DB954', // Vert Spotify
    '#A238FF', // Violet
    '#FF8E8E', // Rose
    '#6BCB77', // Vert clair
    '#4D96FF', // Bleu
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};
