import { useLocation } from 'react-router-dom';

import { isDemoNotebookId } from '../../services/notebookStorage';

function getNotebookIdFromPathname(pathname: string) {
    const match = pathname.match(/^\/notebook\/([^/]+)/);

    if (!match?.[1]) {
        return null;
    }

    return decodeURIComponent(match[1]);
}

export function useDemoNotebookMode() {
    const location = useLocation();
    const notebookId = getNotebookIdFromPathname(location.pathname);

    return isDemoNotebookId(notebookId);
}
