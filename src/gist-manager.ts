import { Octokit } from '@octokit/rest';
import { FileGroup, FileChange, GistMetadata } from './types';
import path from 'path';
import fs from 'fs';

export class GistManager {
	private octokit: Octokit;
	private readonly version: string;

	constructor(token: string) {
		this.octokit = new Octokit({ auth: token });
		this.version = '1.0.0'; // Match package.json version
	}

	private getMetadataFileName(groupName: string): string {
		return `#${groupName}`;
	}

	private createMetadataFile(groupName: string, files?: string[]): { [key: string]: { content: string } } {
		const metadata: GistMetadata = {
			uploadDate: new Date().toISOString(),
			version: this.version,
			watchedFiles: files || []
		};

		return {
			[this.getMetadataFileName(groupName)]: {
				content: JSON.stringify(metadata, null, 2)
			}
		};
	}

	public async getGistMetadata(gistId: string, groupName: string): Promise<GistMetadata | null> {
		try {
			const gist = await this.octokit.gists.get({ gist_id: gistId });
			const metadataFileName = this.getMetadataFileName(groupName);
			const metadataFile = gist.data.files?.[metadataFileName];
			if (metadataFile?.content) {
				return JSON.parse(metadataFile.content);
			}
			return null;
		} catch (error) {
			console.error('Error fetching gist metadata:', error);
			return null;
		}
	}

	public async createGist(group: FileGroup): Promise<string> {
		console.log('createGist')
		const files: { [key: string]: { content: string } } = this.createMetadataFile(group.name, group.files);

		for (const filePath of group.files) {
			try {
				const content = fs.readFileSync(filePath, 'utf-8');
				files[path.basename(filePath)] = { content };
			} catch (error) {
				console.error(`Error reading file ${filePath}:`, error);
			}
		}

		try {
			const description = group.description || `File group: ${group.name}`;
			console.log(files)
			const response = await this.octokit.gists.create({
				description,
				public: false,
				files
			});

			if (!response.data.id) {
				throw new Error('Failed to get gist ID from response');
			}

			return response.data.id;
		} catch (error) {
			console.error('Error creating gist:', error);
			throw error;
		}
	}

	public async updateGist(gistId: string, changes: FileChange[], groupName: string): Promise<void> {
		try {
			// First, get the current gist to preserve existing files
			const currentGist = await this.octokit.gists.get({ gist_id: gistId });
			const files: { [key: string]: { content?: string } } = {};

			// Get the current watched files from metadata
			const metadata = await this.getGistMetadata(gistId, groupName);
			const watchedFiles = metadata?.watchedFiles || [];

			// Add metadata file
			const metadataFile = this.createMetadataFile(groupName, watchedFiles);
			Object.assign(files, metadataFile);

			// Add changed files
			for (const change of changes) {
				files[path.basename(change.path)] = { content: change.content };
			}

			// Keep other existing files unchanged
			if (currentGist.data.files) {
				for (const [filename, file] of Object.entries(currentGist.data.files)) {
					if (!files[filename] && file && file.content) {
						files[filename] = { content: file.content };
					}
				}
			}

			await this.octokit.gists.update({
				gist_id: gistId,
				files
			});
		} catch (error) {
			console.error('Error updating gist:', error);
			throw error;
		}
	}

	public async deleteGist(gistId: string): Promise<void> {
		try {
			await this.octokit.gists.delete({
				gist_id: gistId
			});
		} catch (error) {
			console.error('Error deleting gist:', error);
			throw error;
		}
	}
} 