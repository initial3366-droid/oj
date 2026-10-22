package com.qoj.module.auth.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.qoj.common.exception.BizException;
import com.qoj.common.redis.RedisKeys;
import com.qoj.module.setting.entity.SystemSetting;
import com.qoj.module.setting.mapper.SystemSettingMapper;
import jakarta.mail.Authenticator;
import jakarta.mail.Message;
import jakarta.mail.PasswordAuthentication;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.List;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import javax.imageio.ImageIO;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Captcha业务服务。集中编排权限校验、数据读写及相关领域规则，供控制器或后台任务调用。
 */
@Service
public class CaptchaService {
    private static final DefaultRedisScript<Long> RESERVE_EMAIL = new DefaultRedisScript<>("""
        if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
        if tonumber(redis.call('GET', KEYS[2]) or '0') >= 10 then return 0 end
        redis.call('SET', KEYS[1], ARGV[1], 'EX', 60)
        local count = redis.call('INCR', KEYS[2])
        if count == 1 or redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], 86400) end
        redis.call('DEL', KEYS[3], KEYS[4])
        return 1
        """, Long.class);
    private static final DefaultRedisScript<Long> PUBLISH_EMAIL = new DefaultRedisScript<>("""
        if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
        redis.call('SET', KEYS[2], ARGV[2], 'EX', 600)
        redis.call('DEL', KEYS[3])
        return 1
        """, Long.class);
    private static final String DEFAULT_EMAIL_SUBJECT = "QOJ 注册验证码";
    private static final String DEFAULT_EMAIL_CONTENT = "您好，\n\n您的验证码是: {{code}}\n\n验证码将在10分钟后过期，请勿泄露给他人。\n\nQOJ Online Judge System";

    private final StringRedisTemplate redisTemplate;
    private final SystemSettingMapper settingMapper;
    private final ObjectMapper objectMapper;
    private final SecureRandom random = new SecureRandom();
    private final Environment env;

    /**
     * 构造 CaptchaService 实例并保存其必要依赖或初始状态。从持久化层读取数据；读写 Redis 中的缓存、锁或限流状态。
     */
    public CaptchaService(
        StringRedisTemplate redisTemplate,
        SystemSettingMapper settingMapper,
        ObjectMapper objectMapper,
        Environment env
    ) {
        this.redisTemplate = redisTemplate;
        this.settingMapper = settingMapper;
        this.objectMapper = objectMapper;
        this.env = env;
    }

    public Map<String, String> generateImageCaptcha() {
        String captchaId = UUID.randomUUID().toString();
        String code = generateRandomCode(4);

        // 保存验证码到 Redis，5分钟过期
        redisTemplate.opsForValue().set(
            RedisKeys.captcha(captchaId),
            code,
            Duration.ofMinutes(5)
        );

        // 生成图片
        String imageBase64 = generateCaptchaImage(code);

        return Map.of(
            "captchaId", captchaId,
            "image", "data:image/png;base64," + imageBase64
        );
    }

    public long sendEmailVerificationCode(String email, String captchaId, String captcha) {
        verifyCaptcha(captchaId, captcha);
        String rateLimitKey = "oj:email:rate:" + email;
        String dailyLimitKey = "oj:email:daily:" + email + ":" + LocalDate.now();
        String reservation = UUID.randomUUID().toString();
        Long reserved = redisTemplate.execute(RESERVE_EMAIL,
            List.of(rateLimitKey, dailyLimitKey, RedisKeys.emailVerificationCode(email), EmailVerificationCodes.attemptsKey(email)), reservation);
        if (!Long.valueOf(1).equals(reserved)) throw new BizException(429, "发送过于频繁或已达每日上限，请稍后重试");
        String code = generateRandomCode(6);

        // 从系统设置中获取邮件配置和模板
        String subject = DEFAULT_EMAIL_SUBJECT;
        String content = DEFAULT_EMAIL_CONTENT;
        Map<String, Object> emailConfig = null;

        try {
            SystemSetting setting = settingMapper.selectById("register.email_config");
            if (setting != null && setting.settingValue != null && !setting.settingValue.isEmpty()) {
                emailConfig = objectMapper.readValue(
                    setting.settingValue,
                    new TypeReference<Map<String, Object>>() {}
                );
                String configuredSubject = stringValue(emailConfig.get("subject"));
                String configuredContent = stringValue(emailConfig.get("content"));
                if (configuredSubject != null && !configuredSubject.trim().isEmpty()) {
                    subject = configuredSubject;
                }
                if (configuredContent != null && !configuredContent.trim().isEmpty()) {
                    content = configuredContent;
                }
            }
        } catch (Exception e) {
            // 使用默认模板
        }
        emailConfig = mergeEnvironmentMailConfig(emailConfig);

        // 替换模板变量
        subject = subject.replace("{{code}}", code).replace("{{email}}", email);
        content = content.replace("{{code}}", code).replace("{{email}}", email);

        // 发送真实邮件
        sendEmail(emailConfig, email, subject, content);
        Long published = redisTemplate.execute(PUBLISH_EMAIL,
            List.of(rateLimitKey, RedisKeys.emailVerificationCode(email), EmailVerificationCodes.attemptsKey(email)), reservation, code);
        if (!Long.valueOf(1).equals(published)) throw new BizException(503, "验证码发送超时，请重新获取");

        return 60L;
    }

    private Map<String, Object> mergeEnvironmentMailConfig(Map<String, Object> emailConfig) {
        Map<String, Object> merged = emailConfig == null ? new HashMap<>() : new HashMap<>(emailConfig);
        String host = stringValue(merged.get("host"));
        String username = stringValue(merged.get("username"));
        String password = stringValue(merged.get("password"));

        if (host == null || host.isBlank() || "smtp.example.com".equals(host)) {
            host = env.getProperty("spring.mail.host");
            if (host != null && !host.isBlank() && !"smtp.example.com".equals(host)) {
                merged.put("host", host);
            }
        }
        if (username == null || username.isBlank()) {
            username = env.getProperty("spring.mail.username");
            if (username != null && !username.isBlank()) {
                merged.put("username", username);
            }
        }
        if (password == null || password.isBlank()) {
            password = env.getProperty("spring.mail.password");
            if (password != null && !password.isBlank()) {
                merged.put("password", password);
            }
        }
        if (!merged.containsKey("port")) {
            Integer port = env.getProperty("spring.mail.port", Integer.class);
            if (port != null) {
                merged.put("port", port);
            }
        }
        if (!merged.containsKey("useSsl")) {
            Boolean startTls = env.getProperty("spring.mail.properties.mail.smtp.starttls.enable", Boolean.class);
            merged.put("useSsl", startTls == null || !startTls);
        }
        return merged;
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private void sendEmail(Map<String, Object> config, String to, String subject, String content) {
        if (config == null || !config.containsKey("host")) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(500, "邮件服务未配置，请联系管理员在后台配置邮箱信息");
        }

        try {
            String host = stringValue(config.get("host"));
            Integer port = config.get("port") instanceof Number number ? number.intValue() : 587;
            String username = stringValue(config.get("username"));
            String password = stringValue(config.get("password"));
            Boolean useSsl = config.get("useSsl") instanceof Boolean bool ? bool : true;

            if (host == null || username == null || password == null) {
                /**
                 * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
                 */
                throw new BizException(500, "邮件配置不完整");
            }

            // 使用 JavaMail API 发送邮件
            Properties props = new Properties();
            props.put("mail.smtp.host", host);
            props.put("mail.smtp.port", port);
            props.put("mail.smtp.auth", "true");
            props.put("mail.mime.charset", "UTF-8");
            props.put("mail.smtp.connectiontimeout", "5000");
            props.put("mail.smtp.timeout", "5000");
            props.put("mail.smtp.writetimeout", "5000");

            if (useSsl) {
                props.put("mail.smtp.ssl.enable", "true");
            } else {
                props.put("mail.smtp.starttls.enable", "true");
            }

            Session session = Session.getInstance(props,
                new Authenticator() {
                    /**
                     * 读取PasswordAuthentication并返回给调用方。保持该职责的输入、输出和异常边界集中，便于调用方复用。
                     */
                    @Override
                    protected PasswordAuthentication getPasswordAuthentication() {
                        return new PasswordAuthentication(username, password);
                    }
                });

            MimeMessage message = new MimeMessage(session);
            message.setFrom(new InternetAddress(username));
            message.setRecipients(Message.RecipientType.TO,
                InternetAddress.parse(to));
            message.setSubject(subject, "UTF-8");
            message.setText(content, "UTF-8", "plain");
            message.setHeader("Content-Language", "zh-CN");

            Transport.send(message);
        } catch (Exception e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(500, "邮件发送失败，请稍后重试或联系管理员");
        }
    }

    public long getEmailRateLimitRemaining(String email) {
        String rateLimitKey = "oj:email:rate:" + email;
        Long ttl = redisTemplate.getExpire(rateLimitKey);
        return (ttl != null && ttl > 0) ? ttl : 0L;
    }

    /**
     * 验证图形验证码（供登录接口调用）
     */
    public void verifyCaptcha(String captchaId, String captcha) {
        if (captchaId == null || captchaId.isBlank() || captcha == null || captcha.isBlank()) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "请输入验证码");
        }
        String captchaKey = RedisKeys.captcha(captchaId);
        String storedCaptcha = redisTemplate.opsForValue().getAndDelete(captchaKey);
        if (storedCaptcha == null) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "验证码已过期，请刷新重试");
        }
        if (!storedCaptcha.equalsIgnoreCase(captcha)) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(400, "验证码错误");
        }
    }

    private String generateRandomCode(int length) {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < length; i++) {
            code.append(random.nextInt(10));
        }
        return code.toString();
    }

    private String generateCaptchaImage(String code) {
        int width = 120;
        int height = 40;

        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();

        // 设置背景
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, width, height);

        // 添加干扰线
        g.setColor(Color.LIGHT_GRAY);
        for (int i = 0; i < 5; i++) {
            int x1 = random.nextInt(width);
            int y1 = random.nextInt(height);
            int x2 = random.nextInt(width);
            int y2 = random.nextInt(height);
            g.drawLine(x1, y1, x2, y2);
        }

        // 绘制验证码
        g.setFont(new Font("Arial", Font.BOLD, 28));
        for (int i = 0; i < code.length(); i++) {
            g.setColor(new Color(random.nextInt(100), random.nextInt(100), random.nextInt(100)));
            int x = 20 + i * 25;
            int y = 28 + random.nextInt(5) - 2;
            g.drawString(String.valueOf(code.charAt(i)), x, y);
        }

        g.dispose();

        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(image, "png", baos);
            return Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            /**
             * 封装BizException相关逻辑。不满足业务约束时直接抛出明确异常。
             */
            throw new BizException(500, "生成验证码图片失败");
        }
    }
    private int parseInt(String value, int fallback) {
        try {
            return value == null ? fallback : Integer.parseInt(value);
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

}
