import { Navigate, useParams } from 'react-router-dom';

import NotebookEditor from '../components/notebook/NotebookEditor';

function NotebookPage() {
    const { notebookId } = useParams();

    if (!notebookId) {
        return <Navigate to="/home" replace />;
    }

    return <NotebookEditor key={notebookId} notebookId={notebookId} />;
}

export default NotebookPage;
