package com.qoj.module.judge.gojudge;

import com.qoj.common.enums.SubmissionStatus;
import com.qoj.config.QojProperties;
import com.qoj.module.judge.JudgeResult;
import com.qoj.module.judge.JudgeTask;
import com.qoj.module.judge.gojudge.GoJudgeClient.Command;
import com.qoj.module.judge.gojudge.GoJudgeClient.Result;
import com.qoj.module.judge.gojudge.GoJudgeClient.RunRequest;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** Security and result-contract tests for the go-judge adapter. */
@ExtendWith(MockitoExtension.class)
class GoJudgeServiceTest {
    private static final String FILE_ID = "compiled_file-1";

    @Mock private GoJudgeClient client;

    private GoJudgeService service;

    /**
     * 封装setUp相关逻辑。可能调用外部判题或网关服务。
     */
    @BeforeEach
    void setUp() {
        QojProperties properties = new QojProperties();
        service = new GoJudgeService(client, properties);
    }

    /**
     * 封装languageSupportUsesOnlyTheServerAllowlist相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    @Test
    void languageSupportUsesOnlyTheServerAllowlist() {
        assertAll(
            () -> assertTrue(service.supportsLanguage("c")),
            () -> assertTrue(service.supportsLanguage("CPP")),
            () -> assertTrue(service.supportsLanguage("c++")),
            () -> assertTrue(service.supportsLanguage("cxx")),
            () -> assertTrue(service.supportsLanguage("g++")),
            () -> assertTrue(service.supportsLanguage("python")),
            () -> assertTrue(service.supportsLanguage("python3")),
            () -> assertTrue(service.supportsLanguage("py")),
            () -> assertTrue(service.supportsLanguage("java")),
            () -> assertTrue(service.supportsLanguage("c#")),
            () -> assertTrue(service.supportsLanguage("csharp")),
            () -> assertTrue(service.supportsLanguage("cs")),
            () -> assertFalse(service.supportsLanguage(null)),
            () -> assertFalse(service.supportsLanguage("")),
            () -> assertFalse(service.supportsLanguage("javascript")),
            () -> assertFalse(service.supportsLanguage("cpp; rm -rf /")),
            () -> assertFalse(service.supportsLanguage("../python3"))
        );
        verifyNoInteractions(client);
    }

    /**
     * 构造或转换sRunResults。执行持久化写入；可能调用外部判题或网关服务。
     */
    @ParameterizedTest(name = "go-judge {0} maps to {4}")
    @MethodSource("runResultMappings")
    void mapsRunResults(
        String goJudgeStatus,
        int exitStatus,
        String actualOutput,
        String expectedOutput,
        SubmissionStatus expectedStatus
    ) {
        when(client.run(any(RunRequest.class), any(Duration.class)))
            .thenReturn(List.of(compileSuccess("main")))
            .thenReturn(List.of(runResult(goJudgeStatus, exitStatus, actualOutput)));

        JudgeResult result = service.judge(task("cpp", "int main() { return 0; }", expectedOutput));

        assertEquals(expectedStatus, result.status());
        assertEquals(expectedStatus, result.caseResults().get(0).status());
        assertEquals(2, result.maxTimeMs());
        assertEquals(3, result.maxMemoryKb());
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(client).deleteFile(FILE_ID);
    }

    private static Stream<Arguments> runResultMappings() {
        return Stream.of(
            Arguments.of("Accepted", 0, "42\n", "42\n", SubmissionStatus.AC),
            Arguments.of("Accepted", 0, "41\n", "42\n", SubmissionStatus.WA),
            Arguments.of("Time Limit Exceeded", 0, "", "42\n", SubmissionStatus.TLE),
            Arguments.of("Memory Limit Exceeded", 0, "", "42\n", SubmissionStatus.MLE),
            Arguments.of("Output Limit Exceeded", 0, "too much output", "42\n", SubmissionStatus.RE)
        );
    }

    @Test
    void mapsCompilerFailureToCompileErrorWithoutDeletingAnUnknownArtifact() {
        Result compilerFailure = new Result(
            "Nonzero Exit Status",
            1,
            null,
            0,
            0,
            0,
            Map.of("stdout", "", "stderr", "syntax error"),
            Map.of()
        );
        when(client.run(any(RunRequest.class), any(Duration.class)))
            .thenReturn(List.of(compilerFailure));

        JudgeResult result = service.judge(task("cpp", "not valid C++", ""));

        assertEquals(SubmissionStatus.CE, result.status());
        assertEquals("syntax error", result.compileOutput());
        assertTrue(result.caseResults().isEmpty());
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(client, never()).deleteFile(any());
    }

    @Test
    void deletesCachedArtifactWhenExecutionFails() {
        when(client.run(any(RunRequest.class), any(Duration.class)))
            .thenReturn(List.of(compileSuccess("main")))
            .thenThrow(new GoJudgeClient.GoJudgeClientException("connection lost"));

        JudgeResult result = service.judge(task("cpp", "int main() { return 0; }", ""));

        assertEquals(SubmissionStatus.SE, result.status());
        /**
         * 校验前置条件。执行持久化写入。
         */
        verify(client).deleteFile(FILE_ID);
    }

    @Test
    void commandArgumentsAreFixedAndNeverContainUserSource() {
        String source = "int main() { /* ; curl attacker.invalid */ return 0; }";
        String input = "untrusted stdin; rm -rf /\n";
        when(client.run(any(RunRequest.class), any(Duration.class)))
            .thenReturn(List.of(compileSuccess("main")))
            .thenReturn(List.of(runResult("Accepted", 0, "ok\n")));

        service.judge(new JudgeTask(
            9L,
            "cpp",
            source,
            1000,
            64,
            List.of(new JudgeTask.TestCase(1, input, "ok\n"))
        ));

        ArgumentCaptor<RunRequest> requestCaptor = ArgumentCaptor.forClass(RunRequest.class);
        verify(client, times(2)).run(requestCaptor.capture(), any(Duration.class));
        Command compileCommand = requestCaptor.getAllValues().get(0).cmd().get(0);
        Command runCommand = requestCaptor.getAllValues().get(1).cmd().get(0);

        assertEquals(
            List.of("/usr/bin/g++", "-std=c++17", "-O2", "-pipe", "main.cpp", "-o", "main"),
            compileCommand.args()
        );
        assertEquals(List.of("./main"), runCommand.args());
        assertEquals(List.of("main.cpp"), List.copyOf(compileCommand.copyIn().keySet()));
        assertEquals(source, compileCommand.copyIn().get("main.cpp").content());
        assertNull(compileCommand.copyIn().get("main.cpp").fileId());
        assertEquals(FILE_ID, runCommand.copyIn().get("main").fileId());
        assertEquals(input, runCommand.files().get(0).content());
        assertTrue(compileCommand.args().stream().noneMatch(argument -> argument.contains("curl")));
        assertTrue(runCommand.args().stream().noneMatch(argument -> argument.contains("rm -rf")));
    }

    @Test
    void javaCompilationUsesOnlyTheImageOwnedWrapper() {
        when(client.run(any(RunRequest.class), any(Duration.class)))
            .thenReturn(List.of(compileSuccess("main.jar")))
            .thenReturn(List.of(runResult("Accepted", 0, "ok\n")));

        service.judge(task("java", "public class Main { public static void main(String[] a) {} }", "ok\n"));

        ArgumentCaptor<RunRequest> requestCaptor = ArgumentCaptor.forClass(RunRequest.class);
        verify(client, times(2)).run(requestCaptor.capture(), any(Duration.class));
        assertEquals(
            List.of("/usr/local/bin/qoj-java-compile"),
            requestCaptor.getAllValues().get(0).cmd().get(0).args()
        );
    }

    @Test
    void csharpCompilationAndExecutionUseFixedMonoCommands() {
        String source = "using System; class Program { static void Main() { Console.WriteLine(42); } }";
        when(client.run(any(RunRequest.class), any(Duration.class)))
            .thenReturn(List.of(compileSuccess("main.exe")))
            .thenReturn(List.of(runResult("Accepted", 0, "42\n")));

        service.judge(task("csharp", source, "42\n"));

        ArgumentCaptor<RunRequest> requestCaptor = ArgumentCaptor.forClass(RunRequest.class);
        verify(client, times(2)).run(requestCaptor.capture(), any(Duration.class));
        Command compileCommand = requestCaptor.getAllValues().get(0).cmd().get(0);
        Command runCommand = requestCaptor.getAllValues().get(1).cmd().get(0);
        assertEquals(
            List.of("/usr/bin/mcs", "-optimize+", "-out:main.exe", "Main.cs"),
            compileCommand.args()
        );
        assertEquals(
            List.of("/usr/bin/mono", "/usr/bin/qoj-csharp-launcher.exe", "main.exe"),
            runCommand.args()
        );
        assertEquals(List.of("Main.cs"), List.copyOf(compileCommand.copyIn().keySet()));
        assertEquals(source, compileCommand.copyIn().get("Main.cs").content());
        assertEquals(FILE_ID, runCommand.copyIn().get("main.exe").fileId());
    }

    private JudgeTask task(String language, String code, String expectedOutput) {
        /**
         * 封装判题Task相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new JudgeTask(
            1L,
            language,
            code,
            1000,
            64,
            List.of(new JudgeTask.TestCase(1, "", expectedOutput))
        );
    }

    private static Result compileSuccess(String artifactName) {
        /**
         * 封装结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new Result(
            "Accepted",
            0,
            null,
            0,
            0,
            0,
            Map.of("stdout", "", "stderr", ""),
            Map.of(artifactName, FILE_ID)
        );
    }

    private static Result runResult(String status, int exitStatus, String stdout) {
        /**
         * 封装结果相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new Result(
            status,
            exitStatus,
            null,
            1_500_001,
            2_049,
            0,
            Map.of("stdout", stdout, "stderr", ""),
            Map.of()
        );
    }
}
