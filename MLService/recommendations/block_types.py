ALLOWED_BLOCK_TYPES = {
    "start",
    "end",
    "ai",
    "condition",
    "action",
    "database",
    "email",
    "log",
    "http",
    "loop",
    "merge",
}


BLOCK_TITLES = {
    "start": "Старт",
    "end": "Конец",
    "ai": "AI-функция",
    "condition": "Условие",
    "action": "Действие",
    "database": "База данных",
    "email": "Email",
    "log": "Логирование",
    "http": "HTTP-запрос",
    "loop": "Цикл",
    "merge": "Объединение",
}


RECOMMENDATION_TEMPLATES = {
    "start": {
        "reason": "В рабочем процессе отсутствует стартовый блок. Для запуска схемы нужна начальная точка выполнения.",
        "proposedConfig": {},
    },
    "end": {
        "reason": "Рабочий процесс можно завершить конечным блоком, если дополнительных действий больше не требуется.",
        "proposedConfig": {},
    },
    "ai": {
        "reason": "После стартового блока часто добавляют AI-блок для обработки входных данных.",
        "proposedConfig": {},
    },
    "condition": {
        "reason": "После HTTP-запроса или AI-обработки полезно добавить условие для проверки результата.",
        "proposedConfig": {
            "condition": {
                "leftValue": "input.status",
                "operator": "equals",
                "rightValue": "success",
            }
        },
    },
    "action": {
        "reason": "Можно добавить универсальное действие для преобразования или обработки данных.",
        "proposedConfig": {
            "action": {
                "actionType": "transform",
                "parameters": "",
            }
        },
    },
    "database": {
        "reason": "Если результат нужно сохранить или получить дополнительные данные, можно добавить блок базы данных.",
        "proposedConfig": {
            "database": {
                "operation": "select",
                "tableName": "",
                "query": "",
                "payload": "",
            }
        },
    },
    "email": {
        "reason": "После проверки результата можно отправить уведомление пользователю.",
        "proposedConfig": {
            "email": {
                "recipient": "",
                "subject": "FlowAct notification",
                "body": "Result: {{input}}",
            }
        },
    },
    "log": {
        "reason": "После выполнения блока полезно добавить логирование, чтобы сохранить и проверить результат.",
        "proposedConfig": {
            "log": {
                "level": "info",
                "messageTemplate": "Result: {{input}}",
            }
        },
    },
    "http": {
        "reason": "Для получения данных из внешнего сервиса можно добавить HTTP-запрос.",
        "proposedConfig": {
            "http": {
                "method": "GET",
                "url": "",
                "headers": "{}",
                "body": "",
                "timeoutMs": 10000,
                "maxResponseChars": 50000,
                "responseMode": "auto",
                "continueOnError": False,
            }
        },
    },
    "loop": {
        "reason": "Если входные данные содержат коллекцию, можно добавить цикл для обработки элементов.",
        "proposedConfig": {
            "loop": {
                "collectionPath": "input.items",
                "itemName": "item",
                "mode": "map",
            }
        },
    },
    "merge": {
        "reason": "После ветвления удобно добавить объединение, чтобы собрать разные ветки в один общий поток.",
        "proposedConfig": {
            "merge": {
                "mode": "combine",
            }
        },
    },
}
