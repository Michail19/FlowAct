import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from './useAuth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
    const location = useLocation();
    const { isAuthenticated, isInitializing } = useAuth();

    if (isInitializing) {
        return (
            <main className="auth-loading-page">
                <div className="auth-loading-page__card">
                    <span>FlowAct</span>
                    <p>Проверяем сессию...</p>
                </div>
            </main>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/landing" replace state={{ from: location }} />;
    }

    return children;
}
