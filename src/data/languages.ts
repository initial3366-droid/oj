/**
 * QOJ 支持的提交语言选项及其展示/编辑器映射。
 * C++17 保留 cpp17 标识；后端仍兼容历史 cpp 提交。
 */
export type SubmissionLanguage = "C" | "C++17" | "C++20" | "C++23" | "Python" | "Java";

export type SubmissionLanguageApiValue = "c" | "cpp17" | "cpp20" | "cpp23" | "python" | "java";

export type CodeTemplateKey = "c" | "cpp" | "python" | "java";

export interface SubmissionLanguageOption {
  label: SubmissionLanguage;
  apiValue: SubmissionLanguageApiValue;
  monacoLanguage: string;
  templateKey: CodeTemplateKey;
}

export const SUBMISSION_LANGUAGE_OPTIONS: readonly SubmissionLanguageOption[] = [
  { label: "C", apiValue: "c", monacoLanguage: "c", templateKey: "c" },
  { label: "C++17", apiValue: "cpp17", monacoLanguage: "cpp", templateKey: "cpp" },
  { label: "C++20", apiValue: "cpp20", monacoLanguage: "cpp", templateKey: "cpp" },
  { label: "C++23", apiValue: "cpp23", monacoLanguage: "cpp", templateKey: "cpp" },
  { label: "Python", apiValue: "python", monacoLanguage: "python", templateKey: "python" },
  { label: "Java", apiValue: "java", monacoLanguage: "java", templateKey: "java" },
];

/** 判断语言是否属于 C/C++ 原生资源限制组。 */
export function isCppLanguage(language: string | null | undefined): boolean {
  const normalized = (language ?? "").trim().toLowerCase();
  return [
    "cpp",
    "cpp17",
    "cpp20",
    "cpp23",
    "c++",
    "c++17",
    "c++20",
    "c++23",
    "cxx",
    "g++",
  ].includes(normalized);
}

/** 将后端语言标识转换为用户可读名称，并兼容历史 cpp 标识。 */
export function languageLabel(language: string | null | undefined): string {
  const normalized = (language ?? "").trim().toLowerCase();
  switch (normalized) {
    case "cpp":
    case "cpp17":
    case "c++":
    case "c++17":
    case "cxx":
    case "g++":
      return "C++17";
    case "cpp20":
    case "c++20":
      return "C++20";
    case "cpp23":
    case "c++23":
      return "C++23";
    default:
      return language ?? "";
  }
}

/** 将提交记录中的语言标识规范化为做题页使用的语言选项。 */
export function submissionLanguageFromValue(language: string | null | undefined): SubmissionLanguage | null {
  const normalized = (language ?? "").trim().toLowerCase();
  switch (normalized) {
    case "c":
      return "C";
    case "cpp":
    case "cpp17":
    case "c++":
    case "c++17":
    case "cxx":
    case "g++":
      return "C++17";
    case "cpp20":
    case "c++20":
      return "C++20";
    case "cpp23":
    case "c++23":
      return "C++23";
    case "python":
    case "python3":
    case "py":
      return "Python";
    case "java":
      return "Java";
    default:
      return null;
  }
}

/** 将后端语言标识转换为 Monaco 语言标识。 */
export function monacoLanguage(language: string | null | undefined): string {
  if (isCppLanguage(language)) return "cpp";
  const normalized = (language ?? "").trim().toLowerCase();
  return normalized || "plaintext";
}
