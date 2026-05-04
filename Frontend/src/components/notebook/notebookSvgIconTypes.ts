export const NOTEBOOK_SVG_ICON_NAMES = [
    'more',
    'focus',
    'save',
    'loading',
    'home',
    'plus',
    'user',
    'search',
    'undo',
    'redo',
    'sparkles',
    'logs',
    'play',
    'edit',
    'trash',
    'close',
    'start',
    'end',
    'ai',
    'condition',
    'action',
    'database',
    'email',
    'log',
    'http',
    'loop',
    'merge',
] as const;

export type NotebookSvgIconName = (typeof NOTEBOOK_SVG_ICON_NAMES)[number];

export function isNotebookSvgIconName(value: string): value is NotebookSvgIconName {
    return NOTEBOOK_SVG_ICON_NAMES.includes(value as NotebookSvgIconName);
}
