package com.qoj.module.user.service;

import com.qoj.common.ErrorCode;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.user.vo.AvatarUploadVO;
import com.qoj.module.teacher.entity.Teacher;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qcloud.cos.COSClient;
import com.qcloud.cos.exception.CosClientException;
import com.qcloud.cos.exception.CosServiceException;
import com.qcloud.cos.model.CannedAccessControlList;
import com.qcloud.cos.model.ObjectMetadata;
import com.qcloud.cos.model.PutObjectRequest;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 用户头像业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
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
    private final TeacherMapper teacherMapper;
    private final SystemSettingService settingService;
    private final TencentCosClientFactory cosClientFactory;
    private final StringRedisTemplate redisTemplate;

    /**
     * 构造 用户头像Service 实例并保存其必要依赖或初始状态。从持久化层读取数据；可能调用外部判题或网关服务。
     */
    public UserAvatarService(
        UserMapper userMapper,
        TeacherMapper teacherMapper,
        SystemSettingService settingService,
        TencentCosClientFactory cosClientFactory,
        StringRedisTemplate redisTemplate
    ) {
        this.userMapper = userMapper;
        this.teacherMapper = teacherMapper;
        this.settingService = settingService;
        this.cosClientFactory = cosClientFactory;
        this.redisTemplate = redisTemplate;
    }

    /**
     * 更新用户头像。不满足业务约束时直接抛出明确异常；从持久化层读取数据；整个过程位于同一数据库事务中。
     */
    @Transactional
    public AvatarUploadVO updateUserAvatar(long userId, MultipartFile file) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "用户不存在");
        }
        /**
         * 更新用户头像。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return updateUserAvatar(user, file);
    }

    /**
     * 更新用户头像。不满足业务约束时直接抛出明确异常；执行持久化写入；整个过程位于同一数据库事务中。
     */
    @Transactional
    public AvatarUploadVO updateUserAvatar(User user, MultipartFile file) {
        OssSettingsVO config = settingService.getOssRuntimeSettings();
        validateOssEnabled(config);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "读取头像文件失败");
        }
        String contentType = validateFile(config, file, bytes);
        String objectKey = buildObjectKey(config.dir, "users", user.id, EXTENSIONS.get(contentType));
        putObject(config, objectKey, contentType, bytes);
        String avatarUrl = publicUrl(config.publicBaseUrl, objectKey);
        user.avatarUrl = avatarUrl;
        userMapper.updateById(user);
        try {
            redisTemplate.delete(RedisKeys.leaderboardGlobal());
        } catch (RuntimeException ignored) {
            // Avatar updates must not fail only because the derived leaderboard cache is unavailable.
        }
        /**
         * 封装头像UploadVO相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new AvatarUploadVO(avatarUrl);
    }

    @Transactional
    public AvatarUploadVO updateTeacherAvatar(Teacher teacher, MultipartFile file) {
        if (teacher == null || teacher.id == null) {
            throw new BizException(ErrorCode.NOT_FOUND.getCode(), "教师不存在");
        }
        OssSettingsVO config = settingService.getOssRuntimeSettings();
        validateOssEnabled(config);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BizException(ErrorCode.BAD_REQUEST, "读取头像文件失败");
        }
        String contentType = validateFile(config, file, bytes);
        String objectKey = buildObjectKey(config.dir, "teachers", teacher.id, EXTENSIONS.get(contentType));
        putObject(config, objectKey, contentType, bytes);
        String avatarUrl = publicUrl(config.publicBaseUrl, objectKey);
        teacher.avatarUrl = avatarUrl;
        teacherMapper.updateById(teacher);
        return new AvatarUploadVO(avatarUrl);
    }

    /**
     * 校验Oss启用状态。不满足业务约束时直接抛出明确异常。
     */
    private void validateOssEnabled(OssSettingsVO config) {
        if (!Boolean.TRUE.equals(config.enabled)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "OSS 未启用，无法上传头像");
        }
        if (!hasText(config.bucket) || !hasText(config.region) || !hasText(config.accessKeyId)
            || !hasText(config.accessKeySecret) || !hasText(config.publicBaseUrl)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "腾讯云 COS 配置不完整，请先在后台系统设置中配置");
        }
    }

    /**
     * 校验File。不满足业务约束时直接抛出明确异常。
     */
    private String validateFile(OssSettingsVO config, MultipartFile file, byte[] bytes) {
        if (file == null || file.isEmpty() || bytes == null || bytes.length == 0) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "请选择头像文件");
        }
        long maxBytes = (long) (config.maxSizeMb == null ? 5 : config.maxSizeMb) * 1024L * 1024L;
        if (bytes.length > maxBytes || file.getSize() > maxBytes) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不能超过 " + (config.maxSizeMb == null ? 5 : config.maxSizeMb) + " MB");
        }
        String contentType = normalizedContentType(file.getContentType());
        if (!SUPPORTED_CONTENT_TYPES.contains(contentType)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "仅支持 JPG、PNG、GIF、WEBP、BMP 格式头像");
        }
        String detectedType = detectImageType(bytes);
        if (!contentType.equals(detectedType)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "头像文件内容与声明格式不一致");
        }
        validateImageDimensions(contentType, bytes);
        return contentType;
    }

    /**
     * 封装detectImage类型相关逻辑。不满足业务约束时直接抛出明确异常。
     */
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
        /**
         * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
         */
        throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不是有效图片");
    }

    /**
     * 校验ImageDimensions。不满足业务约束时直接抛出明确异常。
     */
    private void validateImageDimensions(String contentType, byte[] bytes) {
        if ("image/webp".equals(contentType)) {
            return;
        }
        try {
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(bytes));
            if (image == null || image.getWidth() <= 0 || image.getHeight() <= 0) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不是有效图片");
            }
            if ((long) image.getWidth() * image.getHeight() > MAX_PIXELS) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(ErrorCode.BAD_REQUEST, "头像图片像素过大");
            }
        } catch (IOException e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(ErrorCode.BAD_REQUEST, "头像文件不是有效图片");
        }
    }

    /**
     * 构造或转换ObjectKey。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private String buildObjectKey(String dir, String category, long accountId, String extension) {
        String normalizedDir = hasText(dir) ? dir.trim() : "avatars/";
        while (normalizedDir.startsWith("/")) {
            normalizedDir = normalizedDir.substring(1);
        }
        if (!normalizedDir.endsWith("/")) {
            normalizedDir += "/";
        }
        return normalizedDir + category + "/" + accountId + "/" + UUID.randomUUID() + "." + extension;
    }

    /**
     * 封装putObject相关逻辑。不满足业务约束时直接抛出明确异常；可能调用外部判题或网关服务。
     */
    private void putObject(OssSettingsVO config, String objectKey, String contentType, byte[] bytes) {
        COSClient cosClient = cosClientFactory.create(
            config.accessKeyId.trim(),
            config.accessKeySecret.trim(),
            config.region.trim()
        );
        try {
            ObjectMetadata metadata = new ObjectMetadata();
            metadata.setContentLength(bytes.length);
            metadata.setContentType(contentType);
            PutObjectRequest request = new PutObjectRequest(
                config.bucket.trim(),
                objectKey,
                new ByteArrayInputStream(bytes),
                metadata
            );
            request.setCannedAcl(CannedAccessControlList.PublicRead);
            cosClient.putObject(request);
        } catch (CosServiceException e) {
            throw new BizException(
                ErrorCode.INTERNAL_ERROR,
                "头像上传到腾讯云 COS 失败（HTTP " + e.getStatusCode() + "）"
            );
        } catch (CosClientException e) {
            throw new BizException(ErrorCode.INTERNAL_ERROR, "连接腾讯云 COS 失败，请检查 Region 和网络");
        } finally {
            cosClient.shutdown();
        }
    }

    private String publicUrl(String publicBaseUrl, String objectKey) {
        return publicBaseUrl.replaceAll("/+$", "") + "/" + objectKey;
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
