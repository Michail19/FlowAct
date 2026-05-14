import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/useAuth';
import {
    adminApi,
    type AdminStats,
    type AdminUser,
    type AdminUserRole,
    type AdminUserStatus,
} from '../services/adminApi';
import { ApiError } from '../services/apiClient';

import './AdminPage.css';

type AdminFilter = 'ALL' | 'REGULAR' | 'DEMO' | 'ACTIVE' | 'BLOCKED' | 'DELETED' | 'ADMIN';

const filterOptions: Array<{ value: AdminFilter; label: string }> = [
    { value: 'ALL', label: 'Все' },
    { value: 'REGULAR', label: 'Regular' },
    { value: 'DEMO', label: 'Demo' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'BLOCKED', label: 'Blocked' },
    { value: 'DELETED', label: 'Deleted' },
    { value: 'ADMIN', label: 'Admins' },
];

function formatDateTime(date?: string | null) {
    if (!date) {
        return '—';
    }

    return new Date(date).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getErrorMessage(error: unknown) {
    if (error instanceof ApiError) {
        if (error.status === 403) {
            return 'Недостаточно прав для выполнения действия.';
        }

        return 'Не удалось выполнить admin-запрос. Проверьте данные и попробуйте ещё раз.';
    }

    return 'Не удалось подключиться к серверу.';
}

function matchesFilter(user: AdminUser, filter: AdminFilter) {
    switch (filter) {
        case 'REGULAR':
            return user.accountType === 'REGULAR';
        case 'DEMO':
            return user.accountType === 'DEMO';
        case 'ACTIVE':
        case 'BLOCKED':
        case 'DELETED':
            return user.status === filter;
        case 'ADMIN':
            return user.role === 'ADMIN';
        default:
            return true;
    }
}

function AdminPage() {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<AdminFilter>('ALL');
    const [isLoading, setIsLoading] = useState(true);
    const [isActionPending, setIsActionPending] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadAdminData = useCallback(async () => {
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const [nextStats, nextUsers] = await Promise.all([
                adminApi.getStats(),
                adminApi.getUsers(),
            ]);

            setStats(nextStats);
            setUsers(nextUsers);
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAdminData();
    }, [loadAdminData]);

    const filteredUsers = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return users.filter((adminUser) => {
            if (!matchesFilter(adminUser, filter)) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return [
                adminUser.email,
                adminUser.displayName,
                adminUser.role,
                adminUser.status,
                adminUser.accountType,
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(normalizedSearch));
        });
    }, [filter, search, users]);

    const updateUserInList = (updatedUser: AdminUser) => {
        setUsers((currentUsers) => currentUsers.map((item) => (
            item.id === updatedUser.id ? updatedUser : item
        )));
    };

    const runAction = async (action: () => Promise<void>, successMessage: string) => {
        setIsActionPending(true);
        setMessage(null);
        setErrorMessage(null);

        try {
            await action();
            setMessage(successMessage);
            const nextStats = await adminApi.getStats();
            setStats(nextStats);
        } catch (error) {
            setErrorMessage(getErrorMessage(error));
        } finally {
            setIsActionPending(false);
        }
    };

    const handleRoleChange = (adminUser: AdminUser, role: AdminUserRole) => {
        void runAction(async () => {
            const updatedUser = await adminApi.updateUserRole(adminUser.id, role);
            updateUserInList(updatedUser);
        }, 'Роль пользователя обновлена.');
    };

    const handleStatusChange = (adminUser: AdminUser, status: AdminUserStatus) => {
        void runAction(async () => {
            const updatedUser = await adminApi.updateUserStatus(adminUser.id, status);
            updateUserInList(updatedUser);
        }, 'Статус пользователя обновлён.');
    };

    const handleRevokeSessions = (adminUser: AdminUser) => {
        void runAction(async () => {
            const response = await adminApi.revokeUserSessions(adminUser.id);
            setMessage(`Отозвано refresh tokens: ${response.affectedCount}.`);
        }, 'Сессии пользователя отозваны.');
    };

    const handleCleanupExpiredDemoUsers = () => {
        void runAction(async () => {
            const response = await adminApi.cleanupExpiredDemoUsers();
            setMessage(`Истёкших demo-пользователей обработано: ${response.affectedCount}.`);
            const nextUsers = await adminApi.getUsers();
            setUsers(nextUsers);
        }, 'Истёкшие demo-пользователи очищены.');
    };

    const handleLogout = async () => {
        await logout();
        navigate('/landing');
    };

    const statCards = [
        ['Всего пользователей', stats?.totalUsers ?? 0],
        ['Regular', stats?.regularUsers ?? 0],
        ['Demo', stats?.demoUsers ?? 0],
        ['Active', stats?.activeUsers ?? 0],
        ['Blocked', stats?.blockedUsers ?? 0],
        ['Admins', stats?.adminUsers ?? 0],
        ['Active sessions', stats?.activeRefreshTokens ?? 0],
    ];

    return (
        <main className="admin-page">
            <section className="admin-page__shell">
                <header className="admin-page__topbar">
                    <Link className="admin-page__brand" to="/home">
                        FlowAct Admin
                    </Link>

                    <div className="admin-page__topbar-actions">
                        <Link className="admin-page__nav-link" to="/home">
                            Home
                        </Link>
                        <button className="admin-page__logout-button" type="button" onClick={handleLogout}>
                            Выйти
                        </button>
                    </div>
                </header>

                <section className="admin-page__hero">
                    <div>
                        <span>Admin panel</span>
                        <h1>Управление пользователями</h1>
                        <p>
                            Текущий администратор: {user?.email ?? '—'}
                        </p>
                    </div>

                    <button
                        className="admin-page__cleanup-button"
                        type="button"
                        onClick={handleCleanupExpiredDemoUsers}
                        disabled={isActionPending}
                    >
                        Очистить expired demo
                    </button>
                </section>

                <section className="admin-page__stats" aria-label="Admin stats">
                    {statCards.map(([label, value]) => (
                        <article className="admin-page__stat-card" key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                        </article>
                    ))}
                </section>

                <section className="admin-page__panel">
                    <div className="admin-page__panel-header">
                        <div>
                            <h2>Пользователи</h2>
                            <p>Найдено: {filteredUsers.length}</p>
                        </div>

                        <div className="admin-page__filters">
                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Поиск по email, имени, роли"
                            />

                            <select
                                value={filter}
                                onChange={(event) => setFilter(event.target.value as AdminFilter)}
                            >
                                {filterOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {message && <p className="admin-page__message">{message}</p>}
                    {errorMessage && <p className="admin-page__error">{errorMessage}</p>}

                    {isLoading ? (
                        <div className="admin-page__empty">Загрузка пользователей...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="admin-page__empty">Пользователи не найдены.</div>
                    ) : (
                        <div className="admin-page__table-wrap">
                            <table className="admin-page__table">
                                <thead>
                                    <tr>
                                        <th>Email</th>
                                        <th>Имя</th>
                                        <th>Роль</th>
                                        <th>Статус</th>
                                        <th>Тип</th>
                                        <th>Создан</th>
                                        <th>Последний вход</th>
                                        <th>Действия</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredUsers.map((adminUser) => {
                                        const isCurrentUser = adminUser.id === user?.id;

                                        return (
                                            <tr key={adminUser.id}>
                                                <td>
                                                    <strong>{adminUser.email}</strong>
                                                </td>
                                                <td>{adminUser.displayName || '—'}</td>
                                                <td>
                                                    <select
                                                        value={adminUser.role}
                                                        onChange={(event) => handleRoleChange(
                                                            adminUser,
                                                            event.target.value as AdminUserRole,
                                                        )}
                                                        disabled={isActionPending || isCurrentUser}
                                                    >
                                                        <option value="USER">USER</option>
                                                        <option value="ADMIN">ADMIN</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <select
                                                        value={adminUser.status}
                                                        onChange={(event) => handleStatusChange(
                                                            adminUser,
                                                            event.target.value as AdminUserStatus,
                                                        )}
                                                        disabled={isActionPending || isCurrentUser}
                                                    >
                                                        <option value="ACTIVE">ACTIVE</option>
                                                        <option value="BLOCKED">BLOCKED</option>
                                                        <option value="DELETED">DELETED</option>
                                                    </select>
                                                </td>
                                                <td>
                                                    <span className={`admin-page__badge admin-page__badge--${adminUser.accountType.toLowerCase()}`}>
                                                        {adminUser.accountType}
                                                    </span>
                                                </td>
                                                <td>{formatDateTime(adminUser.createdAt)}</td>
                                                <td>{formatDateTime(adminUser.lastLoginAt)}</td>
                                                <td>
                                                    <button
                                                        className="admin-page__table-button"
                                                        type="button"
                                                        onClick={() => handleRevokeSessions(adminUser)}
                                                        disabled={isActionPending || isCurrentUser}
                                                    >
                                                        Revoke sessions
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </section>
        </main>
    );
}

export default AdminPage;
