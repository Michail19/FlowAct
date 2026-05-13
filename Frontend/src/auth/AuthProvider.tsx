import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';

import {
    clearAuthSession,
    getAuthSession,
    saveAuthSession,
} from './authSession';
import { authApi, type AuthUser } from '../services/authApi';

export type LoginInput = {
    email: string;
    password: string;
};

export type RegisterInput = LoginInput & {
    displayName?: string | null;
};

type AuthContextValue = {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isInitializing: boolean;
    login: (input: LoginInput) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const initialSession = getAuthSession();

    const [user, setUser] = useState<AuthUser | null>(initialSession.user);
    const [isInitializing, setIsInitializing] = useState(initialSession.isAuthenticated);

    const refreshUser = useCallback(async () => {
        const currentUser = await authApi.getCurrentUser();
        const session = getAuthSession();

        saveAuthSession({
            accessToken: session.accessToken ?? '',
            refreshToken: session.refreshToken,
            user: currentUser,
        });

        setUser(currentUser);
    }, []);

    useEffect(() => {
        let isCancelled = false;
        const session = getAuthSession();

        if (!session.isAuthenticated) {
            setIsInitializing(false);
            return;
        }

        authApi.getCurrentUser()
            .then((currentUser) => {
                if (isCancelled) {
                    return;
                }

                const latestSession = getAuthSession();
                saveAuthSession({
                    accessToken: latestSession.accessToken ?? '',
                    refreshToken: latestSession.refreshToken,
                    user: currentUser,
                });
                setUser(currentUser);
            })
            .catch(() => {
                if (isCancelled) {
                    return;
                }

                clearAuthSession();
                setUser(null);
            })
            .finally(() => {
                if (!isCancelled) {
                    setIsInitializing(false);
                }
            });

        return () => {
            isCancelled = true;
        };
    }, []);

    const login = useCallback(async (input: LoginInput) => {
        const authResponse = await authApi.login(input);
        saveAuthSession(authResponse);
        setUser(authResponse.user);
    }, []);

    const register = useCallback(async (input: RegisterInput) => {
        const authResponse = await authApi.register(input);
        saveAuthSession(authResponse);
        setUser(authResponse.user);
    }, []);

    const logout = useCallback(async () => {
        const session = getAuthSession();

        try {
            if (session.refreshToken) {
                await authApi.logout(session.refreshToken);
            }
        } finally {
            clearAuthSession();
            setUser(null);
        }
    }, []);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        isAuthenticated: Boolean(user && getAuthSession().accessToken),
        isInitializing,
        login,
        register,
        logout,
        refreshUser,
    }), [isInitializing, login, logout, refreshUser, register, user]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used inside AuthProvider');
    }

    return context;
}
