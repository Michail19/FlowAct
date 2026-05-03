import NotebookSvgIcon from './NotebookSvgIcon';

import './NotebookMobileActions.css';

type NotebookMobileActionsProps = {
    onRunWorkflow: () => void;
    onOpenRunPanel: () => void;
    isWorkflowRunning: boolean;
};

function NotebookMobileActions({
                                   onRunWorkflow,
                                   onOpenRunPanel,
                                   isWorkflowRunning,
                               }: NotebookMobileActionsProps) {
    return (
        <div className="notebook-mobile-actions">
            <button
                className="notebook-mobile-actions__play"
                type="button"
                aria-label="Запустить рабочий процесс"
                onClick={onRunWorkflow}
                disabled={isWorkflowRunning}
            >
                <NotebookSvgIcon name={isWorkflowRunning ? 'loading' : 'play'} />
            </button>

            <button
                className="notebook-mobile-actions__result"
                type="button"
                onClick={onOpenRunPanel}
            >
                Результат
            </button>
        </div>
    );
}

export default NotebookMobileActions;
