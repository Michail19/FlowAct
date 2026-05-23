import type { NotebookBlockType } from './notebookTypes';

export type BlockSettingsHelp = {
    summary: string;
    backendType: string;
    input: string;
    output: string;
    variables: string[];
    templates: string[];
    notes?: string[];
};

export const TEMPLATE_VARIABLE_HINTS = [
    '{{input}}',
    '{{executionInput}}',
    '{{value}}',
    '{{value.text}}',
    '{{value.body}}',
    '{{value.body.extract}}',
    '{{last}}',
    '{{output}}',
    '{{variables.name}}',
];

const commonVariables = [
    '{{input}} — исходные данные запуска workflow',
    '{{value}} — основной результат предыдущего блока',
    '{{last}} / {{output}} — последний успешный результат',
    '{{variables.name}} — значение runtime-переменной',
];

export const BLOCK_SETTINGS_HELP: Record<NotebookBlockType, BlockSettingsHelp> = {
    start: {
        summary: 'Начальная точка workflow. Backend передаёт в него input, указанный при запуске.',
        backendType: 'START',
        input: 'Исходный input запуска workflow.',
        output: 'Передаёт исходный input дальше без изменений.',
        variables: ['input', 'executionInput'],
        templates: [
            '{ "text": "Текст для обработки", "type": "request" }',
        ],
        notes: [
            'Обычно start не требует настройки: он нужен как единая точка входа.',
        ],
    },
    end: {
        summary: 'Финальная точка workflow. Возвращает последний результат как итог выполнения.',
        backendType: 'END',
        input: 'Результат предыдущего блока.',
        output: 'Финальный output всего workflow.',
        variables: ['{{value}}', '{{last}}'],
        templates: [
            'Перед end обычно ставят Log, Email или Database, если результат нужно сохранить.',
        ],
    },
    ai: {
        summary: 'Отправляет prompt и данные предыдущих блоков в OpenRouter-совместимую LLM-модель.',
        backendType: 'LLM_REQUEST',
        input: 'Основной input берётся из предыдущего блока. В режиме smart backend сам сокращает HTTP/JSON-ответ до полезных полей.',
        output: 'Возвращает { status, body, text }, где text — ответ ассистента.',
        variables: [
            ...commonVariables,
            '{{value.body.extract}} — извлечённый текст из HTTP-ответа',
            '{{value.text}} — текст из предыдущего AI/Action блока',
        ],
        templates: [
            'Кратко перескажи текст и выдели 3 ключевых пункта:\n{{value.body.extract}}',
            'Определи категорию обращения. Верни JSON: {"category":"...","priority":"low|medium|high","summary":"..."}. Данные:\n{{value}}',
            'Сформируй ответ клиенту по данным:\n{{value.text}}',
        ],
        notes: [
            'Если prompt содержит {{...}}, backend подставляет переменные через TemplateRenderer.',
            'Для полного контроля выберите режим «Только по шаблону» и явно вставляйте нужные переменные.',
        ],
    },
    condition: {
        summary: 'Проверяет значение и выбирает ветку Да/Нет. В схеме связи должны выходить через handles yes/no.',
        backendType: 'IF',
        input: 'Проверяет value, input или variables в зависимости от левого значения.',
        output: 'Возвращает { result: true|false } и направляет выполнение в ветку true/false.',
        variables: [
            'value.status — статус результата предыдущего блока',
            'value.body.type — поле body.type предыдущего блока',
            'input.type — поле исходного input запуска',
            'variables.mode — runtime-переменная mode',
        ],
        templates: [
            'value.ok equals true',
            'value.status greaterThan 199',
            'value.status lessThan 300',
            'value.text contains ошибка',
            'variables.mode exists',
        ],
        notes: [
            'В левом значении используются пути без фигурных скобок: value.status, input.type, variables.mode.',
        ],
    },
    action: {
        summary: 'Преобразует данные. Backend рендерит шаблон parameters и возвращает JSON или текст как результат блока.',
        backendType: 'TRANSFORM_JSON',
        input: 'Основной input — value предыдущего блока или набор входящих inputs.',
        output: 'Если parameters содержит JSON — возвращает объект/массив. Иначе возвращает текст.',
        variables: commonVariables,
        templates: [
            '{\n  "text": "{{value.text}}",\n  "source": "flowact",\n  "status": "processed"\n}',
            '{\n  "status": "{{value.status}}",\n  "body": {{value.body}}\n}',
            'Результат предыдущего блока: {{value}}',
        ],
        notes: [
            'Для actionType format/transform/custom текущий backend возвращает отрендеренные parameters.',
            'Пустые parameters означают pass-through map-like input.',
        ],
    },
    database: {
        summary: 'Выполняет безопасный SQL-запрос через NamedParameterJdbcTemplate. SELECT включён, write-операции зависят от env.',
        backendType: 'DATABASE_QUERY',
        input: 'Можно подставлять данные из предыдущего блока в query и payload.',
        output: 'SELECT возвращает { operation, tableName, query, count, rows }. INSERT/UPDATE/DELETE возвращают rowsAffected.',
        variables: commonVariables,
        templates: [
            'SELECT * FROM execution_results WHERE status = :status',
            '{\n  "status": "{{value.status}}"\n}',
            'INSERT INTO execution_results(result_text) VALUES (:resultText)',
            '{\n  "resultText": "{{value.text}}"\n}',
        ],
        notes: [
            'Используйте именованные параметры SQL через :name, а значения передавайте в Payload JSON.',
            'Без query для SELECT можно указать только tableName — backend сам соберёт SELECT * FROM table LIMIT N.',
            'Несколько SQL statements и опасные ключевые слова блокируются, если dangerous SQL не разрешён env-настройкой.',
        ],
    },
    email: {
        summary: 'Формирует email-уведомление. Если SMTP выключен, backend вернёт preview без реальной отправки.',
        backendType: 'EMAIL_SEND',
        input: 'В теме и теле можно использовать output предыдущих блоков.',
        output: 'Возвращает { to, subject, body, sent, preview, reason? }.',
        variables: commonVariables,
        templates: [
            'Результат workflow: {{value.status}}',
            'Workflow завершён.\n\nКраткий результат:\n{{value.text}}\n\nПолные данные:\n{{value}}',
            'Ошибка workflow: {{last.error}}',
        ],
        notes: [
            'Получателей можно перечислять через запятую.',
            'Тема не должна содержать переносы строк, backend ограничивает длину темы и тела.',
        ],
    },
    log: {
        summary: 'Записывает читаемое сообщение в output блока и пропускает полезные данные дальше.',
        backendType: 'LOG_MESSAGE',
        input: 'Использует value предыдущего блока, все inputs, variables и last output.',
        output: 'Возвращает { value, log }, где value — исходный input, а log — служебная запись.',
        variables: commonVariables,
        templates: [
            'HTTP status: {{value.status}}, ok={{value.ok}}',
            'AI result: {{value.text}}',
            'Workflow value: {{value}}',
            'Last output: {{last}}',
        ],
        notes: [
            'После логирования цепочка не теряет результат предыдущего блока: он сохраняется в output.value.',
        ],
    },
    http: {
        summary: 'Вызывает внешний HTTP/HTTPS API, подставляет шаблоны в URL, headers и body, затем парсит ответ.',
        backendType: 'HTTP_REQUEST',
        input: 'Если body не задан, backend может передать value предыдущего блока как тело POST/PUT/PATCH.',
        output: 'Возвращает { ok, status, method, url, headers, body, error? }.',
        variables: commonVariables,
        templates: [
            'https://jsonplaceholder.typicode.com/posts/1',
            '{\n  "Accept": "application/json",\n  "Content-Type": "application/json"\n}',
            '{\n  "text": "{{value.text}}",\n  "source": "FlowAct"\n}',
            'https://api.example.com/items/{{value.id}}',
        ],
        notes: [
            'По умолчанию localhost/private-network URL запрещены настройкой WorkerService.',
            'Для HTTP 4xx/5xx включите continueOnError, если нужно передать ошибочный ответ дальше по workflow.',
        ],
    },
    loop: {
        summary: 'Проходит по коллекции внутри одного блока и возвращает список items/iterations/results.',
        backendType: 'MAP',
        input: 'collectionPath читает массив из value, input, inputs или variables.',
        output: 'Возвращает { collectionPath, itemName, mode, count, items, iterations, results }.',
        variables: [
            'value.items — массив из результата предыдущего блока',
            'value.body.items — массив внутри HTTP body',
            'input.items — массив из исходного input запуска',
            'variables.items — массив из переменных',
        ],
        templates: [
            'value.items',
            'value.body.items',
            'input.items',
            'variables.items',
        ],
        notes: [
            'Текущий loop не создаёт обратную стрелку в графе: итерации выполняются внутри одного backend-блока MAP.',
        ],
    },
    merge: {
        summary: 'Объединяет несколько входов после ветвления. Текущий backend возвращает один вход или map всех входов.',
        backendType: 'MERGE',
        input: 'При одном входе возвращает его напрямую. При нескольких входах возвращает объект inputs по id блоков.',
        output: 'Pass-through одного результата или объединённый объект входящих результатов.',
        variables: ['{{value}}', '{{inputs}}', '{{last}}'],
        templates: [
            'После IF заведите обе ветки в Merge, затем передайте Merge в Log/End.',
            'Для чтения объединённого результата в следующем блоке используйте {{value}}.',
        ],
        notes: [
            'Поле mode пока сохраняется для UI и будущего расширения: текущий backend MERGE фактически делает pass-through/combine автоматически.',
        ],
    },
};

export function getBlockSettingsHelp(blockType: NotebookBlockType): BlockSettingsHelp {
    return BLOCK_SETTINGS_HELP[blockType];
}
