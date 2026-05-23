import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import NotebookPage from './pages/NotebookPage';
import AccountPage from './pages/AccountPage';
import AdminPage from './pages/AdminPage';
import HelpPage from './pages/HelpPage';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import {
    startNotebookPendingSyncWorker,
    stopNotebookPendingSyncWorker,
} from './services/notebookPendingSyncService';

import './styles/variables.css';
import './styles/global.css';

function App() {
    useEffect(() => {
        startNotebookPendingSyncWorker();

        return () => {
            stopNotebookPendingSyncWorker();
        };
    }, []);

    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<Navigate to="/landing" replace />} />
                    <Route path="/landing" element={<LandingPage />} />
                    <Route path="/help" element={<HelpPage />} />
                    <Route
                        path="/home"
                        element={(
                            <ProtectedRoute>
                                <HomePage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route
                        path="/admin"
                        element={(
                            <ProtectedRoute requiredRole="ADMIN">
                                <AdminPage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route path="/notebook" element={<Navigate to="/home" replace />} />
                    <Route
                        path="/notebook/:notebookId"
                        element={(
                            <ProtectedRoute>
                                <NotebookPage />
                            </ProtectedRoute>
                        )}
                    />
                    <Route
                        path="/my-account"
                        element={(
                            <ProtectedRoute>
                                <AccountPage />
                            </ProtectedRoute>
                        )}
                    />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;