import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';

// 1. Définition des types pour le contexte
interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
}

// 2. Création du contexte
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Fournisseur du contexte (le wrapper)
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Utiliser useCallback pour la fonction, évitant les recréations inutiles
  const setToken = useCallback((token: string | null) => {
    setAccessToken(token);
    // Futur: Ici tu pourrais sauvegarder le token dans AsyncStorage
  }, []);

  const value = {
    accessToken,
    setAccessToken: setToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 4. Hook personnalisé pour une utilisation facile
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};
