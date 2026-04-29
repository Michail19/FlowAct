import type { ButtonHTMLAttributes, ReactNode } from 'react';

import './NotebookIconButton.css';

type NotebookIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: ReactNode;
    label: string;
    active?: boolean;
    variant?: 'square' | 'circle';
};

function NotebookIconButton({
    icon,
    label,
    active = false,
    variant = 'square',
    className = '',
    type = 'button',
    ...props
}: NotebookIconButtonProps) {
    const buttonClassName = [
        'notebook-icon-button',
        `notebook-icon-button--${variant}`,
        active ? 'notebook-icon-button--active' : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <button className={buttonClassName} type={type} aria-label={label} title={label} {...props}>
            <span className="notebook-icon-button__icon" aria-hidden="true">
                {icon}
            </span>
        </button>
    );
}

export default NotebookIconButton;
