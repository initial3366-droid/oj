package com.qoj.module.contest.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.module.problem.dto.ProblemSampleCaseRequest;
import java.io.ByteArrayInputStream;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

/** Reads bounded archives without extracting, fetching URLs, or executing package code. */
@Component
public class PolygonPackageReader {
    public static final int MAX_BYTES = 64 * 1024 * 1024;
    private final ObjectMapper json;

    public PolygonPackageReader(ObjectMapper json) { this.json = json; }

    public record Test(String input, String output, boolean sample, Integer points) {}
    public record Problem(String label, String title, String statement, String checkerSource,
                          int timeLimit, int memoryLimit, List<Test> tests,
                          List<ProblemSampleCaseRequest> samples) {}
    public record Package(String title, List<Problem> problems, List<String> warnings) {}

    public Package read(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getSize() > 50 * 1024 * 1024) throw invalid("ZIP 大小必须为 1 至 50MiB");
        Map<String, byte[]> files = new LinkedHashMap<>();
        try (var zip = new ZipInputStream(file.getInputStream())) {
            int total = 0, count = 0;
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (++count > 20_000) throw invalid("ZIP 文件数量超过 20000");
                String path = safePath(entry.getName());
                if (entry.isDirectory()) continue;
                if (files.containsKey(path)) throw invalid("ZIP 中有重名文件：" + path);
                byte[] bytes = zip.readNBytes(Math.min(16 * 1024 * 1024, MAX_BYTES - total) + 1);
                total += bytes.length;
                if (bytes.length > 16 * 1024 * 1024 || total > MAX_BYTES) throw invalid("ZIP 解压后超过限制（总量 64MiB、单文件 16MiB）");
                files.put(path, bytes);
            }
        } catch (BizException e) { throw e; }
        catch (Exception e) { throw invalid("无法读取 ZIP，请确认文件未损坏"); }
        List<String> manifests = files.keySet().stream().filter(p -> p.equals("contest.xml") || p.endsWith("/contest.xml")).toList();
        List<String> descriptors = files.keySet().stream().filter(p -> p.equals("problem.xml") || p.endsWith("/problem.xml")).toList();
        if (descriptors.isEmpty() || descriptors.size() > 100) throw invalid("需要 1 至 100 个 problem.xml 及对应的已生成测试");
        List<String> warnings = new ArrayList<>();
        List<Problem> problems = new ArrayList<>();
        String title;
        if (!manifests.isEmpty()) {
            if (manifests.size() != 1) throw invalid("包中只能包含一个 contest.xml");
            String manifest = manifests.get(0);
            Element contest = xml(files.get(manifest), "contest");
            title = name(contest, "Polygon 比赛");
            List<Element> refs = children(child(contest, "problems"), "problem");
            if (refs.isEmpty() || refs.size() > 100) throw invalid("contest.xml 需要 1 至 100 道题目");
            var used = new HashSet<String>();
            var labels = new HashSet<String>();
            for (Element ref : refs) {
                String label = label(ref.getAttribute("index"));
                if (!labels.add(label)) throw invalid("重复题号：" + label);
                String url = ref.getAttribute("url").replaceAll("/+$", "");
                String shortName = url.substring(url.lastIndexOf('/') + 1);
                String base = directory(manifest);
                List<String> matches = descriptors.stream().filter(p -> p.startsWith(base)).filter(p ->
                    p.equals(base + "problems/" + shortName + "/problem.xml") ||
                    p.equals(base + "problems/" + label + "/problem.xml") ||
                    p.equals(base + shortName + "/problem.xml") ||
                    (!ref.getAttribute("path").isBlank() && p.equals(base + ref.getAttribute("path").replaceAll("/+$", "") + "/problem.xml"))
                ).toList();
                if (matches.size() != 1 || !used.add(matches.get(0))) throw invalid("无法唯一匹配题号 " + label + " 的本地 problem.xml；请提供包含题目目录的完整比赛包");
                problems.add(problem(files, matches.get(0), label, warnings));
            }
        } else {
            if (descriptors.size() != 1) throw invalid("多题 ZIP 缺少 contest.xml，无法确定题目顺序");
            problems.add(problem(files, descriptors.get(0), "A", warnings));
            title = problems.get(0).title();
        }
        return new Package(title, List.copyOf(problems), List.copyOf(warnings));
    }

    private Problem problem(Map<String, byte[]> files, String descriptor, String label, List<String> warnings) {
        String base = directory(descriptor);
        Element root = xml(files.get(descriptor), "problem");
        String title = name(root, label);
        if (title.length() > 200) throw invalid(label + "：题名超过 200 字符");
        String type = root.getAttribute("type");
        if (!type.isBlank() && !type.equals("standard")) throw invalid(label + "：暂不支持题目类型 " + type);
        Element assets = child(root, "assets");
        if (child(assets, "interactor") != null) throw invalid(label + "：暂不支持 Polygon 交互题");
        Element judging = child(root, "judging");
        if (judging == null) throw invalid(label + "：缺少 judging");
        if (!judging.getAttribute("input-file").isBlank() || !judging.getAttribute("output-file").isBlank()) throw invalid(label + "：暂不支持文件输入输出，请使用标准输入输出");
        Element tests = children(judging, "testset").stream().filter(t -> "tests".equals(t.getAttribute("name"))).findFirst().orElse(null);
        if (tests == null) throw invalid(label + "：缺少 tests 测试集");
        if (children(judging, "testset").size() > 1) warnings.add(label + "：仅导入正式 tests 测试集");
        if (child(tests, "groups") != null) throw invalid(label + "：暂不支持 Polygon 分组计分/依赖，请转换为独立测试点");
        int time = integer(text(tests, "time-limit"), 100, 60000, label + " 时间限制");
        long bytes;
        try { bytes = Long.parseLong(text(tests, "memory-limit")); }
        catch (Exception e) { throw invalid(label + "：内存限制无效"); }
        if (bytes % (1024 * 1024) != 0 || bytes < 16L * 1024 * 1024 || bytes > 1024L * 1024 * 1024) throw invalid(label + "：内存限制必须为 16 至 1024MiB 的整数");
        int count = integer(text(tests, "test-count"), 1, 5000, label + " 测试数量");
        List<Element> entries = children(child(tests, "tests"), "test");
        if (entries.size() != count) throw invalid(label + "：test-count 与 tests 数量不一致");
        var cases = new ArrayList<Test>();
        var samples = new ArrayList<ProblemSampleCaseRequest>();
        for (int i = 1; i <= count; i++) {
            Element entry = entries.get(i - 1);
            if (!entry.getAttribute("group").isBlank()) throw invalid(label + "：暂不支持带组别的测试点");
            Integer points = entry.getAttribute("points").isBlank() ? null : points(entry.getAttribute("points"), label);
            String input = utf8(required(files, base + pattern(text(tests, "input-path-pattern"), i)));
            String output = utf8(required(files, base + pattern(text(tests, "answer-path-pattern"), i)));
            boolean sample = "true".equalsIgnoreCase(entry.getAttribute("sample"));
            cases.add(new Test(input, output, sample, points));
            if (sample) samples.add(new ProblemSampleCaseRequest(input, output, ""));
        }
        if (files.containsKey(base + "qoj-samples.json")) {
            try { samples = new ArrayList<>(json.readValue(files.get(base + "qoj-samples.json"), new TypeReference<List<ProblemSampleCaseRequest>>() {})); }
            catch (Exception e) { throw invalid(label + "：qoj-samples.json 无效"); }
            if (samples.size() > 100 || samples.stream().anyMatch(s -> s == null || s.input() == null || s.output() == null)) throw invalid(label + "：样例无效或超过 100 个");
        }
        boolean hasPoints = cases.stream().anyMatch(t -> t.points() != null);
        if (hasPoints && cases.stream().anyMatch(t -> t.points() == null)) throw invalid(label + "：测试点分数必须全部指定或全部省略");
        if (samples.size() > 100) throw invalid(label + "：样例超过 100 个");
        String checker = null;
        Element checkerElement = child(assets, "checker");
        if (checkerElement != null) {
            Element source = child(checkerElement, "source");
            if (source == null || !source.getAttribute("type").startsWith("cpp")) throw invalid(label + "：checker 需要 C++ 源码");
            if (!checkerElement.getAttribute("type").isBlank() && !"testlib".equals(checkerElement.getAttribute("type"))) throw invalid(label + "：仅支持 testlib checker");
            checker = utf8(required(files, base + safePath(source.getAttribute("path"))));
            if (checker.isBlank() || checker.length() > 200000) throw invalid(label + "：checker 源码为空或超过 200000 字符");
            var includes = Pattern.compile("#\\s*include\\s*\"([^\"]+)\"").matcher(checker);
            while (includes.find()) if (!"testlib.h".equals(includes.group(1))) throw invalid(label + "：checker 引用了不支持的头文件 " + includes.group(1));
        } else {
            warnings.add(label + "：无 checker，使用 QOJ 默认的空白分隔 token 比较");
        }
        String statement = statement(files, base, root, label, warnings);
        if (statement.length() > 4 * 1024 * 1024) throw invalid(label + "：内嵌后的题面超过 4MiB");
        return new Problem(label, title, statement, checker, time, (int) (bytes / (1024 * 1024)), List.copyOf(cases), List.copyOf(samples));
    }

    private String statement(Map<String, byte[]> files, String base, Element root, String label, List<String> warnings) {
        List<Element> statements = new ArrayList<>(children(child(root, "statements"), "statement"));
        statements.sort(java.util.Comparator.comparingInt(s -> "chinese".equals(s.getAttribute("language")) ? 0 : "english".equals(s.getAttribute("language")) ? 1 : 2));
        for (Element item : statements) {
            if (!item.getAttribute("type").contains("html")) continue;
            String path = base + safePath(item.getAttribute("path"));
            if (!files.containsKey(path)) continue;
            String html = utf8(files.get(path));
            var body = Pattern.compile("(?is)<body[^>]*>(.*?)</body>").matcher(html);
            if (body.find()) html = body.group(1);
            var images = Pattern.compile("(?i)(<img\\b[^>]*?\\bsrc\\s*=\\s*)([\"'])([^\"']+)\\2").matcher(html);
            StringBuilder embedded = new StringBuilder();
            while (images.find()) {
                String src = images.group(3);
                if (src.startsWith("data:")) continue;
                if (src.matches("(?i)https?://.*") || src.startsWith("//")) {
                    String warning = label + "：题面含外部图片链接，保留原 URL，不下载远程资源";
                    if (!warnings.contains(warning)) warnings.add(warning);
                    continue;
                }
                String resolved;
                try { resolved = Path.of(directory(path)).resolve(src).normalize().toString().replace('\\', '/'); }
                catch (java.nio.file.InvalidPathException e) { throw invalid(label + "：图片路径无效"); }
                if (!resolved.startsWith(base)) throw invalid(label + "：图片路径越过题目目录");
                String ext = src.substring(src.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
                if (!List.of("png", "jpg", "jpeg", "gif", "webp").contains(ext)) throw invalid(label + "：仅支持 PNG/JPEG/GIF/WebP 本地图片");
                String mime = "image/" + (List.of("jpg", "jpeg").contains(ext) ? "jpeg" : ext);
                String data = "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(required(files, resolved));
                images.appendReplacement(embedded, java.util.regex.Matcher.quoteReplacement(images.group(1) + images.group(2) + data + images.group(2)));
            }
            images.appendTail(embedded);
            return embedded.toString();
        }
        List<String> legends = files.keySet().stream().filter(p -> p.startsWith(base + "statements/") && p.endsWith("/legend.tex")).sorted().toList();
        if (!legends.isEmpty()) {
            String folder = directory(legends.stream().filter(p -> p.contains("/english/")).findFirst().orElse(legends.get(0)));
            StringBuilder text = new StringBuilder();
            for (String section : List.of("legend", "input", "output", "notes")) {
                if (files.containsKey(folder + section + ".tex")) text.append("<h3>").append(section).append("</h3><pre>").append(escape(utf8(files.get(folder + section + ".tex")))).append("</pre>");
            }
            warnings.add(label + "：仅找到 LaTeX 题面，按原文保留；导入后可在编辑器排版");
            return text.toString();
        }
        throw invalid(label + "：缺少可读取的 HTML 题面或 legend.tex；请在 Polygon 渲染 HTML 后重新打包");
    }

    private static Element xml(byte[] bytes, String expectedRoot) {
        try {
            if (bytes.length > 2 * 1024 * 1024) throw invalid("XML 超过 2MiB");
            var factory = DocumentBuilderFactory.newInstance();
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            var builder = factory.newDocumentBuilder();
            builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
                @Override public void fatalError(org.xml.sax.SAXParseException e) throws org.xml.sax.SAXException { throw e; }
            });
            Element root = builder.parse(new ByteArrayInputStream(bytes)).getDocumentElement();
            if (!expectedRoot.equals(root.getTagName())) throw invalid("XML 根元素必须为 " + expectedRoot);
            return root;
        } catch (BizException e) { throw e; }
        catch (Exception e) { throw invalid("XML 格式无效，禁止 DTD/外部实体"); }
    }

    public static List<Element> children(Element parent, String name) {
        List<Element> result = new ArrayList<>();
        if (parent != null) for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) if (n instanceof Element e && name.equals(e.getTagName())) result.add(e);
        return result;
    }
    private static Element child(Element parent, String name) { return children(parent, name).stream().findFirst().orElse(null); }
    private static String text(Element parent, String name) { Element e = child(parent, name); return e == null ? "" : e.getTextContent().trim(); }
    private static String name(Element root, String fallback) {
        var names = children(child(root, "names"), "name");
        return names.stream().sorted(java.util.Comparator.comparingInt(n -> "chinese".equals(n.getAttribute("language")) ? 0 : "english".equals(n.getAttribute("language")) ? 1 : 2)).map(n -> n.getAttribute("value")).filter(s -> !s.isBlank()).findFirst().orElse(fallback);
    }
    private static String directory(String file) { return file.substring(0, file.lastIndexOf('/') + 1); }
    public static String label(String label) { if (!label.matches("[A-Za-z0-9_-]{1,16}")) throw invalid("题号必须为 1 至 16 位字母、数字、下划线或连字符"); return label; }
    private static String safePath(String path) {
        if (path.isBlank() || path.startsWith("/") || path.contains("\\") || path.contains(":") || path.indexOf('\0') >= 0 || java.util.Arrays.asList(path.split("/")).contains("..") || java.util.Arrays.asList(path.split("/")).contains(".")) throw invalid("ZIP 包含非法路径");
        return path;
    }
    private static String pattern(String pattern, int i) {
        if (!pattern.matches("[^%]*%0?[1-6]?d[^%]*")) throw invalid("测试路径仅支持单个 %d 或 %0Nd 占位符");
        return safePath(String.format(Locale.ROOT, pattern, i));
    }
    private static byte[] required(Map<String, byte[]> files, String path) { if (!files.containsKey(path)) throw invalid("缺少文件 " + path + "；请下载包含已生成测试和答案的完整 Linux/Windows 包"); return files.get(path); }
    private static String utf8(byte[] bytes) {
        try { return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString(); }
        catch (Exception e) { throw invalid("题面、源码和测试数据必须为 UTF-8 文本"); }
    }
    private static int integer(String value, int min, int max, String name) {
        try { int n = Integer.parseInt(value); if (n >= min && n <= max) return n; } catch (NumberFormatException ignored) { }
        throw invalid(name + " 必须为 " + min + " 至 " + max + " 的整数");
    }
    private static int points(String value, String label) {
        try {
            int n = new java.math.BigDecimal(value).intValueExact();
            if (n >= 0 && n <= 100000) return n;
        } catch (NumberFormatException | ArithmeticException ignored) { }
        throw invalid(label + "：测试分数必须为 0 至 100000 的整数");
    }
    public static String escape(String value) { return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;"); }
    public static BizException invalid(String message) { return new BizException(400, "Polygon：" + message); }
}
