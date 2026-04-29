import { useMediaQuery } from '../../hooks/useMediaQuery';

import NotebookHeader from './NotebookHeader';
import NotebookToolbar from './NotebookToolbar';
import NotebookCanvas from './NotebookCanvas';
import NotebookSearch from './NotebookSearch';
import NotebookSuggestion from './NotebookSuggestion';
import NotebookMobileActions from './NotebookMobileActions';

import './notebook.css';

function NotebookEditor() {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    return (
        <main className="notebook-editor">
            <NotebookHeader isMobile={isMobile} />

            <div className="notebook-editor__body">
                {isDesktop && <NotebookToolbar />}

                <section className="notebook-editor__workspace">
                    <NotebookSearch />
                    <NotebookCanvas readonly={!isDesktop} />
                    <NotebookSuggestion isMobile={isMobile} />
                    {isMobile && <NotebookMobileActions />}
                </section>
            </div>
        </main>
    );
}

export default NotebookEditor;
