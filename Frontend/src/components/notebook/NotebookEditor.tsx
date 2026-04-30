import { useCallback, useRef, useState } from 'react';

import { useMediaQuery } from '../../hooks/useMediaQuery';

import NotebookHeader from './NotebookHeader';
import NotebookToolbar from './NotebookToolbar';
import NotebookCanvas from './NotebookCanvas';
import NotebookSearch from './NotebookSearch';
import NotebookSuggestion from './NotebookSuggestion';
import NotebookMobileActions from './NotebookMobileActions';
import type { NotebookBlockRequest, NotebookBlockType } from './notebookTypes';

import './NotebookEditor.css';

function NotebookEditor() {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const requestIdRef = useRef(0);
    const [blockRequest, setBlockRequest] = useState<NotebookBlockRequest | null>(null);

    const handleAddBlock = useCallback((blockType: NotebookBlockType) => {
        requestIdRef.current += 1;

        setBlockRequest({
            requestId: requestIdRef.current,
            blockType,
        });
    }, []);

    const handleBlockRequestHandled = useCallback((requestId: number) => {
        setBlockRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    return (
        <main className="notebook-editor">
            <NotebookHeader isMobile={isMobile} />

            <div className="notebook-editor__body">
                {isDesktop && <NotebookToolbar onAddBlock={handleAddBlock} />}

                <section className="notebook-editor__workspace">
                    <NotebookSearch />
                    <NotebookCanvas
                        readonly={!isDesktop}
                        blockRequest={blockRequest}
                        onBlockRequestHandled={handleBlockRequestHandled}
                    />
                    <NotebookSuggestion isMobile={isMobile} />
                    {isMobile && <NotebookMobileActions />}
                </section>
            </div>
        </main>
    );
}

export default NotebookEditor;
