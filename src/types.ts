export interface GistMetadata {
  uploadDate: string;
  version: string;
  watchedFiles: string[];
  watchedFolders?: string[];
}

export interface FileHash {
  path: string;
  hash: string;
  lastSync: string;
}

export interface FileGroup {
  name: string;
  description?: string;
  files: string[];
  folders?: string[];
  gistId?: string;
  fileHashes?: FileHash[];
}

export interface Config {
  githubToken: string;
  groups: FileGroup[];
}

export interface FileChange {
  path: string;
  content: string;
} 