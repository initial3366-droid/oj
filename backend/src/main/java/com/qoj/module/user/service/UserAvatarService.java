package com.qoj.module.user.service;

import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.vo.AvatarUploadVO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserAvatarService {
    private static final Set<String> SUPPORTED_CONTENT_TYPES = Set.of(
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/bmp"
    );
    private static final Map<String, String> EXTENSIONS = Map.of(
        "image/jpeg", "jpg",
        "image/png", "png",
        "image/gif", "gif",
        "image/webp", "webp",
        "image/bmp", "bmp"
    );
    private static final long MAX_PIXELS = 12_000_000L;

    private final UserMapper userMapper;
    private final SystemSettingService settingService;
    private final HttpClient httpClient;

    public UserAvatarService(UserMapper userMapper, SystemSettingService settingService) {
        this.userMapper = userMapper;
        this.settingService = settingService;
        this.httpClient = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Transactional
    public AvatarUploadVO updateUserAvatar(long userId, MultipartFile file) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        return updateUserAvatar(user, file);
    }

    @Transactional
    public AvatarUploadVO updateUserAvatar(User user, MultipartFile file) {
        OssSettingsVO config = settingService.getOssRuntimeSettings();
        validateOssEnabled(config);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BizException(ErrorCode.BAD_REQUEST, "读取头像文件失败");
        }
        String contentType = validateFile(config, file, bytes);
        String objectKey = buildObjectKey(config.dir, user.id, EXTENSIONS.get(contentType));
        putObject(config, objectKey, contentType, bytes);
        String avatarUrl = publicUrl(config.publicBaseUrl, objectKey);
        user.avatarUrl = avatarUrl;
        userMapper.updateById(user);
        return new AvatarUploadVO(avatarUrl);
    }

    private void validateOssEnabled(OssSettingsVO config) {
        if (!Boolean.TRUE.equals(config.enabled)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "OSS 未启用，无法上传头像");
        }
        if (!hasText(config.endpoint) || !hasText(config.bucket) || !hasText(config.accessKeyId)
            || !hasText(config.accessKeySecret) || !hasText(config.publicBaseUrl)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "OSS 配置不完整，请先在后台系统设置中配置");
        }
    }

    private String validateFile(OssSettingsVO config, MultipartFile file, byte[] bytes) {
        if (file == null || file.isEmpty() || bytes == null || bytes.length == 0) {
            throw new BizException(ErrorCode.BAD_REQUEST, "请选择头像文件");
        }
        long maxBytes = (long) (config.maxSizeMb == null ? 5 : config.maxSizeMb) * 1024L * 1024L;
        if (bytes.length > maxBytes || file.getSize() > maxBytes) {
            throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不能超过 " + (config.maxSizeMb == null ? 5 : config.maxSizeMb) + " MB");
        }
        String contentType = normalizedContentType(file.getContentType());
        if (!SUPPORTED_CONTENT_TYPES.contains(contentType)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "仅支持 JPG、PNG、GIF、WEBP、BMP 格式头像");
        }
        String detectedType = detectImageType(bytes);
        if (!contentType.equals(detectedType)) {
            throw new BizException(ErrorCode.BAD_REQUEST, "头像文件内容与声明格式不一致");
        }
        validateImageDimensions(contentType, bytes);
        return contentType;
    }

    private String detectImageType(byte[] bytes) {
        if (bytes.length >= 3
            && (bytes[0] & 0xff) == 0xff
            && (bytes[1] & 0xff) == 0xd8
            && (bytes[2] & 0xff) == 0xff) {
            return "image/jpeg";
        }
        if (bytes.length >= 8
            && (bytes[0] & 0xff) == 0x89
            && bytes[1] == 0x50
            && bytes[2] == 0x4e
            && bytes[3] == 0x47
            && bytes[4] == 0x0d
            && bytes[5] == 0x0a
            && bytes[6] == 0x1a
            && bytes[7] == 0x0a) {
            return "image/png";
        }
        if (bytes.length >= 6
            && bytes[0] == 0x47
            && bytes[1] == 0x49
            && bytes[2] == 0x46
            && bytes[3] == 0x38
            && (bytes[4] == 0x37 || bytes[4] == 0x39)
            && bytes[5] == 0x61) {
            return "image/gif";
        }
        if (bytes.length >= 12
            && bytes[0] == 0x52
            && bytes[1] == 0x49
            && bytes[2] == 0x46
            && bytes[3] == 0x46
            && bytes[8] == 0x57
            && bytes[9] == 0x45
            && bytes[10] == 0x42
            && bytes[11] == 0x50) {
            return "image/webp";
        }
        if (bytes.length >= 2 && bytes[0] == 0x42 && bytes[1] == 0x4d) {
            return "image/bmp";
        }
        throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不是有效图片");
    }

    private void validateImageDimensions(String contentType, byte[] bytes) {
        if ("image/webp".equals(contentType)) {
            return;
        }
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
                throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不是有效图片");
            }
            if ((long) image.getWidth() * image.getHeight() > MAX_PIXELS) {
                throw new BizException(ErrorCode.BAD_REQUEST, "头像图片像素过大");
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不是有效图片");
        }
    }

    private String buildObjectKey(String dir, long userId, String extension) {
        String normalizedDir = hasText(dir) ? dir.trim() : "avatars/";
        while (normalizedDir.startsWith("/")) {
            normalizedDir = normalizedDir.substring(1);
        }
        if (!normalizedDir.endsWith("/")) {
            normalizedDir += "/";
        }
        return normalizedDir + "users/" + userId + "/" + UUID.randomUUID() + "." + extension;
    }

    private void putObject(OssSettingsVO config, String objectKey, String contentType, byte[] bytes) {
        String date = DateTimeFormatter.RFC_1123_DATE_TIME.withLocale(Locale.US)
            .format(ZonedDateTime.now(ZoneOffset.UTC));
        String canonicalizedHeaders = "x-oss-object-acl:public-read\n";
        String canonicalizedResource = "/" + config.bucket + "/" + objectKey;
        String stringToSign = "PUT\n\n" + contentType + "\n" + date + "\n"
            + canonicalizedHeaders + canonicalizedResource;
        String signature = hmacSha1Base64(config.accessKeySecret, stringToSign);
        String authorization = "OSS " + config.accessKeyId + ":" + signature;

        URI uri = uploadUri(config.endpoint, config.bucket, objectKey);
        HttpRequest request = HttpRequest.newBuilder(uri)
            .PUT(HttpRequest.BodyPublishers.ofByteArray(bytes))
            .header("Date", date)
            .header("Content-Type", contentType)
            .header("Authorization", authorization)
            .header("x-oss-object-acl", "public-read")
            .build();
        try {
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new BizException(ErrorCode.INTERNAL_ERROR, "头像上传到 OSS 失败（HTTP " + response.statusCode() + "）");
            }
        } catch (IOException e) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "连接 OSS 失败，请检查 Endpoint");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BizException(ErrorCode.INTERNAL_ERROR, "头像上传被中断");
        }
    }

    private URI uploadUri(String endpoint, String bucket, String objectKey) {
        String trimmed = endpoint.trim();
        String scheme = "https";
        String host = trimmed;
        if (trimmed.startsWith("http://")) {
            scheme = "http";
            host = trimmed.substring("http://".length());
        } else if (trimmed.startsWith("https://")) {
            host = trimmed.substring("https://".length());
        }
        host = host.replaceAll("/+$", "");
        if (!host.startsWith(bucket + ".")) {
            host = bucket + "." + host;
        }
        return URI.create(scheme + "://" + host + "/" + objectKey);
    }

    private String publicUrl(String publicBaseUrl, String objectKey) {
        return publicBaseUrl.replaceAll("/+$", "") + "/" + objectKey;
    }

    private String hmacSha1Base64(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "生成 OSS 签名失败");
        }
    }

    private String normalizedContentType(String contentType) {
        if (contentType == null) {
            return "";
        }
        return contentType.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
