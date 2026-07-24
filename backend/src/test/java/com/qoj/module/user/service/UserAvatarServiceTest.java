package com.qoj.module.user.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.qcloud.cos.COSClient;
import com.qcloud.cos.model.CannedAccessControlList;
import com.qcloud.cos.model.PutObjectRequest;
import com.qcloud.cos.model.PutObjectResult;
import com.qoj.module.setting.service.SystemSettingService;
import com.qoj.module.setting.vo.OssSettingsVO;
import com.qoj.module.user.entity.User;
import com.qoj.module.user.mapper.UserMapper;
import com.qoj.module.teacher.mapper.TeacherMapper;
import com.qoj.module.user.vo.AvatarUploadVO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.qoj.common.redis.RedisKeys;

@ExtendWith(MockitoExtension.class)
class UserAvatarServiceTest {
    @Mock
    private UserMapper userMapper;
    @Mock
    private TeacherMapper teacherMapper;
    @Mock
    private SystemSettingService settingService;
    @Mock
    private TencentCosClientFactory cosClientFactory;
    @Mock
    private COSClient cosClient;
    @Mock
    private StringRedisTemplate redisTemplate;

    private UserAvatarService service;

    @BeforeEach
    void setUp() {
        service = new UserAvatarService(userMapper, teacherMapper, settingService, cosClientFactory, redisTemplate);
    }

    @Test
    void updateUserAvatarUploadsPublicObjectToTencentCos() throws Exception {
        OssSettingsVO config = new OssSettingsVO();
        config.enabled = true;
        config.bucket = "qoj-1250000000";
        config.region = "ap-beijing";
        config.accessKeyId = "AKID0123456789ABCDEFGHIJ";
        config.accessKeySecret = "0123456789abcdef0123456789abcdef";
        config.publicBaseUrl = "https://qoj-1250000000.cos.ap-beijing.myqcloud.com/";
        config.dir = "avatars/";
        config.maxSizeMb = 5;
        when(settingService.getOssRuntimeSettings()).thenReturn(config);
        when(cosClientFactory.create(config.accessKeyId, config.accessKeySecret, config.region))
            .thenReturn(cosClient);
        when(cosClient.putObject(any(PutObjectRequest.class))).thenReturn(new PutObjectResult());

        User user = new User();
        user.id = 7L;
        user.username = "student";
        MockMultipartFile file = new MockMultipartFile(
            "file",
            "avatar.png",
            "image/png",
            pngBytes()
        );

        AvatarUploadVO result = service.updateUserAvatar(user, file);

        ArgumentCaptor<PutObjectRequest> requestCaptor = ArgumentCaptor.forClass(PutObjectRequest.class);
        verify(cosClient).putObject(requestCaptor.capture());
        PutObjectRequest request = requestCaptor.getValue();
        assertEquals(config.bucket, request.getBucketName());
        assertTrue(request.getKey().matches("avatars/users/7/[0-9a-f-]+\\.png"));
        assertEquals("image/png", request.getMetadata().getContentType());
        assertEquals(file.getSize(), request.getMetadata().getContentLength());
        assertEquals(CannedAccessControlList.PublicRead, request.getCannedAcl());
        assertEquals(config.publicBaseUrl.substring(0, config.publicBaseUrl.length() - 1)
            + "/" + request.getKey(), result.avatarUrl());
        assertEquals(result.avatarUrl(), user.avatarUrl);
        verify(userMapper).updateById(user);
        verify(redisTemplate).delete(RedisKeys.leaderboardGlobal());
        verify(cosClient).shutdown();
    }

    private byte[] pngBytes() throws Exception {
        BufferedImage image = new BufferedImage(2, 2, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
