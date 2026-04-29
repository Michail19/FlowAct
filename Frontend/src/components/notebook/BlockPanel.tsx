import './BlockPanel.css';

const blocks = ['▶', '🤖', '✉', 'DB', '⚙'];

function BlockPanel() {
    return (
        <aside className="block-panel">
            {blocks.map((block) => (
                <button className="block-panel__button" key={block} type="button">
                    {block}
                </button>
            ))}
        </aside>
    );
}

export default BlockPanel;
