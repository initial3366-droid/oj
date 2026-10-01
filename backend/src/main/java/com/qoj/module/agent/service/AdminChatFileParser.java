package com.qoj.module.agent.service;

import com.qoj.common.exception.BizException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.Writer;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Component;

/** Extracts uploaded data in memory. It never executes files or writes archive paths to disk. */
@Component
public class AdminChatFileParser {
    public static final long MAX_BYTES = 50L * 1024 * 1024;
    private static final int MAX_ENTRIES = 500;
    private static final int MAX_DOCUMENT_CHARS = 60000;
    private static final Set<String> TEXT_TYPES = Set.of("txt", "md", "markdown", "html", "htm", "json", "csv", "xml", "yaml", "yml", "log", "tex", "in", "out", "ans", "cpp", "cc", "c", "h", "hpp", "java", "py", "go", "js", "ts", "sql");

    public Bundle parse(String name, byte[] bytes) {
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new BizException(400, "文件不能为空，且不能超过 50 MB");
        String extension = extension(name);
        if (!TEXT_TYPES.contains(extension) && !Set.of("zip", "pdf", "docx", "xlsx", "xls").contains(extension)) {
            throw new BizException(400, "支持 ZIP、PDF、DOCX、Excel、JSON、Markdown 和文本文件；RAR/7z 请先转成 ZIP");
        }
        var entries = new ArrayList<Entry>();
        var warnings = new ArrayList<String>();
        var budget = new Budget();
        if (extension.equals("zip")) unpack(bytes, "", 0, budget, entries, warnings);
        else {
            budget.bytes = bytes.length;
            entries.add(extract(safePath(name), bytes, warnings));
        }
        if (entries.isEmpty()) throw new BizException(400, "压缩包没有可读取的文件");
        return new Bundle(List.copyOf(entries), List.copyOf(warnings));
    }

    private void unpack(byte[] bytes, String prefix, int depth, Budget budget, List<Entry> entries, List<String> warnings) {
        if (depth > 3) throw new BizException(400, "ZIP 嵌套超过 3 层，请先整理压缩包");
        if (bytes.length < 4 || bytes[0] != 'P' || bytes[1] != 'K') throw new BizException(400, "ZIP 文件已损坏或格式不正确");
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            java.util.zip.ZipEntry item;
            while ((item = zip.getNextEntry()) != null) {
                String path = prefix + safePath(item.getName());
                if (item.isDirectory()) continue;
                if (++budget.count > MAX_ENTRIES) throw new BizException(400, "压缩包最多包含 500 个文件");
                if (!budget.paths.add(path.toLowerCase(Locale.ROOT))) throw new BizException(400, "压缩包包含重复路径：" + path);
                if (item.getSize() > MAX_BYTES - budget.bytes) throw new BizException(400, "压缩包解压后不能超过 50 MB");
                var output = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int size;
                while ((size = zip.read(buffer)) != -1) {
                    budget.bytes += size;
                    if (budget.bytes > MAX_BYTES) throw new BizException(400, "压缩包解压后不能超过 50 MB");
                    output.write(buffer, 0, size);
                }
                byte[] data = output.toByteArray();
                if (extension(path).equals("zip")) unpack(data, path.substring(0, path.length() - 4) + "/", depth + 1, budget, entries, warnings);
                else entries.add(extract(path, data, warnings));
            }
        } catch (BizException e) { throw e; }
        catch (Exception e) { throw new BizException(400, "ZIP 无法解压，请检查文件是否损坏、加密或使用了不支持的编码"); }
    }

    private Entry extract(String path, byte[] bytes, List<String> warnings) {
        String extension = extension(path);
        try {
            if (TEXT_TYPES.contains(extension)) {
                Decoded decoded = decode(bytes);
                if (!decoded.encoding().equals("UTF-8")) warnings.add(path + " 使用 " + decoded.encoding() + "，导入时转换为 UTF-8 文本");
                // Any text extension can be classified as test data by the Agent. Bound previews and
                // model reads at their callers, while retaining every character for the eventual import.
                return new Entry(path, bytes.length, decoded.text(), decoded.encoding(), "text");
            }
            if (extension.equals("pdf")) {
                try (var pdf = Loader.loadPDF(bytes)) {
                    if (!pdf.getCurrentAccessPermission().canExtractContent()) throw new IOException("PDF does not permit extraction");
                    var stripper = new PDFTextStripper();
                    stripper.setSortByPosition(true);
                    stripper.setEndPage(100);
                    if (pdf.getNumberOfPages() > 100) warnings.add(path + " 仅解析前 100 页，原文件保留");
                    var output = new LimitedWriter();
                    stripper.writeText(pdf, output);
                    String text = output.text();
                    if (output.truncated) warnings.add(path + " 文本预览已截断，原文件保留");
                    if (text.isBlank()) warnings.add(path + " 未提取到文字，可能是扫描件；请上传可复制文字的版本或图片");
                    return new Entry(path, bytes.length, text, "PDF", "document");
                }
            }
            if (Set.of("docx", "xlsx").contains(extension)) validateOfficeArchive(bytes);
            if (extension.equals("docx")) {
                try (var document = new XWPFDocument(new ByteArrayInputStream(bytes)); var extractor = new XWPFWordExtractor(document)) {
                    if (!document.getAllPictures().isEmpty()) warnings.add(path + " 包含内嵌图片，请在导入前补充题面图片");
                    return new Entry(path, bytes.length, bounded(extractor.getText(), path, warnings), "DOCX", "document");
                }
            }
            if (Set.of("xlsx", "xls").contains(extension)) {
                try (var workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                    var result = new StringBuilder();
                    var formatter = new DataFormatter();
                    int cells = 0;
                    outer: for (var sheet : workbook) {
                        result.append("\n工作表：").append(sheet.getSheetName()).append('\n');
                        for (var row : sheet) {
                            for (var cell : row) {
                                if (++cells > 20000 || result.length() > MAX_DOCUMENT_CHARS) { warnings.add(path + " 表格预览已截断，原文件保留"); break outer; }
                                result.append(formatter.formatCellValue(cell)).append('\t');
                            }
                            result.append('\n');
                        }
                    }
                    return new Entry(path, bytes.length, bounded(result.toString(), path, warnings), "Excel", "document");
                }
            }
            warnings.add(path + " 的格式暂不解析，原文件保留");
            return new Entry(path, bytes.length, "", "binary", "unsupported");
        } catch (Exception e) {
            if (e instanceof BizException biz) throw biz;
            warnings.add(path + " 无法解析，请检查文件是否加密、损坏或为二进制数据");
            return new Entry(path, bytes.length, "", "unknown", "unreadable");
        }
    }

    private void validateOfficeArchive(byte[] bytes) throws IOException {
        long total = 0;
        int count = 0;
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            java.util.zip.ZipEntry item;
            byte[] buffer = new byte[8192];
            while ((item = zip.getNextEntry()) != null) {
                safePath(item.getName());
                if (++count > MAX_ENTRIES) throw new BizException(400, "Office 文档内部文件数量超过 500");
                int size;
                while ((size = zip.read(buffer)) != -1) {
                    total += size;
                    if (total > MAX_BYTES) throw new BizException(400, "Office 文档解压后不能超过 50 MB");
                }
            }
        }
    }

    private String bounded(String text, String path, List<String> warnings) {
        if (text.length() <= MAX_DOCUMENT_CHARS) return text;
        warnings.add(path + " 文本预览已截断，原文件保留");
        return text.substring(0, MAX_DOCUMENT_CHARS);
    }

    private Decoded decode(byte[] bytes) throws CharacterCodingException {
        if (bytes.length >= 2 && bytes[0] == (byte) 0xff && bytes[1] == (byte) 0xfe) return new Decoded(new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16LE), "UTF-16LE");
        if (bytes.length >= 2 && bytes[0] == (byte) 0xfe && bytes[1] == (byte) 0xff) return new Decoded(new String(bytes, 2, bytes.length - 2, StandardCharsets.UTF_16BE), "UTF-16BE");
        if (bytes.length >= 3 && bytes[0] == (byte) 0xef && bytes[1] == (byte) 0xbb && bytes[2] == (byte) 0xbf) return new Decoded(new String(bytes, 3, bytes.length - 3, StandardCharsets.UTF_8), "UTF-8");
        for (String encoding : List.of("UTF-8", "GB18030")) {
            try {
                String text = Charset.forName(encoding).newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
                if (text.indexOf('\0') >= 0) throw new CharacterCodingException();
                return new Decoded(text, encoding);
            } catch (CharacterCodingException e) { if (encoding.equals("GB18030")) throw e; }
        }
        throw new CharacterCodingException();
    }

    private String safePath(String raw) {
        String path = raw.replace('\\', '/');
        if (path.startsWith("/") || path.matches("^[A-Za-z]:.*") || path.indexOf('\0') >= 0
            || java.util.Arrays.asList(path.split("/")).contains("..")) throw new BizException(400, "压缩包包含非法路径");
        while (path.startsWith("./")) path = path.substring(2);
        if (path.length() > 500 || path.isBlank()) throw new BizException(400, "文件路径过长或无效");
        return path;
    }

    public static String extension(String path) {
        int dot = path.lastIndexOf('.');
        return dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    public record Entry(String path, long size, String text, String encoding, String kind) {}
    public record Bundle(List<Entry> entries, List<String> warnings) {}
    private record Decoded(String text, String encoding) {}
    private static class Budget { long bytes; int count; Set<String> paths = new HashSet<>(); }
    private static class LimitedWriter extends Writer {
        final StringBuilder buffer = new StringBuilder();
        boolean truncated;
        @Override public void write(char[] chars, int offset, int length) {
            int accepted = Math.min(length, MAX_DOCUMENT_CHARS - buffer.length());
            if (accepted < length) truncated = true;
            buffer.append(chars, offset, accepted);
        }
        @Override public void flush() {}
        @Override public void close() {}
        String text() { return buffer.toString(); }
    }
}
