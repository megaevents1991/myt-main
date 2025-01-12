"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  affiliateId: string | null;
  login: (username: string, password: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);

  const login = async (username: string, password: string) => {
    const res = await fetch("/api/affiliate/login", {
      method: "POST",
      body: JSON.stringify({ user: username, pass: password }),
    });
    const data = await res.json();
    if (data.success) {
      setIsAuthenticated(true);
      setAffiliateId(data.affiliateId);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, affiliateId, login }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};