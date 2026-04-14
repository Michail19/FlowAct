package com.ms.workerservice.workflow.enumtype;

public enum BlockType {
    START,
    END,
    INPUT,
    IF,
    SWITCH,
    MERGE,
    SET_VARIABLE,
    MAP,
    FILTER,
    TRANSFORM_JSON,
    HTTP_REQUEST,
    LLM_REQUEST,
    ML_REQUEST,
    DELAY,
    WAIT,
    WEBHOOK
}
