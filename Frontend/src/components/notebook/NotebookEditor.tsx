import { useCallback, useMemo, useRef, useState } from 'react';

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
    const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);

    const suggestion = useMemo(
        () => ({
            id: 'suggest-log-after-workflow',
            blockType: 'log' as NotebookBlockType,
            confidence: 87,
            reason:
                'После выполнения рабочих процессов обычно полезно добавить логирование, чтобы сохранять историю запусков и быстрее находить ошибки.',
        }),
        [],
    );

    const visibleSuggestion = dismissedSuggestionIds.includes(suggestion.id)
        ? null
        : suggestion;

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

    const handleAcceptSuggestion = useCallback(
        (blockType: NotebookBlockType) => {
            handleAddBlock(blockType);
        },
        [handleAddBlock],
    );

    const handleDismissSuggestion = useCallback((suggestionId: string) => {
        setDismissedSuggestionIds((currentIds) =>
            currentIds.includes(suggestionId)
                ? currentIds
                : [...currentIds, suggestionId],
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

                    <NotebookSuggestion
                        isMobile={isMobile}
                        suggestion={visibleSuggestion}
                        onAccept={handleAcceptSuggestion}
                        onDismiss={handleDismissSuggestion}
                    />

                    {isMobile && <NotebookMobileActions />}
                </section>
            </div>
        </main>
    );
}

export default NotebookEditor;
