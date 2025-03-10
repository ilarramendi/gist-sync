import fs from 'fs';
import path from 'path';
import os from 'os';
import { Config, FileGroup } from './types';

export class ConfigManager {
  private static configPath = path.join(os.homedir(), '.gist-sync-config.json');
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      if (fs.existsSync(ConfigManager.configPath)) {
        return JSON.parse(fs.readFileSync(ConfigManager.configPath, 'utf-8'));
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    return { githubToken: '', groups: [] };
  }

  public saveConfig(): void {
    try {
      fs.writeFileSync(ConfigManager.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  public getConfig(): Config {
    return this.config;
  }

  public setGithubToken(token: string): void {
    this.config.githubToken = token;
    this.saveConfig();
  }

  public addGroup(group: FileGroup): void {
    this.config.groups.push(group);
    this.saveConfig();
  }

  public removeGroup(name: string): void {
    this.config.groups = this.config.groups.filter(g => g.name !== name);
    this.saveConfig();
  }

  public updateGroup(name: string, group: FileGroup): void {
    const index = this.config.groups.findIndex(g => g.name === name);
    if (index !== -1) {
      this.config.groups[index] = group;
      this.saveConfig();
    }
  }

  public getGroup(name: string): FileGroup | undefined {
    return this.config.groups.find(g => g.name === name);
  }
} 