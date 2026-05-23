import './UserAvatar.css';

type UserAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

type UserAvatarProps = {
    displayName?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
    size?: UserAvatarSize;
    className?: string;
};

function getEmailInitials(email?: string | null) {
    const localPart = email?.split('@')[0]?.trim() ?? '';
    const letters = Array.from(localPart.replace(/[^\p{L}\p{N}]/gu, ''));

    if (letters.length === 0) {
        return null;
    }

    return letters.slice(0, 2).join('').toUpperCase();
}

function getDisplayNameInitials(displayName?: string | null) {
    const source = displayName?.trim();

    if (!source) {
        return null;
    }

    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
}

function getUserInitials(displayName?: string | null, email?: string | null) {
    return getEmailInitials(email) ?? getDisplayNameInitials(displayName) ?? 'U';
}

export function UserAvatar({
    displayName,
    email,
    avatarUrl,
    size = 'md',
    className = '',
}: UserAvatarProps) {
    const initials = getUserInitials(displayName, email);
    const normalizedAvatarUrl = avatarUrl?.trim();
    const classNames = [
        'user-avatar',
        `user-avatar--${size}`,
        normalizedAvatarUrl ? 'user-avatar--image' : 'user-avatar--initials',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    if (normalizedAvatarUrl) {
        return (
            <span className={classNames} aria-label={displayName || email || 'Пользователь'}>
                <img src={normalizedAvatarUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
            </span>
        );
    }

    return (
        <span className={classNames} aria-label={displayName || email || 'Пользователь'}>
            {initials}
        </span>
    );
}
