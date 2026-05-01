import { useCallback, useMemo, useRef, useState } from 'react';

import { useMediaQuery } from '../../hooks/useMediaQuery';

import NotebookHeader from './NotebookHeader';
import NotebookToolbar from './NotebookToolbar';
import NotebookCanvas from './NotebookCanvas';
import NotebookSearch from './NotebookSearch';
import NotebookSuggestion from './NotebookSuggestion';
import NotebookMobileActions from './NotebookMobileActions';
import type {
    NotebookAutoLayoutMode,
    NotebookAutoLayoutRequest,
    NotebookBlockRequest,
    NotebookBlockType,
} from './notebookTypes';
import type { NotebookPayloadDto } from './notebookBackendTypes';
import { notebookApi } from '../../services/notebookApi';
import {
    loadNotebookLocally,
    saveNotebookLocally,
} from '../../services/notebookStorage';
import NotebookRunPanel from './NotebookRunPanel';
import type {
    NotebookExecutionLog,
    WorkflowExecutionStatus,
    WorkflowRunRequest,
} from './executionTypes';

import './NotebookEditor.css';

type NotebookEditorProps = {
    notebookId: string;
};

function NotebookEditor({ notebookId }: NotebookEditorProps) {
    const isMobile = useMediaQuery('(max-width: 767px)');
    const isDesktop = useMediaQuery('(min-width: 1024px)');

    const initialNotebookPayload = useMemo(
        () => loadNotebookLocally(notebookId),
        [notebookId],
    );

    const [notebookTitle, setNotebookTitle] = useState(
        initialNotebookPayload?.title ?? 'Название notebook',
    );

    const requestIdRef = useRef(0);
    const runRequestIdRef = useRef(0);
    const autoLayoutRequestIdRef = useRef(0);

    const [blockRequest, setBlockRequest] = useState<NotebookBlockRequest | null>(null);
    const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
    const [notebookPayload, setNotebookPayload] = useState<NotebookPayloadDto | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [runRequest, setRunRequest] = useState<WorkflowRunRequest | null>(null);
    const [executionStatus, setExecutionStatus] = useState<WorkflowExecutionStatus>('idle');
    const [executionLogs, setExecutionLogs] = useState<NotebookExecutionLog[]>([]);
    const [isRunPanelOpen, setIsRunPanelOpen] = useState(false);
    const [autoLayoutRequest, setAutoLayoutRequest] =
        useState<NotebookAutoLayoutRequest | null>(null);
    const [loadedNotebookPayload, setLoadedNotebookPayload] =
        useState<NotebookPayloadDto | null>(initialNotebookPayload);

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

    const handleSaveNotebook = useCallback(async () => {
        if (!notebookPayload) {
            return;
        }

        const payloadToSave: NotebookPayloadDto = {
            ...notebookPayload,
            id: notebookId,
            title: notebookTitle,
            updatedAt: new Date().toISOString(),
        };

        setIsSaving(true);
        setSaveError(null);

        try {
            const savedNotebook = await notebookApi.saveNotebook(payloadToSave);
            const savedLocalNotebook = saveNotebookLocally(savedNotebook);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);

            console.log('Notebook saved via API:', savedNotebook);
        } catch (error) {
            const savedLocalNotebook = saveNotebookLocally(payloadToSave);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);
            setSaveError('Backend недоступен, notebook сохранён локально.');

            console.warn('Notebook saved locally because API is unavailable:', error);
        } finally {
            setIsSaving(false);
        }
    }, [notebookId, notebookPayload, notebookTitle]);

    const handleRunWorkflow = useCallback(() => {
        runRequestIdRef.current += 1;

        setIsRunPanelOpen(true);
        setRunRequest({
            requestId: runRequestIdRef.current,
        });
    }, []);

    const handleRunRequestHandled = useCallback((requestId: number) => {
        setRunRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleOpenRunPanel = useCallback(() => {
        setIsRunPanelOpen(true);
    }, []);

    const handleCloseRunPanel = useCallback(() => {
        setIsRunPanelOpen(false);
    }, []);

    const handleClearExecutionLogs = useCallback(() => {
        setExecutionLogs([]);
        setExecutionStatus('idle');
    }, []);

    const handleAutoLayout = useCallback((mode: NotebookAutoLayoutMode = 'arrange-connect') => {
        autoLayoutRequestIdRef.current += 1;

        setIsRunPanelOpen(true);
        setAutoLayoutRequest({
            requestId: autoLayoutRequestIdRef.current,
            mode,
        });
    }, []);

    const handleAutoLayoutRequestHandled = useCallback((requestId: number) => {
        setAutoLayoutRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    return (
        <main className="notebook-editor">
            <NotebookHeader
                isMobile={isMobile}
                title={notebookTitle}
                updatedAt={notebookPayload?.updatedAt ?? loadedNotebookPayload?.updatedAt}
                onRename={setNotebookTitle}
                onSave={handleSaveNotebook}
                isSaving={isSaving}
            />

            <div className="notebook-editor__body">
                {isDesktop && (
                    <NotebookToolbar
                        onAddBlock={handleAddBlock}
                        onRunWorkflow={handleRunWorkflow}
                        onOpenRunPanel={handleOpenRunPanel}
                        onAutoLayout={() => handleAutoLayout('arrange-connect')}
                        isWorkflowRunning={executionStatus === 'running'}
                    />
                )}

                <section className="notebook-editor__workspace">
                    <NotebookSearch />

                    <NotebookCanvas
                        readonly={!isDesktop}
                        blockRequest={blockRequest}
                        onBlockRequestHandled={handleBlockRequestHandled}
                        notebookId={notebookId}
                        notebookTitle={notebookTitle}
                        initialPayload={loadedNotebookPayload}
                        onNotebookChange={setNotebookPayload}
                        runRequest={runRequest}
                        onRunRequestHandled={handleRunRequestHandled}
                        onExecutionStatusChange={setExecutionStatus}
                        onExecutionLogsChange={setExecutionLogs}
                        autoLayoutRequest={autoLayoutRequest}
                        onAutoLayoutRequestHandled={handleAutoLayoutRequestHandled}
                    />

                    <NotebookRunPanel
                        isOpen={isRunPanelOpen}
                        status={executionStatus}
                        logs={executionLogs}
                        isMobile={isMobile}
                        onClose={handleCloseRunPanel}
                        onClear={handleClearExecutionLogs}
                        onRunWorkflow={handleRunWorkflow}
                    />

                    <NotebookSuggestion
                        isMobile={isMobile}
                        suggestion={visibleSuggestion}
                        onAccept={handleAcceptSuggestion}
                        onDismiss={handleDismissSuggestion}
                    />

                    {saveError && (
                        <div className="notebook-editor__save-message">
                            {saveError}
                        </div>
                    )}

                    {isMobile && (
                        <NotebookMobileActions
                            onRunWorkflow={handleRunWorkflow}
                            onOpenRunPanel={handleOpenRunPanel}
                            isWorkflowRunning={executionStatus === 'running'}
                        />
                    )}
                </section>
            </div>
        </main>
    );
}

export default NotebookEditor;
