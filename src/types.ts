export interface GistMetadata {
  uploadDate: string;
  version: string;
  watchedFiles: string[];
}

export interface FileGroup {
  name: string;
  description?: string;
  files: string[];
  gistId?: string;
}

export interface Config {
  githubToken: string;
  groups: FileGroup[];
}

export interface FileChange {
  path: string;
  content: string;
} 