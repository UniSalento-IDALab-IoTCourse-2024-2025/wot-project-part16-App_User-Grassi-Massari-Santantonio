import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface User {
  id: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (jwt: string, role: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface JwtPayload {
  userId: string;
  role: string;
  sub: string;
  exp: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Caricamento iniziale all'avvio dell'app
  useEffect(() => {
    const loadSession = async () => {
      try {
        const token = await SecureStore.getItemAsync('token');
        const role = await SecureStore.getItemAsync('role');

        if (token && role) {
          const decoded = jwtDecode<JwtPayload>(token);
          if (decoded.exp * 1000 > Date.now()) {
            setUser({
              id: decoded.userId,
              name: decoded.sub,
              role: role
            });
          } else {
            await logout(); // Token scaduto
          }
        }
      } catch (e) {
        console.error("Errore restore session", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  const login = async (jwt: string, role: string) => {
    try {
      await SecureStore.setItemAsync('token', jwt);
      await SecureStore.setItemAsync('role', role);
      
      const decoded = jwtDecode<JwtPayload>(jwt);
      setUser({
        id: decoded.userId,
        name: decoded.sub,
        role: role
      });
    } catch (e) {
      console.error("Errore login storage", e);
    }
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('role');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}