package com.qoj.module.agent.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.qoj.common.exception.BizException;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.lang.reflect.Proxy;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.servlet.DispatcherServlet;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter;

/** In-process MVC exchange. No network, credentials, caller-provided headers or arbitrary target URLs. */
final class AdminAgentMvcExchange {
    private final HttpServletRequest request;
    private final HttpServletResponse response;
    private final ByteArrayOutputStream output = new ByteArrayOutputStream();
    private final HttpHeaders responseHeaders = new HttpHeaders();
    private int status = 200;
    private String encoding = "UTF-8";
    private PrintWriter writer;
    private static final int MAX_RESPONSE_BYTES = 50 * 1024 * 1024;

    AdminAgentMvcExchange(WebApplicationContext context, String method, String uri, Map<String, String> path,
        JsonNode query, byte[] body, Map<String, MultipartFile> files) {
        var attributes = new HashMap<String, Object>();
        attributes.put(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE, path);
        attributes.put(DispatcherServlet.WEB_APPLICATION_CONTEXT_ATTRIBUTE, context);
        var parameters = new LinkedHashMap<String, String[]>();
        query.fields().forEachRemaining(e -> {
            JsonNode value = e.getValue();
            if (value.isNull()) {
                return;
            }
            if (!value.isValueNode() && !value.isArray()) {
                throw new BizException(400, "查询参数仅支持标量或列表");
            }
            var values = new ArrayList<String>();
            if (value.isArray()) {
                value.forEach(item -> {
                    if (!item.isValueNode()) {
                        throw new BizException(400, "查询参数列表仅支持标量");
                    }
                    values.add(item.asText());
                });
            } else {
                values.add(value.asText());
            }
            if (values.size() > 1000) {
                throw new BizException(400, "查询参数列表过长");
            }
            parameters.put(e.getKey(), values.toArray(String[]::new));
        });
        var requestHeaders = new HttpHeaders();
        requestHeaders.set("Accept", "*/*");
        String contentType = files.isEmpty() ? (body.length == 0 ? null : "application/json") : "multipart/form-data";
        if (contentType != null) {
            requestHeaders.set("Content-Type", contentType);
        }
        if (body.length > 0) {
            requestHeaders.setContentLength(body.length);
        }
        var input = new ByteArrayInputStream(body);
        ServletInputStream inputStream = new ServletInputStream() {
            public int read() {
                return input.read();
            }

            public boolean isFinished() {
                return input.available() == 0;
            }

            public boolean isReady() {
                return true;
            }

            public void setReadListener(ReadListener listener) {
                throw new UnsupportedOperationException();
            }
        };
        var multiFiles = new LinkedMultiValueMap<String, MultipartFile>();
        files.forEach(multiFiles::add);
        request = (HttpServletRequest)Proxy.newProxyInstance(getClass().getClassLoader(),
            new Class<?>[] {files.isEmpty() ? HttpServletRequest.class : MultipartHttpServletRequest.class},
            (proxy, called, args) -> {
                String name = called.getName(), key = args != null && args.length > 0 ? String.valueOf(args[0]) : "";
                return switch (name) {
                    case "getMethod" -> method;
                    case "getRequestURI", "getServletPath" -> uri;
                    case "getRequestURL" -> new StringBuffer("http://localhost" + uri);
                    case "getContextPath" -> "";
                    case "getScheme" -> "http";
                    case "getServerName" -> "localhost";
                    case "getServerPort" -> 80;
                    case "getProtocol" -> "HTTP/1.1";
                    case "getRemoteAddr", "getLocalAddr" -> "127.0.0.1";
                    case "getCharacterEncoding" -> "UTF-8";
                    case "getContentType" -> contentType;
                    case "getContentLength" -> body.length;
                    case "getContentLengthLong" -> (long)body.length;
                    case "getInputStream" -> inputStream;
                    case "getReader" -> new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
                    case "getHeader" -> requestHeaders.getFirst(key);
                    case "getHeaders" -> Collections.enumeration(requestHeaders.getOrDefault(key, List.of()));
                    case "getHeaderNames" -> Collections.enumeration(requestHeaders.headerNames());
                    case "getDateHeader", "getIntHeader" -> name.equals("getDateHeader") ? -1L : -1;
                    case "getParameter" ->
                        parameters.containsKey(key) && parameters.get(key).length > 0 ? parameters.get(key)[0] : null;
                    case "getParameterValues" -> parameters.get(key);
                    case "getParameterMap" -> Collections.unmodifiableMap(parameters);
                    case "getParameterNames" -> Collections.enumeration(parameters.keySet());
                    case "getAttribute" -> attributes.get(key);
                    case "getAttributeNames" -> Collections.enumeration(attributes.keySet());
                    case "setAttribute" -> {
                        if (args[1] == null) {
                            attributes.remove(key);
                        } else {
                            attributes.put(key, args[1]);
                        }
                        yield null;
                    }
                    case "removeAttribute" -> {
                        attributes.remove(key);
                        yield null;
                    }
                    case "getLocale" -> Locale.SIMPLIFIED_CHINESE;
                    case "getLocales" -> Collections.enumeration(List.of(Locale.SIMPLIFIED_CHINESE));
                    case "getServletContext" -> context.getServletContext();
                    case "getUserPrincipal" -> SecurityContextHolder.getContext().getAuthentication();
                    case "getDispatcherType" -> DispatcherType.REQUEST;
                    case "getFile" -> files.get(key);
                    case "getFiles" -> multiFiles.getOrDefault(key, List.of());
                    case "getFileMap" -> files;
                    case "getMultiFileMap" -> multiFiles;
                    case "getFileNames" -> files.keySet().iterator();
                    case "getRequestHeaders" -> requestHeaders;
                    case "getRequestMethod" -> HttpMethod.valueOf(method);
                    case "getMultipartContentType" -> files.containsKey(key) ? files.get(key).getContentType() : null;
                    case "getMultipartHeaders" -> {
                        var headers = new HttpHeaders();
                        headers.set("Content-Type", files.get(key).getContentType());
                        yield headers;
                    }
                    case "toString" -> "AdminAgentRequest " + method + " " + uri;
                    default -> defaultValue(called.getReturnType());
                };
            });
        ServletOutputStream stream = new ServletOutputStream() {
            public void write(int value) {
                if (output.size() >= MAX_RESPONSE_BYTES) {
                    throw new BizException(400, "导出超过 50 MB，请缩小查询范围");
                }
                output.write(value);
            }

            public void write(byte[] bytes, int offset, int length) {
                if ((long)output.size() + length > MAX_RESPONSE_BYTES) {
                    throw new BizException(400, "导出超过 50 MB，请缩小查询范围");
                }
                output.write(bytes, offset, length);
            }

            public boolean isReady() {
                return true;
            }

            public void setWriteListener(WriteListener listener) {
                throw new UnsupportedOperationException();
            }
        };
        response = (HttpServletResponse)Proxy.newProxyInstance(getClass().getClassLoader(),
            new Class<?>[] {HttpServletResponse.class}, (proxy, called, args) -> {
                String name = called.getName(), key = args != null && args.length > 0 ? String.valueOf(args[0]) : "";
                return switch (name) {
                    case "setStatus", "sendError" -> {
                        status = (int)args[0];
                        yield null;
                    }
                    case "getStatus" -> status;
                    case "setHeader" -> {
                        responseHeaders.set(key, String.valueOf(args[1]));
                        yield null;
                    }
                    case "addHeader" -> {
                        responseHeaders.add(key, String.valueOf(args[1]));
                        yield null;
                    }
                    case "setContentType" -> {
                        responseHeaders.set("Content-Type", key);
                        yield null;
                    }
                    case "getContentType" -> responseHeaders.getFirst("Content-Type");
                    case "getHeader" -> responseHeaders.getFirst(key);
                    case "getHeaders" -> responseHeaders.getOrDefault(key, List.of());
                    case "getHeaderNames" -> responseHeaders.headerNames();
                    case "containsHeader" -> responseHeaders.containsHeader(key);
                    case "setCharacterEncoding" -> {
                        encoding = key;
                        yield null;
                    }
                    case "getCharacterEncoding" -> encoding;
                    case "getOutputStream" -> stream;
                    case "getWriter" -> {
                        if (writer == null) {
                            writer = new PrintWriter(new OutputStreamWriter(stream, encoding));
                        }
                        yield writer;
                    }
                    case "flushBuffer" -> {
                        if (writer != null) {
                            writer.flush();
                        }
                        yield null;
                    }
                    case "encodeURL", "encodeRedirectURL" -> key;
                    case "getLocale" -> Locale.SIMPLIFIED_CHINESE;
                    case "toString" -> "AdminAgentResponse";
                    default -> defaultValue(called.getReturnType());
                };
            });
    }

    void invoke(RequestMappingHandlerAdapter adapter, HandlerMethod handler) throws Exception {
        var previous = RequestContextHolder.getRequestAttributes();
        try {
            RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request, response));
            var resolved = handler.createWithResolvedBean();
            adapter.handle(request, response, resolved);
        } finally {
            if (previous == null) {
                RequestContextHolder.resetRequestAttributes();
            } else {
                RequestContextHolder.setRequestAttributes(previous);
            }
        }
    }

    byte[] bytes() {
        if (writer != null) {
            writer.flush();
        }
        return output.toByteArray();
    }

    int status() {
        return status;
    }

    String contentType() {
        return Optional.ofNullable(responseHeaders.getFirst("Content-Type")).orElse("");
    }

    String header(String name) {
        return responseHeaders.getFirst(name);
    }

    private static Object defaultValue(Class<?> type) {
        if (type == boolean.class) {
            return false;
        }
        if (type == int.class) {
            return 0;
        }
        if (type == long.class) {
            return 0L;
        }
        if (type == double.class) {
            return 0D;
        }
        return null;
    }

    record Upload(String name, String filename, byte[] data) implements MultipartFile {
        public String getName() {
            return name;
        }

        public String getOriginalFilename() {
            return filename;
        }

        public String getContentType() {
            String detected = URLConnection.guessContentTypeFromName(filename);
            return detected == null
                ? filename.toLowerCase(Locale.ROOT).endsWith(".zip") ? "application/zip" : "application/octet-stream"
                : detected;
        }

        public boolean isEmpty() {
            return data.length == 0;
        }

        public long getSize() {
            return data.length;
        }

        public byte[] getBytes() {
            return data;
        }

        public InputStream getInputStream() {
            return new ByteArrayInputStream(data);
        }

        public void transferTo(File dest) throws IOException {
            Files.write(dest.toPath(), data);
        }
    }
}
