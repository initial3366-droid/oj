package com.qoj.module.problem.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.ProblemTestCaseRequest;
import com.qoj.module.problem.dto.TestCaseImportProgress;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.function.Consumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.web.multipart.MultipartFile;

/** Shared test-case ZIP limits, path checks and input/output pairing; no persistence. */
final class TestCaseZipReader {
    private static final int MAX_ZIP_TEST_CASES = 200;
    private static final int MAX_ZIP_ENTRIES = 650;
    private static final long MAX_TEST_CASE_UPLOAD_BYTES = 50L * 1024 * 1024;
    private static final long MAX_ZIP_ENTRY_BYTES = MAX_TEST_CASE_UPLOAD_BYTES;
    private static final long MAX_ZIP_TOTAL_BYTES = MAX_TEST_CASE_UPLOAD_BYTES;

    private TestCaseZipReader() {}

    static void validateUpload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BizException(400, "测试点 ZIP 不能为空");
        }
        if (file.getSize() > MAX_TEST_CASE_UPLOAD_BYTES) {
            throw new BizException(400, "测试点 ZIP 文件不能超过 50MB");
        }
    }

    static List<ProblemTestCaseRequest> read(MultipartFile file, boolean allowMissingOutput,
                                             Consumer<TestCaseImportProgress> progress, String emptyZipMessage) {
        Map<Integer, String> inputs = new HashMap<>();
        Map<Integer, String> outputs = new HashMap<>();
        Map<Integer, String> publicInputs = new HashMap<>();
        int[] counters = new int[] {0, 0};
        Map<Integer, Integer> ordinals = new HashMap<>();
        try (ZipInputStream zip = new ZipInputStream(file.getInputStream())) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entry.isDirectory()) {
                    continue;
                }
                if (++counters[0] > MAX_ZIP_ENTRIES) {
                    throw new BizException(400, "测试点 ZIP 文件数量过多");
                }
                String name = safeZipEntryName(entry.getName());
                Integer caseNo = caseNumber(name);
                if (caseNo == null) {
                    continue;
                }
                if (ordinals.size() >= MAX_ZIP_TEST_CASES && !ordinals.containsKey(caseNo)) {
                    throw new BizException(400, "测试点数量过多");
                }
                int ordinal = ordinals.computeIfAbsent(caseNo, ignored -> ordinals.size() + 1);
                progress.accept(new TestCaseImportProgress("reading", ordinal, null, caseNo));
                String content = readZipEntryText(zip, counters);
                Map<Integer, String> destination = name.endsWith(".public2.in") ? publicInputs
                    : name.endsWith(".in") ? inputs : outputs;
                if (destination.putIfAbsent(caseNo, content) != null) throw new BizException(400, "测试点文件重复：" + name);
            }
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException(400, "测试点 ZIP 解析失败");
        }
        if (!inputs.keySet().containsAll(publicInputs.keySet()) || !inputs.keySet().containsAll(outputs.keySet())) {
            throw new BizException(400, "ZIP 中存在缺少对应 .in 的测试点文件");
        }
        TreeSet<Integer> caseNos = new TreeSet<>(inputs.keySet());
        if (caseNos.isEmpty()) {
            throw new BizException(400, emptyZipMessage);
        }
        List<ProblemTestCaseRequest> result = new ArrayList<>();
        for (Integer caseNo : caseNos) {
            if (!outputs.containsKey(caseNo) && !allowMissingOutput) {
                throw new BizException(400, caseNo + ".out 缺失");
            }
            result.add(new ProblemTestCaseRequest(caseNo, inputs.get(caseNo), outputs.getOrDefault(caseNo, ""), publicInputs.getOrDefault(caseNo, "")));
        }
        progress.accept(new TestCaseImportProgress("parsed", result.size(), result.size(), 0));
        return result;
    }

    private static String safeZipEntryName(String rawName) {
        String name = rawName == null ? "" : rawName.replace('\\', '/');
        if (name.contains("../") || name.startsWith("/")) {
            throw new BizException(400, "测试点 ZIP 包含非法路径");
        }
        int slash = name.lastIndexOf('/');
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        return name;
    }

    private static String readZipEntryText(ZipInputStream zip, int[] counters) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int entryBytes = 0;
        int read;
        while ((read = zip.read(buffer)) != -1) {
            entryBytes += read;
            counters[1] += read;
            if (entryBytes > MAX_ZIP_ENTRY_BYTES) {
                throw new BizException(400, "单个测试点文件过大");
            }
            if (counters[1] > MAX_ZIP_TOTAL_BYTES) {
                throw new BizException(400, "测试点 ZIP 解压后过大");
            }
            out.write(buffer, 0, read);
        }
        return out.toString(StandardCharsets.UTF_8);
    }

    private static Integer caseNumber(String filename) {
        String number = filename.replaceFirst("\\.(public2\\.in|in|out|ans)$", "");
        if (number.equals(filename) || !number.matches("\\d+")) return null;
        try { return Integer.valueOf(number); }
        catch (NumberFormatException e) { throw new BizException(400, "测试点编号过大"); }
    }
}
