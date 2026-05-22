package com.ms.executionservice.workflow.service;

import com.ms.executionservice.common.exception.EntityNotFoundException;
import com.ms.executionservice.common.util.JsonUtils;
import com.ms.executionservice.notebooks.entity.NotebookEntity;
import com.ms.executionservice.notebooks.repository.NotebookRepository;
import com.ms.executionservice.workflow.dto.WorkflowBlockDTO;
import com.ms.executionservice.workflow.dto.WorkflowConnectionDTO;
import com.ms.executionservice.workflow.dto.request.CreateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.UpdateWorkflowRequest;
import com.ms.executionservice.workflow.dto.request.WorkflowBlockRequest;
import com.ms.executionservice.workflow.dto.request.WorkflowConnectionRequest;
import com.ms.executionservice.workflow.dto.response.WorkflowResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowShortResponse;
import com.ms.executionservice.workflow.dto.response.WorkflowValidationResponse;
import com.ms.executionservice.workflow.entity.WorkflowBlockEntity;
import com.ms.executionservice.workflow.entity.WorkflowConnectionEntity;
import com.ms.executionservice.workflow.entity.WorkflowEntity;
import com.ms.executionservice.workflow.enumtype.BlockType;
import com.ms.executionservice.workflow.enumtype.WorkflowStatus;
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
    public WorkflowResponse create(UUID currentUserId, UUID notebookId, CreateWorkflowRequest request) {
        NotebookEntity notebook = findNotebookForUser(currentUserId, notebookId);

        if (request.blocks() == null || request.blocks().isEmpty()) {
            throw new IllegalArgumentException("Workflow must contain at least one block");
        }

        WorkflowEntity workflow = WorkflowEntity.builder()
                .id(UUID.randomUUID())
                .notebook(notebook)
                .name(request.name())
                .description(request.description())
                .metadata(jsonUtils.toJson(request.metadata()))
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
    public WorkflowResponse getById(UUID currentUserId, UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        return mapToWorkflowResponse(workflow);
    }

    @Transactional(readOnly = true)
    public List<WorkflowShortResponse> getAll(UUID currentUserId, UUID notebookId) {
        findNotebookForUser(currentUserId, notebookId);

        return workflowRepository.findByNotebook_Id(notebookId)
                .stream()
                .map(this::mapToWorkflowShortResponse)
                .toList();
    }

    @Transactional
    public WorkflowResponse update(
            UUID currentUserId,
            UUID notebookId,
            UUID workflowId,
            UpdateWorkflowRequest request
    ) {
        WorkflowEntity workflow = findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            throw new IllegalArgumentException("Archived workflow cannot be updated");
        }

        WorkflowStatus previousStatus = workflow.getStatus();

        if (request.blocks() == null || request.blocks().isEmpty()) {
            throw new IllegalArgumentException("Workflow must contain at least one block");
        }

        workflow.setName(request.name());
        workflow.setDescription(request.description());
        workflow.setMetadata(jsonUtils.toJson(request.metadata()));

        if (previousStatus == WorkflowStatus.ACTIVE) {
            workflow.setStatus(WorkflowStatus.DRAFT);
        }

        workflowRepository.save(workflow);

        List<WorkflowConnectionEntity> oldConnections =
                workflowConnectionRepository.findByWorkflow_Id(workflow.getId());

        if (!oldConnections.isEmpty()) {
            workflowConnectionRepository.deleteAll(oldConnections);
            workflowConnectionRepository.flush();
        }

        List<WorkflowBlockEntity> oldBlocks =
                workflowBlockRepository.findByWorkflow_Id(workflow.getId());

        if (!oldBlocks.isEmpty()) {
            workflowBlockRepository.deleteAll(oldBlocks);
            workflowBlockRepository.flush();
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
    public WorkflowValidationResponse validate(UUID currentUserId, UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        List<WorkflowBlockEntity> blocks = workflowBlockRepository.findByWorkflow_Id(workflow.getId());
        List<WorkflowConnectionEntity> connections = workflowConnectionRepository.findByWorkflow_Id(workflow.getId());

        return validateWorkflowGraph(blocks, connections);
    }

    @Transactional
    public WorkflowResponse activate(UUID currentUserId, UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            throw new IllegalArgumentException("Archived workflow cannot be activated");
        }

        WorkflowValidationResponse validation = validate(currentUserId, notebookId, workflowId);

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
    public WorkflowResponse archive(UUID currentUserId, UUID notebookId, UUID workflowId) {
        WorkflowEntity workflow = findWorkflowInUserNotebook(currentUserId, notebookId, workflowId);

        if (workflow.getStatus() == WorkflowStatus.ARCHIVED) {
            return mapToWorkflowResponse(workflow);
        }

        workflow.setStatus(WorkflowStatus.ARCHIVED);
        workflowRepository.save(workflow);

        return mapToWorkflowResponse(workflow);
    }

    private NotebookEntity findNotebookForUser(UUID currentUserId, UUID notebookId) {
        return notebookRepository.findByIdAndOwnerUserId(notebookId, currentUserId)
                .orElseThrow(() -> new EntityNotFoundException("Notebook not found"));
    }

    private WorkflowEntity findWorkflowInUserNotebook(UUID currentUserId, UUID notebookId, UUID workflowId) {
        findNotebookForUser(currentUserId, notebookId);

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

        Map<UUID, WorkflowBlockEntity> blocksById = validateBlocks(blocks, errors, warnings);
        validateConnections(connections, blocksById.keySet(), errors, warnings);

        Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections = buildOutgoingConnections(connections);
        Map<UUID, List<WorkflowConnectionEntity>> incomingConnections = buildIncomingConnections(connections);

        validateStartAndEndBlocks(blocks, incomingConnections, outgoingConnections, errors);
        validateRequiredOutgoingConnections(blocks, outgoingConnections, errors);
        validateBlockTypeRules(blocks, incomingConnections, outgoingConnections, errors);
        validateReachabilityAndCycles(blocks, blocksById, outgoingConnections, errors);

        return new WorkflowValidationResponse(errors.isEmpty(), errors, warnings);
    }

    private Map<UUID, WorkflowBlockEntity> validateBlocks(
            List<WorkflowBlockEntity> blocks,
            List<String> errors,
            List<String> warnings
    ) {
        Map<UUID, WorkflowBlockEntity> blocksById = new HashMap<>();

        for (WorkflowBlockEntity block : blocks) {
            if (block.getId() == null) {
                errors.add("Workflow contains block without id");
                continue;
            }

            if (blocksById.put(block.getId(), block) != null) {
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

        return blocksById;
    }

    private void validateConnections(
            List<WorkflowConnectionEntity> connections,
            Set<UUID> blockIds,
            List<String> errors,
            List<String> warnings
    ) {
        if (connections == null) {
            return;
        }

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

    private Map<UUID, List<WorkflowConnectionEntity>> buildOutgoingConnections(
            List<WorkflowConnectionEntity> connections
    ) {
        Map<UUID, List<WorkflowConnectionEntity>> result = new HashMap<>();

        if (connections == null) {
            return result;
        }

        for (WorkflowConnectionEntity connection : connections) {
            if (connection.getFromBlock() == null || connection.getFromBlock().getId() == null) {
                continue;
            }

            result.computeIfAbsent(connection.getFromBlock().getId(), key -> new ArrayList<>())
                    .add(connection);
        }

        return result;
    }

    private Map<UUID, List<WorkflowConnectionEntity>> buildIncomingConnections(
            List<WorkflowConnectionEntity> connections
    ) {
        Map<UUID, List<WorkflowConnectionEntity>> result = new HashMap<>();

        if (connections == null) {
            return result;
        }

        for (WorkflowConnectionEntity connection : connections) {
            if (connection.getToBlock() == null || connection.getToBlock().getId() == null) {
                continue;
            }

            result.computeIfAbsent(connection.getToBlock().getId(), key -> new ArrayList<>())
                    .add(connection);
        }

        return result;
    }

    private void validateStartAndEndBlocks(
            List<WorkflowBlockEntity> blocks,
            Map<UUID, List<WorkflowConnectionEntity>> incomingConnections,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        List<WorkflowBlockEntity> startBlocks = blocks.stream()
                .filter(block -> block.getType() == BlockType.START)
                .toList();

        if (startBlocks.isEmpty()) {
            errors.add("Workflow has no START block");
        } else if (startBlocks.size() > 1) {
            errors.add("Workflow has more than one START block");
        } else {
            WorkflowBlockEntity startBlock = startBlocks.get(0);

            if (!incomingConnections.getOrDefault(startBlock.getId(), List.of()).isEmpty()) {
                errors.add("START block must not have incoming connections: " + startBlock.getId());
            }

            if (outgoingConnections.getOrDefault(startBlock.getId(), List.of()).isEmpty()) {
                errors.add("START block must have outgoing connection: " + startBlock.getId());
            }
        }

        List<WorkflowBlockEntity> endBlocks = blocks.stream()
                .filter(block -> block.getType() == BlockType.END)
                .toList();

        if (endBlocks.isEmpty()) {
            errors.add("Workflow has no END block");
        }

        for (WorkflowBlockEntity endBlock : endBlocks) {
            if (!outgoingConnections.getOrDefault(endBlock.getId(), List.of()).isEmpty()) {
                errors.add("END block must not have outgoing connections: " + endBlock.getId());
            }
        }
    }

    private void validateRequiredOutgoingConnections(
            List<WorkflowBlockEntity> blocks,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        for (WorkflowBlockEntity block : blocks) {
            if (block.getType() == null || block.getType() == BlockType.END) {
                continue;
            }

            if (outgoingConnections.getOrDefault(block.getId(), List.of()).isEmpty()) {
                errors.add("Block has no outgoing connection: " + block.getId());
            }
        }
    }

    private void validateBlockTypeRules(
            List<WorkflowBlockEntity> blocks,
            Map<UUID, List<WorkflowConnectionEntity>> incomingConnections,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        for (WorkflowBlockEntity block : blocks) {
            if (block.getType() == null) {
                continue;
            }

            switch (block.getType()) {
                case IF -> validateIfBlock(block, outgoingConnections, errors);
                case SWITCH -> validateSwitchBlock(block, outgoingConnections, errors);
                case MERGE -> validateMergeBlock(block, incomingConnections, outgoingConnections, errors);
                default -> validateSingleOutgoingBlock(block, outgoingConnections, errors);
            }
        }
    }

    private void validateIfBlock(
            WorkflowBlockEntity block,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        List<WorkflowConnectionEntity> outgoing = outgoingConnections.getOrDefault(block.getId(), List.of());

        if (outgoing.size() < 2) {
            errors.add("IF block must have at least 2 outgoing connections: " + block.getId());
            return;
        }

        boolean hasTrue = outgoing.stream()
                .anyMatch(connection -> "true".equalsIgnoreCase(normalizeCondition(connection.getCondition())));

        boolean hasFalse = outgoing.stream()
                .anyMatch(connection -> "false".equalsIgnoreCase(normalizeCondition(connection.getCondition())));

        if (!hasTrue || !hasFalse) {
            errors.add("IF block must have outgoing branches with conditions 'true' and 'false': "
                    + block.getId());
        }
    }

    private void validateSwitchBlock(
            WorkflowBlockEntity block,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        List<WorkflowConnectionEntity> outgoing = outgoingConnections.getOrDefault(block.getId(), List.of());

        if (outgoing.size() < 2) {
            errors.add("SWITCH block must have at least 2 outgoing connections: " + block.getId());
            return;
        }

        boolean hasDefault = outgoing.stream()
                .anyMatch(connection -> "default".equalsIgnoreCase(normalizeCondition(connection.getCondition())));

        if (!hasDefault) {
            errors.add("SWITCH block should have a 'default' outgoing branch: " + block.getId());
        }

        long blankConditions = outgoing.stream()
                .filter(connection -> normalizeCondition(connection.getCondition()).isBlank())
                .count();

        if (blankConditions > 0) {
            errors.add("SWITCH block must not have blank conditions on outgoing connections: " + block.getId());
        }
    }

    private void validateMergeBlock(
            WorkflowBlockEntity block,
            Map<UUID, List<WorkflowConnectionEntity>> incomingConnections,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        int incomingCount = incomingConnections.getOrDefault(block.getId(), List.of()).size();
        int outgoingCount = outgoingConnections.getOrDefault(block.getId(), List.of()).size();

        if (incomingCount < 2) {
            errors.add("MERGE block must have at least 2 incoming connections: " + block.getId());
        }

        if (outgoingCount != 1) {
            errors.add("MERGE block must have exactly 1 outgoing connection: " + block.getId());
        }
    }

    private void validateSingleOutgoingBlock(
            WorkflowBlockEntity block,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        if (block.getType() == BlockType.END) {
            return;
        }

        int outgoingCount = outgoingConnections.getOrDefault(block.getId(), List.of()).size();

        if (requiresSingleOutgoing(block.getType()) && outgoingCount > 1) {
            errors.add("Block must have no more than one outgoing connection: " + block.getId());
        }
    }

    private void validateReachabilityAndCycles(
            List<WorkflowBlockEntity> blocks,
            Map<UUID, WorkflowBlockEntity> blocksById,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            List<String> errors
    ) {
        List<WorkflowBlockEntity> startBlocks = blocks.stream()
                .filter(block -> block.getType() == BlockType.START)
                .toList();

        if (startBlocks.size() != 1) {
            return;
        }

        Set<UUID> visiting = new HashSet<>();
        Set<UUID> visited = new HashSet<>();

        boolean endReachable = dfs(
                startBlocks.get(0),
                blocksById,
                outgoingConnections,
                visiting,
                visited,
                errors
        );

        if (!endReachable) {
            errors.add("END block is not reachable from START");
        }

        if (visited.size() != blocks.size()) {
            errors.add("Workflow contains unreachable blocks");
        }
    }

    private boolean dfs(
            WorkflowBlockEntity currentBlock,
            Map<UUID, WorkflowBlockEntity> blocksById,
            Map<UUID, List<WorkflowConnectionEntity>> outgoingConnections,
            Set<UUID> visiting,
            Set<UUID> visited,
            List<String> errors
    ) {
        UUID currentBlockId = currentBlock.getId();

        if (visiting.contains(currentBlockId)) {
            errors.add("Cycle detected near block: " + currentBlockId);
            return false;
        }

        if (visited.contains(currentBlockId)) {
            return currentBlock.getType() == BlockType.END;
        }

        visiting.add(currentBlockId);

        boolean endReachable = currentBlock.getType() == BlockType.END;

        for (WorkflowConnectionEntity connection : outgoingConnections.getOrDefault(currentBlockId, List.of())) {
            WorkflowBlockEntity nextBlock = blocksById.get(connection.getToBlock().getId());

            if (nextBlock == null) {
                errors.add("Connection points to missing block: " + connection.getToBlock().getId());
                continue;
            }

            if (dfs(nextBlock, blocksById, outgoingConnections, visiting, visited, errors)) {
                endReachable = true;
            }
        }

        visiting.remove(currentBlockId);
        visited.add(currentBlockId);

        return endReachable;
    }

    private String normalizeCondition(String condition) {
        if (condition == null) {
            return "";
        }
        return condition.trim().toLowerCase();
    }

    private boolean requiresSingleOutgoing(BlockType blockType) {
        return switch (blockType) {
            case START, INPUT, SET_VARIABLE, MAP, FILTER, TRANSFORM_JSON,
                 HTTP_REQUEST, LLM_REQUEST, ML_REQUEST,
                 DATABASE_QUERY, EMAIL_SEND, LOG_MESSAGE,
                 DELAY, WAIT, WEBHOOK -> true;
            case IF, SWITCH, MERGE, END -> false;
        };
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
                .metadata(jsonUtils.toMap(workflow.getMetadata()))
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
