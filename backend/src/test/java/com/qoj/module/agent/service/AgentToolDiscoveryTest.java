package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qoj.common.exception.BizException;
import com.qoj.module.user.entity.AdminUser;
import com.qoj.security.AuthUser;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.ai.tool.ToolCallback;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

class AgentToolDiscoveryTest {
    private final ObjectMapper json = new ObjectMapper();
    private AdminChatAgentService service;
    private Object workspace;

    @BeforeEach
    void prepare() throws Exception {
        var constructor = AdminChatAgentService.class.getConstructors()[0];
        Object[] dependencies = Arrays.stream(constructor.getParameterTypes())
            .map(type -> type == ObjectMapper.class ? json : mock(type)).toArray();
        service = (AdminChatAgentService) constructor.newInstance(dependencies);
        workspace = workspace();
        var admin = new AdminUser(); admin.id = 1L; admin.role = "SUPER_ADMIN";
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new AuthUser(admin), null));
    }

    @AfterEach
    void clearAuthentication() { SecurityContextHolder.clearContext(); }

    @Test
    void initialRequestHasSummaryAndOneDiscoveryToolThenLoadsCompleteSchemas() {
        List<ToolCallback> tools = tools(workspace);
        assertEquals(List.of("load_tools"), names(tools));
        String prompt = ReflectionTestUtils.invokeMethod(service, "prompt");
        for (String category : List.of("files", "qoj", "problems", "contests", "courses", "content",
                "submissions", "people", "site", "compute", "admin_api")) assertTrue(prompt.contains(category));
        tools.get(0).call("{\"category\":\"problems\"}");
        assertTrue(names(tools).containsAll(List.of("create_draft", "update_draft", "get_draft", "commit_draft", "edit_problem")));
        var create = tools.stream().filter(tool -> tool.getToolDefinition().name().equals("create_draft")).findFirst().orElseThrow();
        assertThrows(AgentToolSupport.InvalidArguments.class,
            () -> AgentToolSupport.validate(create.getToolDefinition().inputSchema(), "{\"basic\":{\"title\":\"x\"}}"));
        int size = tools.size(); tools.get(0).call("{\"category\":\"problems\"}");
        assertEquals(size, tools.size()); assertEquals(size, names(tools).stream().distinct().count());
    }

    @Test
    void invalidDiscoveryIsRejectedAndLoadingKeepsAuthenticationWithoutWriteApproval() {
        var loader = tools(workspace).get(0);
        for (String args : List.of("{}", "{\"category\":\"unknown\"}", "{\"category\":1}",
                "{\"category\":\"problems\",\"group\":\"unknown\"}"))
            assertThrows(BizException.class, () -> loader.call(args));
        assertFalse(AdminAgentApprovalPolicy.isWriteTool("load_tools", json.createObjectNode()));
        assertNull(AdminAgentApprovalPolicy.description("load_tools", "{\"category\":\"problems\"}"));
        assertNotNull(AdminAgentApprovalPolicy.description("create_draft", "{}"));
        SecurityContextHolder.clearContext();
        assertThrows(BizException.class, () -> loader.call("{\"category\":\"problems\"}"));
    }

    @Test
    void groupFilterAndCheckpointRestorePreserveExactlyLoadedTools() throws Exception {
        var tools = tools(workspace);
        tools.get(0).call("{\"category\":\"problems\",\"group\":\"draft\"}");
        assertTrue(names(tools).contains("create_draft")); assertFalse(names(tools).contains("edit_problem"));
        Object snapshot = ReflectionTestUtils.invokeMethod(workspace, "snapshot");
        var serialized = json.valueToTree(snapshot);
        ((ObjectNode) serialized).put("categoriesListed", true);
        ((ObjectNode) serialized).putArray("openedCategories").add("problems");
        Object restoredSnapshot = json.treeToValue(serialized, snapshot.getClass());
        var restored = workspace(); ReflectionTestUtils.invokeMethod(restored, "restore", restoredSnapshot);
        assertEquals(names(tools).stream().sorted().toList(), names(tools(restored)).stream().sorted().toList());
        tools(restored).get(0).call("{\"category\":\"problems\"}");
        assertTrue(names(tools(restored)).contains("edit_problem"));
    }

    private Object workspace() throws Exception {
        Class<?> type = Arrays.stream(AdminChatAgentService.class.getDeclaredClasses())
            .filter(candidate -> candidate.getSimpleName().equals("Workspace")).findFirst().orElseThrow();
        var constructor = type.getDeclaredConstructors()[0]; constructor.setAccessible(true);
        return constructor.newInstance(service, List.of(), null, "", false, "");
    }

    private List<ToolCallback> tools(Object target) { return ReflectionTestUtils.invokeMethod(target, "tools"); }
    private List<String> names(List<ToolCallback> tools) { return tools.stream().map(tool -> tool.getToolDefinition().name()).toList(); }
}
