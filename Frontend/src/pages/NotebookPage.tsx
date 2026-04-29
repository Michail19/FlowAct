import FlowCanvas from '../components/notebook/FlowCanvas';
import BlockPanel from '../components/notebook/BlockPanel';

function NotebookPage() {
  return (
    <main className="notebook-page">
      <BlockPanel />
      <FlowCanvas />
      <aside className="notebook-sidebar">
        <h3>Настройки блока</h3>
        <p>Выберите блок для редактирования параметров.</p>
      </aside>
    </main>
  );
}

export default NotebookPage;
