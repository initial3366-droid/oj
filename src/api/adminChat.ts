export const CHAT_IMAGE_API = "/api/admin/v1/agent/chat/images";
export const CHAT_FILE_API = "/api/admin/v1/agent/chat/files";
export const CHAT_FILE_ACCEPT = "image/jpeg,image/png,image/gif,image/webp,.zip,.pdf,.docx,.xlsx,.xls,.json,.txt,.md,.markdown,.html,.htm,.csv,.xml,.yaml,.yml,.log,.tex,.in,.out,.ans,.cpp,.cc,.c,.h,.hpp,.java,.py,.go,.js,.ts,.sql";

export type ChatImageData = { id: string; name: string; mimeType: string; size: number; width: number; height: number };
export type ChatFileData = { id: string; name: string; size: number; entryCount: number };
export type ChatAttachment = { key: string; file: File; src: string; status: "uploading" | "ready" | "error"; image?: ChatImageData; document?: ChatFileData; error?: string };
export type ChatImportSource = { files: ChatFileData[]; instructions: string; planId?: string };
export type FilePreviewSource = ChatImportSource & { file: ChatFileData };
export type ChatImportReference = { fileId: string; path: string; excerpt?: string | null };
export type ChatImportCaseMapping = { caseNo: number; input: ChatImportReference; output: ChatImportReference | null };
export type ChatImportBasic = { title: string; statement: string; inputFormat: string; outputFormat: string; timeLimit: number; memoryLimit: number; difficulty: number; tags: string[]; samples: { input: string; output: string; explanation?: string }[]; checkerSource?: string | null };
export type ChatImportApproved = { planId: string; request: { selections: Array<{ key: string; basic: ChatImportBasic; testCases: ChatImportCaseMapping[] }>; folderId: number | null } };
export type ChatImportResult = { id: string; problems: Array<{ id: number; title: string; testCaseCount: number; status: string }> };
