package com.qoj.module.contest.service;

import com.qoj.common.exception.BizException;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.web.multipart.MultipartFile;

public class ContestRosterFileService {
    public static List<String> parse(MultipartFile file) {
        if (file == null || file.isEmpty()) throw new BizException(400, "请选择导入文件");
        if (file.getSize() > 5L * 1024 * 1024) throw new BizException(400, "文件不能超过 5MB");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        List<List<String>> records = new ArrayList<>();
        try {
            if (name.endsWith(".csv")) {
                try (var reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        records.add(csvRow(line));
                        if (records.size() > 5001) throw new BizException(400, "导入行数不能超过 5000");
                    }
                }
            } else if (name.endsWith(".xls") || name.endsWith(".xlsx")) {
                try (var workbook = WorkbookFactory.create(file.getInputStream())) {
                    if (workbook.getNumberOfSheets() == 0) throw new BizException(400, "导入文件没有工作表");
                    var sheet = workbook.getSheetAt(0);
                    if (sheet.getLastRowNum() - sheet.getFirstRowNum() > 5000) throw new BizException(400, "导入行数不能超过 5000");
                    var formatter = new DataFormatter(Locale.ROOT);
                    for (Row row : sheet) {
                        if (row.getLastCellNum() > 50) throw new BizException(400, "字段列数不能超过 50");
                        List<String> cells = new ArrayList<>();
                        for (int i = 0; i < row.getLastCellNum(); i++) cells.add(formatter.formatCellValue(row.getCell(i)));
                        records.add(cells);
                    }
                }
            } else {
                throw new BizException(400, "仅支持 CSV、XLS、XLSX 文件");
            }
        } catch (BizException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BizException(400, "文件解析失败，请检查文件格式");
        }
        records.removeIf(row -> row.stream().allMatch(String::isBlank));
        if (records.isEmpty()) throw new BizException(400, "导入文件没有学生数据");
        var headers = records.get(0).stream().map(value -> value.replace("\uFEFF", "").trim()).toList();
        int column = headers.indexOf("学号");
        if (column < 0 || headers.lastIndexOf("学号") != column) throw new BizException(400, "表头必须包含唯一的“学号”列");
        List<String> studentNos = new ArrayList<>();
        for (var row : records.subList(1, records.size())) studentNos.add(column < row.size() ? row.get(column).trim() : "");
        if (studentNos.isEmpty()) throw new BizException(400, "导入文件没有学生数据");
        return studentNos;
    }

    private static List<String> csvRow(String line) {
        List<String> cells = new ArrayList<>();
        StringBuilder cell = new StringBuilder();
        boolean quoted = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') { cell.append('"'); i++; }
                else quoted = !quoted;
            } else if (ch == ',' && !quoted) { cells.add(cell.toString()); cell.setLength(0); }
            else cell.append(ch);
        }
        if (quoted) throw new BizException(400, "CSV 引号未闭合，请检查文件格式");
        cells.add(cell.toString());
        if (cells.size() > 50) throw new BizException(400, "字段列数不能超过 50");
        return cells;
    }
}
