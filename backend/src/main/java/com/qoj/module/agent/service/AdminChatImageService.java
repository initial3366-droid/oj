package com.qoj.module.agent.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.agent.vo.AdminChatImageVO;
import com.qoj.security.CurrentUser;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.springframework.ai.content.Media;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.MimeType;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminChatImageService {
    public static final int MAX_IMAGES = 4;
    public static final long MAX_BYTES = 5L * 1024 * 1024;
    public static final long MAX_CONTEXT_BYTES = 20L * 1024 * 1024;
    private static final String COLUMNS = "id, name, mime_type, size_bytes, width, height";
    private final JdbcTemplate jdbc;

    public AdminChatImageService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public long ownerId() {
        var user = CurrentUser.required();
        if (!user.adminAccount()) throw new BizException(403, "仅后台账号可以访问聊天图片");
        return user.id();
    }

    public AdminChatImageVO upload(MultipartFile file) {
        long owner = ownerId();
        if (file == null || file.isEmpty()) throw new BizException(400, "请选择图片");
        if (file.getSize() > MAX_BYTES) throw new BizException(400, "单张图片不能超过 5 MB");
        try {
            byte[] data = file.getBytes();
            String mime = detectMime(data);
            int[] dimensions = dimensions(data, mime);
            if (dimensions[0] < 1 || dimensions[1] < 1 || dimensions[0] > 4096 || dimensions[1] > 4096) {
                throw new BizException(400, "图片宽高不能超过 4096 像素");
            }
            String name = file.getOriginalFilename() == null ? "图片" : file.getOriginalFilename()
                .replaceAll("[\\p{Cntrl}\\\\/]", "_");
            name = name.substring(0, Math.min(name.length(), 255));
            String id = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO admin_ai_chat_images (id, owner_admin_id, name, mime_type, size_bytes, width, height, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id, owner, name, mime, data.length, dimensions[0], dimensions[1], data);
            return new AdminChatImageVO(id, name, mime, (long) data.length, dimensions[0], dimensions[1]);
        } catch (IOException e) {
            throw new BizException(400, "图片无法读取，请重新上传");
        }
    }

    /** Shared row locks prevent a draft deletion from racing a history save. */
    public List<AdminChatImageVO> validate(long owner, String role, List<AdminChatImageVO> images, boolean lock) {
        if (images == null || images.isEmpty()) return List.of();
        if (!"user".equals(role) || images.size() > MAX_IMAGES) throw new BizException(400, "仅用户消息可附带图片，每条最多 4 张");
        var result = new ArrayList<AdminChatImageVO>();
        var ids = new HashSet<String>();
        for (var image : images) {
            if (image == null || image.id() == null || !ids.add(image.id())) throw new BizException(400, "图片标识重复或无效");
            var rows = jdbc.query("SELECT " + COLUMNS + " FROM admin_ai_chat_images WHERE id = ? AND owner_admin_id = ?" + (lock ? " FOR SHARE" : ""),
                (rs, row) -> new AdminChatImageVO(rs.getString("id"), rs.getString("name"), rs.getString("mime_type"),
                    rs.getLong("size_bytes"), rs.getInt("width"), rs.getInt("height")), image.id(), owner);
            if (rows.isEmpty()) throw new BizException(404, "聊天图片不存在，请重新上传");
            result.add(rows.get(0));
        }
        return List.copyOf(result);
    }

    public StoredImage read(long owner, String id) {
        var rows = jdbc.query("SELECT mime_type, data FROM admin_ai_chat_images WHERE id = ? AND owner_admin_id = ?",
            (rs, row) -> new StoredImage(rs.getString("mime_type"), rs.getBytes("data")), id, owner);
        if (rows.isEmpty()) throw new BizException(404, "聊天图片不存在");
        return rows.get(0);
    }

    public List<Media> media(long owner, List<AdminChatImageVO> images) {
        if (images == null) return List.of();
        return images.stream().map(image -> {
            StoredImage stored = read(owner, image.id());
            return new Media(MimeType.valueOf(stored.mimeType()), new ByteArrayResource(stored.data()));
        }).toList();
    }

    @Transactional
    public void delete(String id) {
        long owner = ownerId();
        jdbc.queryForList("SELECT id FROM admin_ai_chat_images WHERE id = ? AND owner_admin_id = ? FOR UPDATE", id, owner);
        if (referenced(owner, id)) throw new BizException(409, "图片已随聊天保存，请删除对应聊天");
        jdbc.update("DELETE FROM admin_ai_chat_images WHERE id = ? AND owner_admin_id = ?", id, owner);
    }

    public void deleteUnused(long owner, List<AdminChatImageVO> images) {
        if (images == null) return;
        for (var image : images) {
            jdbc.queryForList("SELECT id FROM admin_ai_chat_images WHERE id = ? AND owner_admin_id = ? FOR UPDATE", image.id(), owner);
            if (!referenced(owner, image.id())) jdbc.update("DELETE FROM admin_ai_chat_images WHERE id = ? AND owner_admin_id = ?", image.id(), owner);
        }
    }

    private boolean referenced(long owner, String id) {
        return Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM admin_ai_chat_sessions WHERE owner_admin_id = ? AND JSON_SEARCH(messages, 'one', ?, NULL, '$[*].images[*].id') IS NOT NULL)", Boolean.class, owner, id));
    }

    private static String detectMime(byte[] data) {
        if (data.length >= 8 && data[0] == (byte) 0x89 && new String(data, 1, 3, StandardCharsets.US_ASCII).equals("PNG")) return "image/png";
        if (data.length >= 3 && data[0] == (byte) 0xff && data[1] == (byte) 0xd8 && data[2] == (byte) 0xff) return "image/jpeg";
        if (data.length >= 6 && new String(data, 0, 6, StandardCharsets.US_ASCII).matches("GIF8[79]a")) return "image/gif";
        if (data.length >= 30 && new String(data, 0, 4, StandardCharsets.US_ASCII).equals("RIFF") && new String(data, 8, 4, StandardCharsets.US_ASCII).equals("WEBP")) return "image/webp";
        throw new BizException(400, "仅支持 JPEG、PNG、GIF、WebP 图片");
    }

    private static int[] dimensions(byte[] data, String mime) throws IOException {
        if (mime.equals("image/webp")) {
            ByteBuffer buffer = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN);
            if (Integer.toUnsignedLong(buffer.getInt(4)) + 8 != data.length) throw new BizException(400, "WebP 图片已损坏");
            boolean hasFrame = false;
            int position = 12;
            while (position + 8 <= data.length) {
                String type = new String(data, position, 4, StandardCharsets.US_ASCII);
                long size = Integer.toUnsignedLong(buffer.getInt(position + 4));
                if (size > data.length - position - 8) throw new BizException(400, "WebP 图片已损坏");
                if ((type.equals("VP8 ") && size >= 10) || (type.equals("VP8L") && size >= 5)
                    || (type.equals("ANMF") && size > 16)) hasFrame = true;
                position += 8 + (int) size + (int) (size & 1);
            }
            if (position != data.length || !hasFrame) throw new BizException(400, "WebP 图片已损坏");
            String chunk = new String(data, 12, 4, StandardCharsets.US_ASCII);
            if (chunk.equals("VP8X")) return new int[] {1 + uint24(data, 24), 1 + uint24(data, 27)};
            if (chunk.equals("VP8L") && data[20] == 0x2f) {
                int bits = buffer.getInt(21);
                return new int[] {1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)};
            }
            if (chunk.equals("VP8 ") && data[23] == (byte) 0x9d && data[24] == 1 && data[25] == 0x2a) {
                return new int[] {buffer.getShort(26) & 0x3fff, buffer.getShort(28) & 0x3fff};
            }
            throw new BizException(400, "WebP 图片已损坏");
        }
        try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            var readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new BizException(400, "图片已损坏");
            var reader = readers.next();
            try {
                reader.setInput(input);
                int width = reader.getWidth(0), height = reader.getHeight(0);
                if (width <= 4096 && height <= 4096) reader.read(0); // Validate pixels only after bounding decompression.
                return new int[] {width, height};
            } finally { reader.dispose(); }
        }
    }

    private static int uint24(byte[] bytes, int index) {
        return (bytes[index] & 255) | ((bytes[index + 1] & 255) << 8) | ((bytes[index + 2] & 255) << 16);
    }

    public record StoredImage(String mimeType, byte[] data) {}
}
