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
    NotebookHistoryRequest,
    NotebookHistoryState,
    NotebookSearchRequest,
    NotebookSearchResult,
    NotebookViewportRequest,
    NotebookZoomValue,
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
    WorkflowExecutionResult,
    WorkflowExecutionStatus,
    WorkflowRunRequest,
} from './executionTypes';
import { toBackendWorkflowRequest } from './backendWorkflowMapper';

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
    const viewportRequestIdRef = useRef(0);
    const searchRequestIdRef = useRef(0);
    const historyRequestIdRef = useRef(0);

    const [blockRequest, setBlockRequest] = useState<NotebookBlockRequest | null>(null);
    const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
    const [notebookPayload, setNotebookPayload] = useState<NotebookPayloadDto | null>(null);
    const [loadedNotebookPayload, setLoadedNotebookPayload] =
        useState<NotebookPayloadDto | null>(initialNotebookPayload);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [runRequest, setRunRequest] = useState<WorkflowRunRequest | null>(null);
    const [executionStatus, setExecutionStatus] = useState<WorkflowExecutionStatus>('idle');
    const [executionLogs, setExecutionLogs] = useState<NotebookExecutionLog[]>([]);
    const [executionResult, setExecutionResult] =
        useState<WorkflowExecutionResult | null>(null);
    const [isRunPanelOpen, setIsRunPanelOpen] = useState(false);
    const [autoLayoutRequest, setAutoLayoutRequest] =
        useState<NotebookAutoLayoutRequest | null>(null);
    const [isInterfaceHidden, setIsInterfaceHidden] = useState(false);
    const [zoomValue, setZoomValue] = useState<NotebookZoomValue>('100');
    const [viewportRequest, setViewportRequest] =
        useState<NotebookViewportRequest | null>(null);
    const [searchRequest, setSearchRequest] =
        useState<NotebookSearchRequest | null>(null);
    const [searchResult, setSearchResult] =
        useState<NotebookSearchResult | null>(null);
    const [historyRequest, setHistoryRequest] =
        useState<NotebookHistoryRequest | null>(null);
    const [historyState, setHistoryState] = useState<NotebookHistoryState>({
        canUndo: false,
        canRedo: false,
    });

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

        const backendWorkflowPayload = toBackendWorkflowRequest(payloadToSave);

        console.log('Backend workflow contract:', backendWorkflowPayload);

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

        setExecutionResult(null);
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
        setExecutionResult(null);
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

    const handleZoomChange = useCallback((nextZoomValue: NotebookZoomValue) => {
        viewportRequestIdRef.current += 1;

        setZoomValue(nextZoomValue);

        if (nextZoomValue === 'auto') {
            setViewportRequest({
                requestId: viewportRequestIdRef.current,
                mode: 'fit',
            });

            return;
        }

        setViewportRequest({
            requestId: viewportRequestIdRef.current,
            mode: 'zoom',
            zoom: Number(nextZoomValue) / 100,
        });
    }, []);

    const handleViewportRequestHandled = useCallback((requestId: number) => {
        setViewportRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    const handleRenameNotebook = useCallback(
        (nextTitle: string) => {
            const normalizedTitle = nextTitle.trim() || 'Без названия';

            setNotebookTitle(normalizedTitle);

            const basePayload = notebookPayload ?? loadedNotebookPayload;

            if (!basePayload) {
                return;
            }

            const renamedNotebook: NotebookPayloadDto = {
                ...basePayload,
                id: notebookId,
                title: normalizedTitle,
                updatedAt: new Date().toISOString(),
            };

            const savedLocalNotebook = saveNotebookLocally(renamedNotebook);

            setLoadedNotebookPayload(savedLocalNotebook);
            setNotebookPayload(savedLocalNotebook);
            setSaveError(null);
        },
        [loadedNotebookPayload, notebookId, notebookPayload],
    );

    const handleToggleInterface = useCallback(() => {
        setIsInterfaceHidden((currentValue) => !currentValue);
    }, []);

    const handleSearchBlocks = useCallback((query: string) => {
        searchRequestIdRef.current += 1;

        setSearchResult(null);
        setSearchRequest({
            requestId: searchRequestIdRef.current,
            query,
        });
    }, []);

    const handleSearchRequestHandled = useCallback((result: NotebookSearchResult) => {
        setSearchResult(result);
        setSearchRequest((currentRequest) =>
            currentRequest?.requestId === result.requestId ? null : currentRequest,
        );
    }, []);

    const handleUndo = useCallback(() => {
        historyRequestIdRef.current += 1;

        setHistoryRequest({
            requestId: historyRequestIdRef.current,
            action: 'undo',
        });
    }, []);

    const handleRedo = useCallback(() => {
        historyRequestIdRef.current += 1;

        setHistoryRequest({
            requestId: historyRequestIdRef.current,
            action: 'redo',
        });
    }, []);

    const handleHistoryRequestHandled = useCallback((requestId: number) => {
        setHistoryRequest((currentRequest) =>
            currentRequest?.requestId === requestId ? null : currentRequest,
        );
    }, []);

    return (
        <main
            className={
                isInterfaceHidden
                    ? 'notebook-editor notebook-editor--focus'
                    : 'notebook-editor'
            }
        >
            <NotebookHeader
                isMobile={isMobile}
                title={notebookTitle}
                updatedAt={notebookPayload?.updatedAt ?? loadedNotebookPayload?.updatedAt}
                onRename={handleRenameNotebook}
                onSave={handleSaveNotebook}
                isSaving={isSaving}
                isInterfaceHidden={isInterfaceHidden}
                onToggleInterface={handleToggleInterface}
                zoomValue={zoomValue}
                onZoomChange={handleZoomChange}
            />

            <div className="notebook-editor__body">
                {isDesktop && !isInterfaceHidden && (
                    <NotebookToolbar
                        onAddBlock={handleAddBlock}
                        onRunWorkflow={handleRunWorkflow}
                        onOpenRunPanel={handleOpenRunPanel}
                        onAutoLayout={() => handleAutoLayout('arrange-connect')}
                        isWorkflowRunning={executionStatus === 'running'}
                    />
                )}

                <section className="notebook-editor__workspace">
                    {!isInterfaceHidden && (
                        <NotebookSearch
                            result={searchResult}
                            onSearch={handleSearchBlocks}
                            onUndo={handleUndo}
                            onRedo={handleRedo}
                            canUndo={historyState.canUndo}
                            canRedo={historyState.canRedo}
                        />
                    )}

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
                        onExecutionResultChange={setExecutionResult}
                        autoLayoutRequest={autoLayoutRequest}
                        onAutoLayoutRequestHandled={handleAutoLayoutRequestHandled}
                        viewportRequest={viewportRequest}
                        onViewportRequestHandled={handleViewportRequestHandled}
                        searchRequest={searchRequest}
                        onSearchRequestHandled={handleSearchRequestHandled}
                        historyRequest={historyRequest}
                        onHistoryRequestHandled={handleHistoryRequestHandled}
                        onHistoryStateChange={setHistoryState}
                    />

                    {!isInterfaceHidden && (
                        <NotebookRunPanel
                            isOpen={isRunPanelOpen}
                            status={executionStatus}
                            logs={executionLogs}
                            result={executionResult}
                            isMobile={isMobile}
                            onClose={handleCloseRunPanel}
                            onClear={handleClearExecutionLogs}
                            onRunWorkflow={handleRunWorkflow}
                        />
                    )}

                    {!isInterfaceHidden && (
                        <NotebookSuggestion
                            isMobile={isMobile}
                            suggestion={visibleSuggestion}
                            onAccept={handleAcceptSuggestion}
                            onDismiss={handleDismissSuggestion}
                        />
                    )}

                    {saveError && !isInterfaceHidden && (
                        <div className="notebook-editor__save-message">
                            {saveError}
                        </div>
                    )}

                    {isMobile && !isInterfaceHidden && (
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
