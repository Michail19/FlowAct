import { createContext } from 'react';

import type { AuthUser } from '../services/authApi';

export type LoginInput = {
    email: string;
    password: string;
};

export type RegisterInput = LoginInput & {
    displayName?: string | null;
};

export type AuthContextValue = {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isInitializing: boolean;
    login: (input: LoginInput) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
