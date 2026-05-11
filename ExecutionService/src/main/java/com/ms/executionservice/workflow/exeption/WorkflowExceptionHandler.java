package com.ms.executionservice.workflow.exeption;

import com.ms.executionservice.common.dto.ApiErrorResponse;
import com.ms.executionservice.workflow.controller.WorkflowController;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = WorkflowController.class)
public class WorkflowExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiErrorResponse handleBadRequest(IllegalArgumentException ex) {
        return ApiErrorResponse.builder()
                .status(400)
                .error("Bad Request")
                .message(ex.getMessage())
                .build();
    }
}
