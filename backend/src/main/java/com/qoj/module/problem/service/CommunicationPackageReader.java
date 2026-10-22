package com.qoj.module.problem.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.CommunicationConfig;
import com.qoj.module.problem.dto.ProblemDraftBasicRequest;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import jakarta.validation.Validator;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/** A bounded in-memory package reader. No archive entry is extracted or executed here. */
@Component
public class CommunicationPackageReader {
    private static final int MAX_BYTES = 50 * 1024 * 1024;
    private final ObjectMapper json;
    private final Validator validator;

    public CommunicationPackageReader(ObjectMapper json, Validator validator) {
        this.json = json;
        this.validator = validator;
    }

    public record Package(ProblemDraftBasicRequest basic, List<ProblemTestCaseRequest> testCases) {}

    public Package read(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > MAX_BYTES) throw invalid("包大小必须为 1 至 50MB");
        try {
            Map<String, String> files = new LinkedHashMap<>();
            int total = 0, count = 0;
            try (var zip = new ZipInputStream(file.getInputStream())) {
                ZipEntry entry;
                while ((entry = zip.getNextEntry()) != null) {
                    if (++count > 650) throw invalid("文件数量超过上限");
                    String name = safePath(entry.getName());
                    if (entry.isDirectory()) continue;
                    if (files.containsKey(name)) throw invalid("存在重名文件");
                    byte[] bytes = zip.readNBytes(MAX_BYTES - total + 1);
                    total += bytes.length;
                    if (total > MAX_BYTES) throw invalid("解压后大小超过 50MB");
                    String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
                    files.put(name, text);
                }
            }
            if (!files.containsKey("problem.json")) throw invalid("缺少 problem.json");
            ObjectNode metadata = (ObjectNode) json.readTree(files.get("problem.json"));
            if (!"COMMUNICATION".equals(metadata.path("judgeMode").asText())) throw invalid("judgeMode 必须为 COMMUNICATION");
            ObjectNode communication = (ObjectNode) metadata.path("communication");
            for (var item : Map.of("execution", "TWO_PASS", "submissionMode", "PROGRAM", "messageFormat", "UTF8_TEXT").entrySet()) {
                if (communication.has(item.getKey()) && !item.getValue().equals(communication.path(item.getKey()).asText())) {
                    throw invalid("不支持的 " + item.getKey());
                }
                communication.remove(item.getKey());
            }
            communication.put("enabled", true);
            for (String key : List.of("channelSource", "checkerSource")) {
                String sourcePath = safePath(communication.path(key).asText());
                if (!files.containsKey(sourcePath)) throw invalid("缺少裁判源码文件：" + sourcePath);
                communication.put(key, files.get(sourcePath));
            }
            CommunicationConfig config = json.treeToValue(communication, CommunicationConfig.class).validated();
            metadata.remove("judgeMode");
            if (!metadata.has("timeLimit")) metadata.put("timeLimit", 1000);
            if (!metadata.has("memoryLimit")) metadata.put("memoryLimit", 256);
            // Import into a private, unpublished draft. Publishing remains an explicit existing action.
            metadata.put("accessScope", "PRIVATE");
            metadata.put("isPublic", false);
            metadata.put("studentPublishStatus", "DRAFT");
            metadata.set("communication", json.valueToTree(config));
            ProblemDraftBasicRequest basic = json.treeToValue(metadata, ProblemDraftBasicRequest.class);
            var violations = validator.validate(basic);
            if (!violations.isEmpty()) throw invalid(violations.iterator().next().getMessage());
            List<ProblemTestCaseRequest> cases = new ArrayList<>();
            for (int i = 1; i <= 200; i++) {
                String stem = "data/" + i;
                if (!files.containsKey(stem + ".in")) continue;
                if (files.containsKey(stem + ".out") && files.containsKey(stem + ".ans")) throw invalid("同一测试点不能同时有 out 和 ans");
                cases.add(new ProblemTestCaseRequest(i, files.get(stem + ".in"),
                    files.getOrDefault(stem + ".ans", files.getOrDefault(stem + ".out", "")), files.getOrDefault(stem + ".public2.in", "")));
            }
            for (String name : files.keySet()) {
                if (!name.startsWith("data/")) continue;
                if (!name.matches("data/[1-9][0-9]{0,2}\\.(in|out|ans|public2\\.in)")) throw invalid("非法测试数据文件名");
                int number = Integer.parseInt(name.substring(5, name.indexOf('.')));
                if (number > 200 || !files.containsKey("data/" + number + ".in")) throw invalid("测试点编号超限或缺少输入");
            }
            if (cases.isEmpty()) throw invalid("至少需要一个测试点");
            return new Package(basic, List.copyOf(cases));
        } catch (BizException e) { throw e; }
        catch (Exception e) { throw invalid("ZIP、UTF-8 文本或元数据格式不合法"); }
    }

    private String safePath(String name) {
        if (name == null || name.isBlank() || name.startsWith("/") || name.contains("\\") || name.contains(":")
            || Arrays.stream(name.split("/", -1)).anyMatch(part -> part.equals("..") || part.equals("."))) {
            throw invalid("非法文件路径");
        }
        return name;
    }
    private BizException invalid(String message) { return new BizException(400, "通信题包：" + message); }
}
