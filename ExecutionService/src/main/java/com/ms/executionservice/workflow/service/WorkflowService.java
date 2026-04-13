package com.ms.executionservice.workflow.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.workflow.dto.WorkflowBlockDTO;
import com.ms.executionservice.workflow.dto.WorkflowConnectionDTO;
import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.WorkflowBlockRequest;
import com.ms.executionservice.workflow.dto.request.WorkflowConnectionRequest;
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

import java.time.OffsetDateTime;
import java.util.*;

@Service
public class WorkflowService {

    private final NotebookRepository notebookRepository;
    private final WorkflowRepository workflowRepository;
    private final WorkflowBlockRepository workflowBlockRepository;
    private final WorkflowConnectionRepository workflowConnectionRepository;
    private final JsonUtils jsonUtils;

    public WorkflowService(
            NotebookRepository notebookRepository,
            WorkflowRepository workflowRepository,
            WorkflowBlockRepository workflowBlockRepository,
            WorkflowConnectionRepository workflowConnectionRepository,
            JsonUtils jsonUtils
    ) {
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
                        .createdAt(OffsetDateTime.now())
                        .build();

                connectionEntities.add(connectionEntity);
            }
        }

        workflowConnectionRepository.saveAll(connectionEntities);

        return mapToWorkflowResponse(workflow);
    }

    @Transactional(readOnly = true)
    public WorkflowResponse getById(UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInNotebook(notebookId, workflowId);

        return mapToWorkflowResponse(workflow);
    }

    @Transactional(readOnly = true)
    public List<WorkflowShortResponse> getAll(UUID notebookId) {
        return workflowRepository.findByNotebook_Id(notebookId)
                .stream()
                .map(this::mapToWorkflowShortResponse)
                .toList();
    }

    @Transactional
    public WorkflowResponse update(
            UUID notebookId,
            UUID workflowId,
            UpdateWorkflowRequest request
    ) {
        WorkflowEntity workflow = findWorkflowInNotebook(notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            throw new IllegalArgumentException("Archived workflow cannot be updated");
        }

        if (request.blocks() == null || request.blocks().isEmpty()) {
            throw new IllegalArgumentException("Workflow must contain at least one block");
        }

        workflow.setName(request.name());
        workflow.setDescription(request.description());

        workflowRepository.save(workflow);

        List<WorkflowConnectionEntity> oldConnections =
                workflowConnectionRepository.findByWorkflow_Id(workflow.getId());

        if (!oldConnections.isEmpty()) {
            workflowConnectionRepository.deleteAll(oldConnections);
        }

        List<WorkflowBlockEntity> oldBlocks =
                workflowBlockRepository.findByWorkflow_Id(workflow.getId());

        if (!oldBlocks.isEmpty()) {
            workflowBlockRepository.deleteAll(oldBlocks);
        }

        Map<UUID, WorkflowBlockEntity> blocksById = new HashMap<>();
        List<WorkflowBlockEntity> newBlocks = new ArrayList<>();

        for (WorkflowBlockRequest blockRequest : request.blocks()) {
            UUID blockId = blockRequest.id() != null
                    ? blockRequest.id()
                    : UUID.randomUUID();

            WorkflowBlockEntity blockEntity = WorkflowBlockEntity.builder()
                    .id(blockId)
                    .workflow(workflow)
                    .type(blockRequest.type())
                    .name(blockRequest.name())
                    .position(jsonUtils.toJson(blockRequest.position()))
                    .config(jsonUtils.toJson(blockRequest.config()))
                    .build();

            newBlocks.add(blockEntity);
            blocksById.put(blockId, blockEntity);
        }

        workflowBlockRepository.saveAll(newBlocks);

        List<WorkflowConnectionEntity> newConnections = new ArrayList<>();

        if (request.connections() != null) {
            for (WorkflowConnectionRequest connectionRequest : request.connections()) {
                WorkflowBlockEntity fromBlock = blocksById.get(connectionRequest.fromBlockId());
                WorkflowBlockEntity toBlock = blocksById.get(connectionRequest.toBlockId());

                if (fromBlock == null || toBlock == null) {
                    throw new IllegalArgumentException(
                            "Connection references non-existent block: fromBlockId=%s, toBlockId=%s"
                                    .formatted(connectionRequest.fromBlockId(), connectionRequest.toBlockId())
                    );
                }

                WorkflowConnectionEntity connectionEntity = WorkflowConnectionEntity.builder()
                        .id(connectionRequest.id() != null
                                ? connectionRequest.id()
                                : UUID.randomUUID())
                        .workflow(workflow)
                        .fromBlock(fromBlock)
                        .toBlock(toBlock)
                        .condition(connectionRequest.condition())
                        .createdAt(OffsetDateTime.now())
                        .build();

                newConnections.add(connectionEntity);
            }
        }

        workflowConnectionRepository.saveAll(newConnections);

        return mapToWorkflowResponse(workflow);
    }

    @Transactional(readOnly = true)
    public WorkflowValidationResponse validate(UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInNotebook(notebookId, workflowId);

        List<WorkflowBlockEntity> blocks = workflowBlockRepository.findByWorkflow_Id(workflow.getId());
        List<WorkflowConnectionEntity> connections = workflowConnectionRepository.findByWorkflow_Id(workflow.getId());

        return validateWorkflowGraph(blocks, connections);
    }

    @Transactional
    public WorkflowResponse activate(UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInNotebook(notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            throw new IllegalArgumentException("Archived workflow cannot be activated");
        }

        WorkflowValidationResponse validation = validate(notebookId, workflowId);

        if (!validation.valid()) {
            throw new IllegalArgumentException(
                    "Workflow cannot be activated: " + String.join("; ", validation.errors())
            );
        }

        workflow.setStatus(WorkflowStatus.ACTIVE);
        workflowRepository.save(workflow);

        return mapToWorkflowResponse(workflow);
    }

    @Transactional
    public WorkflowResponse archive(UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInNotebook(notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            return mapToWorkflowResponse(workflow);
        }

        workflow.setStatus(WorkflowStatus.ARCHIVED);
        workflowRepository.save(workflow);

        return mapToWorkflowResponse(workflow);
    }

    private WorkflowEntity findWorkflowInNotebook(UUID notebookId, UUID workflowId) {
        return workflowRepository
                .findByIdAndNotebook_Id(workflowId, notebookId)
                .orElseThrow(() -> new EntityNotFoundException("Workflow not found"));
    }

    private WorkflowValidationResponse validateWorkflowGraph(
            List<WorkflowBlockEntity> blocks,
            List<WorkflowConnectionEntity> connections
    ) {
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (blocks == null || blocks.isEmpty()) {
            errors.add("Workflow must contain at least one block");
            return new WorkflowValidationResponse(false, errors, warnings);
        }

        Set<UUID> blockIds = new HashSet<>();

        for (WorkflowBlockEntity block : blocks) {
            if (block.getId() == null) {
                errors.add("Workflow contains block without id");
                continue;
            }

            if (!blockIds.add(block.getId())) {
                errors.add("Duplicate block id: " + block.getId());
            }

            if (block.getType() == null) {
                errors.add("Block %s has no type".formatted(block.getId()));
            }

            if (block.getName() == null || block.getName().isBlank()) {
                errors.add("Block %s has empty name".formatted(block.getId()));
            }

            if (block.getPosition() == null || block.getPosition().isBlank()) {
                warnings.add("Block %s has empty position".formatted(block.getId()));
            }

            if (block.getConfig() == null || block.getConfig().isBlank()) {
                warnings.add("Block %s has empty config".formatted(block.getId()));
            }
        }

        if (connections != null) {
            for (WorkflowConnectionEntity connection : connections) {
                if (connection.getFromBlock() == null || connection.getFromBlock().getId() == null) {
                    errors.add("Connection %s has no fromBlock".formatted(connection.getId()));
                    continue;
                }

                if (connection.getToBlock() == null || connection.getToBlock().getId() == null) {
                    errors.add("Connection %s has no toBlock".formatted(connection.getId()));
                    continue;
                }

                UUID fromBlockId = connection.getFromBlock().getId();
                UUID toBlockId = connection.getToBlock().getId();

                if (!blockIds.contains(fromBlockId)) {
                    errors.add("Connection %s references non-existent fromBlock: %s"
                            .formatted(connection.getId(), fromBlockId));
                }

                if (!blockIds.contains(toBlockId)) {
                    errors.add("Connection %s references non-existent toBlock: %s"
                            .formatted(connection.getId(), toBlockId));
                }

                if (Objects.equals(fromBlockId, toBlockId)) {
                    warnings.add("Connection %s points block to itself: %s"
                            .formatted(connection.getId(), fromBlockId));
                }
            }
        }

        return new WorkflowValidationResponse(errors.isEmpty(), errors, warnings);
    }

    private WorkflowResponse mapToWorkflowResponse(WorkflowEntity workflow) {
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

    private WorkflowShortResponse mapToWorkflowShortResponse(WorkflowEntity workflow) {
        return WorkflowShortResponse.builder()
                .id(workflow.getId())
                .notebookId(workflow.getNotebook().getId())
                .name(workflow.getName())
                .description(workflow.getDescription())
                .status(workflow.getStatus())
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
}
