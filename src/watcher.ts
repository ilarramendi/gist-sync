import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import crypto from 'crypto';
import type { FileGroup, FileChange, FileHash } from './types.ts';
import { GistManager } from './gist-manager.ts';
import { ConfigManager } from './config.ts';
import path from 'path';

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private gistManager: GistManager;
  private configManager: ConfigManager;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private intervalTimers: Map<string, NodeJS.Timeout> = new Map();
  private fileStates: Map<string, Map<string, string>> = new Map();

  constructor(gistManager: GistManager, configManager: ConfigManager) {
    this.gistManager = gistManager;
    this.configManager = configManager;
  }

  private calculateFileHash(filePath: string): string {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.error(`Error calculating hash for ${filePath}:`, error);
      return '';
    }
  }

  private async checkAndUpdateFileHashes(group: FileGroup): Promise<void> {
    const changedFiles: FileChange[] = [];
    const newHashes: FileHash[] = [];

    // Check individual files
    for (const filePath of group.files) {
      try {
        const currentHash = this.calculateFileHash(filePath);
        if (!currentHash) continue;

        const existingHash = group.fileHashes?.find(h => h.path === filePath);
        const content = fs.readFileSync(filePath, 'utf-8');

        if (!existingHash || existingHash.hash !== currentHash) {
          changedFiles.push({ path: filePath, content });
          newHashes.push({
            path: filePath,
            hash: currentHash,
            lastSync: new Date().toISOString()
          });
        } else {
          newHashes.push(existingHash);
        }
      } catch (error) {
        console.error(`Error checking file ${filePath}:`, error);
      }
    }

    // Check files in folders
    if (group.folders) {
      for (const folderPath of group.folders) {
        try {
          const folderFiles = fs.readdirSync(folderPath, { recursive: true }) as string[];
          for (const file of folderFiles) {
            const fullPath = path.join(folderPath, file);
            if (fs.statSync(fullPath).isFile()) {
              try {
                const currentHash = this.calculateFileHash(fullPath);
                if (!currentHash) continue;

                const existingHash = group.fileHashes?.find(h => h.path === fullPath);
                const content = fs.readFileSync(fullPath, 'utf-8');

                if (!existingHash || existingHash.hash !== currentHash) {
                  changedFiles.push({ path: fullPath, content });
                  newHashes.push({
                    path: fullPath,
                    hash: currentHash,
                    lastSync: new Date().toISOString()
                  });
                } else {
                  newHashes.push(existingHash);
                }
              } catch (error) {
                console.error(`Error checking file ${fullPath}:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`Error reading folder ${folderPath}:`, error);
        }
      }
    }

    if (changedFiles.length > 0 && group.gistId) {
      await this.gistManager.updateGist(group.gistId, changedFiles, group.name);
      group.fileHashes = newHashes;
      this.configManager.updateGroup(group.name, group);
      console.log(`Updated ${changedFiles.length} changed files for group ${group.name}`);
    }
  }

  private async checkFileChanges(group: FileGroup): Promise<void> {
    if (!this.fileStates.has(group.name)) {
      this.fileStates.set(group.name, new Map());
    }

    const groupStates = this.fileStates.get(group.name)!;
    const changes: FileChange[] = [];

    // Check individual files
    for (const filePath of group.files) {
      try {
        const currentContent = fs.readFileSync(filePath, 'utf-8');
        const previousContent = groupStates.get(filePath);

        if (previousContent !== currentContent) {
          changes.push({
            path: filePath,
            content: currentContent
          });
          groupStates.set(filePath, currentContent);
        }
      } catch (error) {
        console.error(`Error checking file ${filePath}:`, error);
      }
    }

    // Check files in folders
    if (group.folders) {
      for (const folderPath of group.folders) {
        try {
          const folderFiles = fs.readdirSync(folderPath, { recursive: true }) as string[];
          for (const file of folderFiles) {
            const fullPath = path.join(folderPath, file);
            if (fs.statSync(fullPath).isFile()) {
              try {
                const currentContent = fs.readFileSync(fullPath, 'utf-8');
                const previousContent = groupStates.get(fullPath);

                if (previousContent !== currentContent) {
                  changes.push({
                    path: fullPath,
                    content: currentContent
                  });
                  groupStates.set(fullPath, currentContent);
                }
              } catch (error) {
                console.error(`Error checking file ${fullPath}:`, error);
              }
            }
          }
        } catch (error) {
          console.error(`Error reading folder ${folderPath}:`, error);
        }
      }
    }

    if (changes.length > 0) {
      await this.gistManager.updateGist(group.gistId!, changes, group.name);
      console.log(`Updated ${changes.length} changed files for group ${group.name}`);
    }
  }

  public async watchGroup(group: FileGroup, intervalMinutes?: number): Promise<void> {
    if (!group.gistId) {
      throw new Error(`Group ${group.name} has no associated gist ID`);
    }

    // Check for changes on startup
    await this.checkAndUpdateFileHashes(group);

    // Initialize file states for interval checking
    if (intervalMinutes !== undefined) {
      this.fileStates.set(group.name, new Map());
      const groupStates = this.fileStates.get(group.name)!;
      
      // Store initial file states
      for (const filePath of group.files) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          groupStates.set(filePath, content);
        } catch (error) {
          console.error(`Error reading initial state of ${filePath}:`, error);
        }
      }

      // Store initial states for files in folders
      if (group.folders) {
        for (const folderPath of group.folders) {
          try {
            const folderFiles = fs.readdirSync(folderPath, { recursive: true }) as string[];
            for (const file of folderFiles) {
              const fullPath = path.join(folderPath, file);
              if (fs.statSync(fullPath).isFile()) {
                try {
                  const content = fs.readFileSync(fullPath, 'utf-8');
                  groupStates.set(fullPath, content);
                } catch (error) {
                  console.error(`Error reading initial state of ${fullPath}:`, error);
                }
              }
            }
          } catch (error) {
            console.error(`Error reading folder ${folderPath}:`, error);
          }
        }
      }

      // Set up interval checking
      const timer = setInterval(() => {
        this.checkFileChanges(group);
      }, intervalMinutes * 60 * 1000);
      
      this.intervalTimers.set(group.name, timer);
      return;
    }

    // Default real-time watching behavior
    const pathsToWatch = [...group.files];
    if (group.folders) {
      pathsToWatch.push(...group.folders);
    }

    const watcher = chokidar.watch(pathsToWatch, {
      persistent: true,
      ignoreInitial: true,
      ignorePermissionErrors: true,
      followSymlinks: false
    });

    watcher.on('change', (path) => this.handleFileChange(path, group));
    watcher.on('add', (path) => {
      // Only handle new files in watched folders
      if (group.folders && group.folders.some(folder => path.startsWith(folder))) {
        this.handleFileChange(path, group);
      }
    });
    this.watchers.set(group.name, watcher);
  }

  private async handleFileChange(filePath: string, group: FileGroup): Promise<void> {
    // Clear existing timer for this group
    const existingTimer = this.debounceTimers.get(group.name);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    this.debounceTimers.set(
      group.name,
      setTimeout(async () => {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const changes: FileChange[] = [{
            path: filePath,
            content
          }];

          await this.gistManager.updateGist(group.gistId!, changes, group.name);
          console.log(`Updated gist for group ${group.name} with changes from ${filePath}`);

          // Update file hash
          const currentHash = this.calculateFileHash(filePath);
          if (currentHash) {
            if (!group.fileHashes) group.fileHashes = [];
            const hashIndex = group.fileHashes.findIndex(h => h.path === filePath);
            const newHash: FileHash = {
              path: filePath,
              hash: currentHash,
              lastSync: new Date().toISOString()
            };
            
            if (hashIndex >= 0) {
              group.fileHashes[hashIndex] = newHash;
            } else {
              group.fileHashes.push(newHash);
            }
            this.configManager.updateGroup(group.name, group);
          }
        } catch (error) {
          console.error(`Error updating gist for group ${group.name}:`, error);
        }
      }, 1000) // 1 second debounce
    );
  }

  public unwatchGroup(groupName: string): void {
    // Clear interval timer if exists
    const intervalTimer = this.intervalTimers.get(groupName);
    if (intervalTimer) {
      clearInterval(intervalTimer);
      this.intervalTimers.delete(groupName);
      this.fileStates.delete(groupName);
    }

    // Clear file watcher if exists
    const watcher = this.watchers.get(groupName);
    if (watcher) {
      watcher.close();
      this.watchers.delete(groupName);
    }
  }

  public dispose(): void {
    // Clear all interval timers
    for (const [groupName, timer] of this.intervalTimers) {
      clearInterval(timer);
      console.log(`Stopped interval checking for group: ${groupName}`);
    }
    this.intervalTimers.clear();
    this.fileStates.clear();

    // Clear all watchers
    for (const [groupName, watcher] of this.watchers) {
      watcher.close();
      console.log(`Stopped watching group: ${groupName}`);
    }
    this.watchers.clear();
  }
} 