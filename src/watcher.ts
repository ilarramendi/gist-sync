import chokidar, { FSWatcher } from 'chokidar';
import fs from 'fs';
import { FileGroup, FileChange } from './types';
import { GistManager } from './gist-manager';

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private gistManager: GistManager;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(gistManager: GistManager) {
    this.gistManager = gistManager;
  }

  public watchGroup(group: FileGroup): void {
    if (!group.gistId) {
      throw new Error(`Group ${group.name} has no associated gist ID`);
    }

    const watcher = chokidar.watch(group.files, {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', (path) => this.handleFileChange(path, group));
    this.watchers.set(group.name, watcher);
  }

  public unwatchGroup(groupName: string): void {
    const watcher = this.watchers.get(groupName);
    if (watcher) {
      watcher.close();
      this.watchers.delete(groupName);
    }
  }

  private handleFileChange(filePath: string, group: FileGroup): void {
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
        } catch (error) {
          console.error(`Error updating gist for group ${group.name}:`, error);
        }
      }, 1000) // 1 second debounce
    );
  }

  public dispose(): void {
    for (const [groupName, watcher] of this.watchers) {
      watcher.close();
      console.log(`Stopped watching group: ${groupName}`);
    }
    this.watchers.clear();
  }
} 