package com.qoj.module.classroom.service;

import com.qoj.common.exception.BizException;
import com.qoj.module.classroom.dto.StudentImportRequest;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class StudentImportFileService {
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final int MAX_ROWS = 5000;
    private static final int MAX_COLUMNS = 50;
    private static final Pattern TAG_PATTERN = Pattern.compile("<[^>]*>");
    private static final Pattern SCRIPT_PATTERN = Pattern.compile("(?i)<\\s*script[^>]*>.*?<\\s*/\\s*script\\s*>");

    public StudentImportRequest parse(Long classId, String studentNoField, String nameField, MultipartFile file) {
        if (classId == null) {
            throw new BizException(400, "请选择目标班级");
        }
        if (studentNoField == null || studentNoField.isBlank()) {
            throw new BizException(400, "请填写学号字段");
        }
        if (nameField == null || nameField.isBlank()) {
            throw new BizException(400, "请填写姓名字段");
        }
        if (file == null || file.isEmpty()) {
            throw new BizException(400, "请选择导入文件");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BizException(400, "文件不能超过 5MB");
        }

        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        if (!allowedContentType(contentType)) {
            throw new BizException(400, "仅支持 csv、xls、xlsx 文件");
        }
        List<Map<String, String>> rows;
        try {
            if (filename.endsWith(".csv")) {
                rows = parseCsv(file);
            } else if (filename.endsWith(".xls") || filename.endsWith(".xlsx")) {
                rows = parseExcel(file);
            } else {
                throw new BizException(400, "仅支持 csv、xls、xlsx 文件");
            }
        } catch (BizException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BizException(400, "文件解析失败，请检查格式");
        }
        if (rows.isEmpty()) {
            throw new BizException(400, "导入文件没有学生数据");
        }
        return new StudentImportRequest(classId, studentNoField.trim(), nameField.trim(), List.of(), rows);
    }

    private boolean allowedContentType(String contentType) {
        return contentType.isBlank()
            || "text/csv".equals(contentType)
            || "application/csv".equals(contentType)
            || "application/vnd.ms-excel".equals(contentType)
            || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".equals(contentType)
            || "application/octet-stream".equals(contentType);
    }

    private List<Map<String, String>> parseCsv(MultipartFile file) throws IOException {
        List<List<String>> records = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                records.add(parseCsvLine(line));
            }
        }
        return recordsToRows(records);
    }

    private List<String> parseCsvLine(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cell.append('"');
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (ch == ',' && !quoted) {
                cells.add(cell.toString());
                cell.setLength(0);
            } else {
                cell.append(ch);
            }
        }
        cells.add(cell.toString());
        return cells;
    }

    private List<Map<String, String>> parseExcel(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            Sheet sheet = workbook.getNumberOfSheets() == 0 ? null : workbook.getSheetAt(0);
            if (sheet == null) {
                return List.of();
            }
            DataFormatter formatter = new DataFormatter(Locale.ROOT);
            List<List<String>> records = new ArrayList<>();
            int lastRow = Math.min(sheet.getLastRowNum(), MAX_ROWS);
            for (int rowIndex = sheet.getFirstRowNum(); rowIndex <= lastRow; rowIndex++) {
                Row row = sheet.getRow(rowIndex);
                if (row == null) {
                    records.add(List.of());
                    continue;
                }
                int lastCell = Math.min(row.getLastCellNum(), MAX_COLUMNS);
                List<String> cells = new ArrayList<>();
                for (int cellIndex = 0; cellIndex < lastCell; cellIndex++) {
                    Cell cell = row.getCell(cellIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
                    cells.add(cell == null ? "" : formatter.formatCellValue(cell));
                }
                records.add(cells);
            }
            return recordsToRows(records);
        }
    }

    private List<Map<String, String>> recordsToRows(List<List<String>> records) {
        List<String> headers = null;
        List<Map<String, String>> rows = new ArrayList<>();
        int dataRows = 0;
        for (List<String> record : records) {
            if (record == null || record.stream().allMatch(item -> item == null || item.isBlank())) {
                continue;
            }
            if (headers == null) {
                headers = record.stream().map(this::cleanText).filter(item -> !item.isBlank()).toList();
                if (headers.isEmpty()) {
                    throw new BizException(400, "表头不能为空");
                }
                if (headers.size() > MAX_COLUMNS) {
                    throw new BizException(400, "字段列数不能超过 50");
                }
                continue;
            }
            if (++dataRows > MAX_ROWS) {
                throw new BizException(400, "导入行数不能超过 5000");
            }
            Map<String, String> row = new LinkedHashMap<>();
            for (int i = 0; i < headers.size(); i++) {
                String key = headers.get(i);
                row.put(key, i < record.size() ? cleanText(record.get(i)) : "");
            }
            rows.add(row);
        }
        return rows;
    }

    private String cleanText(String value) {
        if (value == null) {
            return "";
        }
        String text = value.replace("\uFEFF", "").trim();
        text = SCRIPT_PATTERN.matcher(text).replaceAll("");
        text = TAG_PATTERN.matcher(text).replaceAll("");
        text = text.replaceAll("[\\p{Cntrl}&&[^\r\n\t]]", "");
        if (!text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) {
            text = "'" + text;
        }
        return text.length() > 500 ? text.substring(0, 500) : text;
    }
}
