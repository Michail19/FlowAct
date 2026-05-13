import {
    useCallback,
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
import { subscribeAuthSessionEnded } from './authEvents';
import { authApi, type AuthUser } from '../services/authApi';
import {
    AuthContext,
    type AuthContextValue,
    type LoginInput,
    type RegisterInput,
} from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
    const initialSession = useMemo(() => getAuthSession(), []);

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
        return subscribeAuthSessionEnded(() => {
            setUser(null);
            setIsInitializing(false);
        });
    }, []);

    useEffect(() => {
        let isCancelled = false;
        const session = getAuthSession();

        if (!session.isAuthenticated) {
            queueMicrotask(() => {
                if (!isCancelled) {
                    setIsInitializing(false);
                }
            });

            return () => {
                isCancelled = true;
            };
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
