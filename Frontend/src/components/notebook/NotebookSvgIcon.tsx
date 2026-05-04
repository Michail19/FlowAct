import type { SVGProps } from 'react';

import type { NotebookSvgIconName } from './notebookSvgIconTypes';

type NotebookSvgIconProps = SVGProps<SVGSVGElement> & {
    name: NotebookSvgIconName;
    size?: number;
    title?: string;
};

function NotebookSvgIcon({
                             name,
                             size = 18,
                             title,
                             className = '',
                             ...props
                         }: NotebookSvgIconProps) {
    const classNames = ['notebook-svg-icon', className].filter(Boolean).join(' ');

    return (
        <svg
            className={classNames}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            {...props}
        >
            {title && <title>{title}</title>}

            {name === 'more' && (
                <>
                    <circle cx="5" cy="12" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="19" cy="12" r="1.5" />
                </>
            )}

            {name === 'focus' && (
                <>
                    <path d="M4 9V4h5" />
                    <path d="M20 9V4h-5" />
                    <path d="M4 15v5h5" />
                    <path d="M20 15v5h-5" />
                </>
            )}

            {name === 'save' && (
                <>
                    <path d="M5 4h12l2 2v14H5z" />
                    <path d="M8 4v6h8V4" />
                    <path d="M8 20v-6h8v6" />
                </>
            )}

            {name === 'loading' && (
                <>
                    <path d="M21 12a9 9 0 1 1-3.2-6.9" />
                    <path d="M21 4v6h-6" />
                </>
            )}

            {name === 'home' && (
                <>
                    <path d="M3 11.5 12 4l9 7.5" />
                    <path d="M5 10.5V20h5v-6h4v6h5v-9.5" />
                </>
            )}

            {name === 'plus' && (
                <>
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                </>
            )}

            {name === 'user' && (
                <>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21a8 8 0 0 1 16 0" />
                </>
            )}

            {name === 'search' && (
                <>
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-4-4" />
                </>
            )}

            {name === 'undo' && (
                <>
                    <path d="M9 7H4v5" />
                    <path d="M4 12c2.2-4.2 7.6-6.3 12-3.8 3.2 1.8 4.5 5.4 3 8.8" />
                </>
            )}

            {name === 'redo' && (
                <>
                    <path d="M15 7h5v5" />
                    <path d="M20 12c-2.2-4.2-7.6-6.3-12-3.8-3.2 1.8-4.5 5.4-3 8.8" />
                </>
            )}

            {name === 'sparkles' && (
                <>
                    <path d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 16l-1.7-5L6 9.3l4.3-1.7z" />
                    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
                    <path d="M5 14l.6 1.7L7 16.3l-1.4.6L5 18.5l-.6-1.6L3 16.3l1.4-.6z" />
                </>
            )}

            {name === 'logs' && (
                <>
                    <path d="M7 4h10a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 0 1 2-2z" />
                    <path d="M8 9h8" />
                    <path d="M8 13h6" />
                </>
            )}

            {name === 'play' && <path d="M8 5v14l11-7z" />}

            {name === 'edit' && (
                <>
                    <path d="M4 20h4l11-11-4-4L4 16z" />
                    <path d="m14 6 4 4" />
                </>
            )}

            {name === 'trash' && (
                <>
                    <path d="M4 7h16" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M6 7l1 14h10l1-14" />
                    <path d="M9 7V4h6v3" />
                </>
            )}

            {name === 'close' && (
                <>
                    <path d="M6 6l12 12" />
                    <path d="M18 6 6 18" />
                </>
            )}

            {name === 'start' && (
                <>
                    <circle cx="12" cy="12" r="8" />
                    <path d="M10 8v8l6-4z" />
                </>
            )}

            {name === 'end' && (
                <>
                    <circle cx="12" cy="12" r="8" />
                    <path d="M9 9h6v6H9z" />
                </>
            )}

            {name === 'ai' && (
                <>
                    <rect x="6" y="8" width="12" height="10" rx="3" />
                    <path d="M9 8V5" />
                    <path d="M15 8V5" />
                    <circle cx="10" cy="13" r="1" />
                    <circle cx="14" cy="13" r="1" />
                    <path d="M10 17h4" />
                </>
            )}

            {name === 'condition' && (
                <>
                    <path d="M12 3 21 12 12 21 3 12z" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                </>
            )}

            {name === 'action' && (
                <>
                    <path d="M13 3 4 14h7l-1 7 10-12h-7z" />
                </>
            )}

            {name === 'database' && (
                <>
                    <ellipse cx="12" cy="5" rx="7" ry="3" />
                    <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
                    <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
                </>
            )}

            {name === 'email' && (
                <>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 7 9 7 9-7" />
                </>
            )}

            {name === 'log' && (
                <>
                    <path d="M6 4h9l3 3v13H6z" />
                    <path d="M14 4v4h4" />
                    <path d="M9 12h6" />
                    <path d="M9 16h6" />
                </>
            )}

            {name === 'http' && (
                <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18" />
                    <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21" />
                    <path d="M12 3C9.5 5.6 8.2 8.6 8.2 12S9.5 18.4 12 21" />
                </>
            )}

            {name === 'loop' && (
                <>
                    <path d="M17 2l4 4-4 4" />
                    <path d="M3 11V9a3 3 0 0 1 3-3h15" />
                    <path d="M7 22l-4-4 4-4" />
                    <path d="M21 13v2a3 3 0 0 1-3 3H3" />
                </>
            )}

            {name === 'merge' && (
                <>
                    <path d="M4 6h5a4 4 0 0 1 4 4v8" />
                    <path d="M4 18h5a4 4 0 0 0 4-4V6" />
                    <path d="M13 12h7" />
                    <path d="m17 9 3 3-3 3" />
                </>
            )}
        </svg>
    );
}

export default NotebookSvgIcon;
