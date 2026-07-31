package com.qoj.module.xcpcio.service;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * XcpcioSecretCipher领域类型。封装 xcpcio.service 模块内的相关职责。
 */
@Component
public class XcpcioSecretCipher {
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;
    private final SecureRandom secureRandom = new SecureRandom();
    private final String secret;

    /**
     * 构造 XcpcioSecretCipher 实例并保存其必要依赖或初始状态。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public XcpcioSecretCipher(@Value("${qoj.xcpcio.secret:${qoj.jwt.secret:change-this-secret-to-at-least-32-bytes}}") String secret) {
        this.secret = secret;
    }

    /**
     * 封装encrypt相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, keySpec(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + encrypted.length);
            buffer.put(iv);
            buffer.put(encrypted);
            return Base64.getEncoder().encodeToString(buffer.array());
        } catch (Exception ex) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("XCPCIO token 加密失败", ex);
        }
    }

    /**
     * 封装decrypt相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    public String decrypt(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank()) {
            return null;
        }
        try {
            byte[] payload = Base64.getDecoder().decode(ciphertext);
            ByteBuffer buffer = ByteBuffer.wrap(payload);
            byte[] iv = new byte[IV_LENGTH];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, keySpec(), new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            /**
             * 封装String相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception ex) {
            /**
             * 封装IllegalStateException相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
             */
            throw new IllegalStateException("XCPCIO token 解密失败", ex);
        }
    }

    /**
     * 封装keySpec相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
     */
    private SecretKeySpec keySpec() throws Exception {
        byte[] key = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        /**
         * 封装SecretKeySpec相关逻辑。保持该职责的输入、输出和异常边界集中，便于调用方复用。
         */
        return new SecretKeySpec(key, "AES");
    }
}
