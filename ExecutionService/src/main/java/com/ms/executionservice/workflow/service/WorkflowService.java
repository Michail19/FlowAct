package com.ms.executionservice.workflow.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.workflow.dto.WorkflowBlockDTO;
import com.ms.executionservice.workflow.dto.WorkflowConnectionDTO;
import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowShortResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import com.ms.executionservice.workflow.entity.NotebookEntity;
import com.ms.executionservice.workflow.entity.WorkflowBlockEntity;
import com.ms.executionservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
import com.ms.executionservice.workflow.repository.NotebookRepository;
import com.ms.executionservice.workflow.repository.WorkflowBlockRepository;
import com.ms.executionservice.workflow.repository.WorkflowConnectionRepository;
import com.ms.executionservice.workflow.repository.WorkflowRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class WorkflowService {
    private final NotebookRepository notebookRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowBlockRepository workflowBlockRepository;
    private final WorkflowConnectionRepository workflowConnectionRepository;
    private final JsonUtils jsonUtils;

    public WorkflowService(NotebookRepository notebookRepository,
                           WorkflowRepository workflowRepository,
                           WorkflowBlockRepository workflowBlockRepository,
                           WorkflowConnectionRepository workflowConnectionRepository,
                           JsonUtils jsonUtils) {
        this.notebookRepository = notebookRepository;
        this.workflowRepository = workflowRepository;
        this.workflowBlockRepository = workflowBlockRepository;
        this.workflowConnectionRepository = workflowConnectionRepository;
        this.jsonUtils = jsonUtils;
    }

    @Transactional
    public WorkflowResponse create(UUID notebookId, CreateWorkflowRequest request) {
        NotebookEntity notebook = notebookRepository.findById(notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Notebook not found"));

        if (request.blocks() == null || request.blocks().isEmpty()) {
            throw new IllegalArgumentException("Workflow must contain at least one block");
        }

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(UUID.randomUUID())
                .notebook(notebook)
                .name(request.name())
                .description(request.description())
                .status(WorkflowStatus.DRAFT)
                .build();

        workflow = workflowRepository.save(workflow);

        Map<UUID, WorkflowBlockEntity> blocksById = new HashMap<>();
        List<WorkflowBlockEntity> blockEntities = new ArrayList<>();

        for (WorkflowBlockDTO blockDto : request.blocks()) {
            UUID blockId = blockDto.id() != null ? blockDto.id() : UUID.randomUUID();

            WorkflowBlockEntity blockEntity = WorkflowBlockEntity.builder()
                    .id(blockId)
                    .workflow(workflow)
                    .type(blockDto.type())
                    .name(blockDto.name())
                    .position(jsonUtils.toJson(blockDto.position()))
                    .config(jsonUtils.toJson(blockDto.config()))
                    .build();

            blockEntities.add(blockEntity);
            blocksById.put(blockId, blockEntity);
        }

        workflowBlockRepository.saveAll(blockEntities);

        List<WorkflowConnectionEntity> connectionEntities = new ArrayList<>();

        if (request.connections() != null) {
            for (WorkflowConnectionDTO connectionDto : request.connections()) {
                WorkflowBlockEntity fromBlock = blocksById.get(connectionDto.fromBlockId());
                WorkflowBlockEntity toBlock = blocksById.get(connectionDto.toBlockId());

                if (fromBlock == null || toBlock == null) {
                    throw new IllegalArgumentException(
                            "Connection references non-existent block: fromBlockId=%s, toBlockId=%s"
                                    .formatted(connectionDto.fromBlockId(), connectionDto.toBlockId())
                    );
                }

                WorkflowConnectionEntity connectionEntity = WorkflowConnectionEntity.builder()
                        .id(connectionDto.id() != null ? connectionDto.id() : UUID.randomUUID())
                        .workflow(workflow)
                        .fromBlock(fromBlock)
                        .toBlock(toBlock)
                        .condition(connectionDto.condition())
                        .createdAt(java.time.OffsetDateTime.now())
                        .build();

                connectionEntities.add(connectionEntity);
            }
        }

        workflowConnectionRepository.saveAll(connectionEntities);

        List<WorkflowBlockDTO> blockResponses = blockEntities.stream()
                .map(this::toBlockResponse)
                .toList();

        List<WorkflowConnectionDTO> connectionResponses = connectionEntities.stream()
                .map(this::toConnectionResponse)
                .toList();

        return WorkflowResponse.builder()
                .id(workflow.getId())
                .notebookId(workflow.getNotebook().getId())
                .name(workflow.getName())
                .description(workflow.getDescription())
                .status(workflow.getStatus())
                .blocks(blockResponses)
                .connections(connectionResponses)
                .createdAt(workflow.getCreatedAt())
                .updatedAt(workflow.getUpdatedAt())
                .build();
    }

    private WorkflowBlockDTO toBlockResponse(WorkflowBlockEntity entity) {
        return WorkflowBlockDTO.builder()
                .id(entity.getId())
                .workflowId(entity.getWorkflow().getId())
                .type(entity.getType())
                .name(entity.getName())
                .position(jsonUtils.toMap(entity.getPosition()))
                .config(jsonUtils.toMap(entity.getConfig()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private WorkflowConnectionDTO toConnectionResponse(WorkflowConnectionEntity entity) {
        return WorkflowConnectionDTO.builder()
                .id(entity.getId())
                .workflowId(entity.getWorkflow().getId())
                .fromBlockId(entity.getFromBlock().getId())
                .toBlockId(entity.getToBlock().getId())
                .condition(entity.getCondition())
                .createdAt(entity.getCreatedAt())
                .build();
    }

    public WorkflowResponse getById(UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = workflowRepository
                .findByIdAndNotebook_Id(workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Workflow not found"));

        List<WorkflowBlockDTO> blocks = workflowBlockRepository.findByWorkflow_Id(workflow.getId())
                .stream()
                .map(this::toBlockResponse)
                .toList();

        List<WorkflowConnectionDTO> connections = workflowConnectionRepository.findByWorkflow_Id(workflow.getId())
                .stream()
                .map(this::toConnectionResponse)
                .toList();

        return WorkflowResponse.builder()
                .id(workflow.getId())
                .notebookId(workflow.getNotebook().getId())
                .name(workflow.getName())
                .description(workflow.getDescription())
                .status(workflow.getStatus())
                .blocks(blocks)
                .connections(connections)
                .createdAt(workflow.getCreatedAt())
                .updatedAt(workflow.getUpdatedAt())
                .build();
    }

    public List<WorkflowShortResponse> getAll(UUID notebookId) {
        return workflowRepository.findByNotebook_Id(notebookId)
                .stream()
                .map(workflow -> WorkflowShortResponse.builder()
                        .id(workflow.getId())
                        .notebookId(workflow.getNotebook().getId())
                        .name(workflow.getName())
                        .description(workflow.getDescription())
                        .status(workflow.getStatus())
                        .createdAt(workflow.getCreatedAt())
                        .updatedAt(workflow.getUpdatedAt())
                        .build())
                .toList();
    }

    public WorkflowResponse update(
            UUID notebookId,
            UUID workflowId,
            UpdateWorkflowRequest request
    ) {}

    public WorkflowValidationResponse validate(UUID notebookId, UUID workflowId) {}

    public WorkflowResponse activate(UUID notebookId, UUID workflowId) {}

    public WorkflowResponse archive(UUID notebookId, UUID workflowId) {}
}
