import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

import { useAuth } from './useAuth';

type ProtectedRouteProps = {
    children: ReactNode;
    requiredRole?: string;
};

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
    const location = useLocation();
    const { isAuthenticated, isInitializing, user } = useAuth();

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

    if (requiredRole && user?.role !== requiredRole) {
        return <Navigate to="/home" replace />;
    }

    return children;
}
