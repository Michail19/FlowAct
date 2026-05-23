export function isPrimaryShortcut(event: KeyboardEvent) {
    return event.ctrlKey || event.metaKey;
}

export function isShortcutKey(event: KeyboardEvent, key: string) {
    const normalizedKey = key.toLowerCase();
    const eventKey = event.key.toLowerCase();
    const eventCode = event.code.toLowerCase();

    return (
        eventKey === normalizedKey ||
        eventCode === `key${normalizedKey}` ||
        eventCode === normalizedKey
    );
}

export function isSaveShortcut(event: KeyboardEvent) {
    return isPrimaryShortcut(event) && !event.shiftKey && isShortcutKey(event, 's');
}

export function isUndoShortcut(event: KeyboardEvent) {
    return isPrimaryShortcut(event) && !event.shiftKey && isShortcutKey(event, 'z');
}

export function isRedoShortcut(event: KeyboardEvent) {
    return isPrimaryShortcut(event) && (
        (event.shiftKey && isShortcutKey(event, 'z')) ||
        (event.shiftKey && isShortcutKey(event, 'c')) ||
        (!event.shiftKey && isShortcutKey(event, 'y'))
    );
}

export function isEditableShortcutTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]') ||
        target.isContentEditable,
    );
}

export function shouldIgnoreCanvasShortcut(event: KeyboardEvent) {
    return isEditableShortcutTarget(event.target);
}

export function stopNotebookShortcutEvent(event: KeyboardEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}
