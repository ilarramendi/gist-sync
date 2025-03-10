#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigManager } from './config';
import { GistManager } from './gist-manager';
import { FileWatcher } from './watcher';
import { FileGroup, GistMetadata } from './types';

const program = new Command();
const configManager = new ConfigManager();

let gistManager: GistManager | null = null;
let fileWatcher: FileWatcher | null = null;

program
	.name('gist-sync')
	.description('CLI to sync file groups with GitHub Gists')
	.version('1.0.0');

program
	.command('config')
	.description('Configure GitHub token')
	.action(async () => {
		const { token } = await inquirer.prompt([
			{
				type: 'password',
				name: 'token',
				message: 'Enter your GitHub personal access token:',
				validate: (input) => input.length > 0
			}
		]);

		configManager.setGithubToken(token);
		console.log(chalk.green('GitHub token configured successfully!'));
	});

program
	.command('create')
	.description('Create a new file group')
	.action(async () => {
		const { name, description } = await inquirer.prompt([
			{
				type: 'input',
				name: 'name',
				message: 'Enter group name:',
				validate: (input) => input.length > 0 && !input.includes('/')
			},
			{
				type: 'input',
				name: 'description',
				message: 'Enter group description (optional):'
			}
		]);

		const files: string[] = [];
		console.log(chalk.blue('\nEnter file paths to watch (press Enter with empty input to finish):'));

		while (true) {
			const { file } = await inquirer.prompt([
				{
					type: 'input',
					name: 'file',
					message: 'Enter file path to watch:',
				}
			]);

			if (!file.trim()) {
				if (files.length === 0) {
					console.log(chalk.yellow('Please add at least one file to watch.'));
					continue;
				}
				break;
			}

			files.push(file.replaceAll('\\', '/'));
		}

		const config = configManager.getConfig();
		if (!config.githubToken) {
			console.log(chalk.red('GitHub token not configured. Please run `gist-sync config` first.'));
			return;
		}

		gistManager = new GistManager(config.githubToken);
		const group: FileGroup = { name, description, files };

		try {
			const gistId = await gistManager.createGist(group);
			group.gistId = gistId;
			configManager.addGroup(group);
			console.log(chalk.green(`Group "${name}" created successfully!`));
			console.log(chalk.blue(`Gist ID: ${gistId}`));
		} catch (error) {
			console.error(chalk.red('Error creating group:'), error);
		}
	});

program
	.command('list')
	.description('List all file groups')
	.action(async () => {
		const config = configManager.getConfig();
		if (config.groups.length === 0) {
			console.log(chalk.yellow('No groups configured.'));
			return;
		}

		if (!config.githubToken) {
			console.log(chalk.red('GitHub token not configured. Please run `gist-sync config` first.'));
			return;
		}

		gistManager = new GistManager(config.githubToken);

		console.log(chalk.blue('\nConfigured groups:'));
		for (const group of config.groups) {
			console.log(chalk.green(`\n${group.name}:`));
			if (group.description) console.log(chalk.gray(`Description: ${group.description}`));
			console.log(chalk.gray(`Gist ID: ${group.gistId}`));
			
			if (group.gistId) {
				try {
					const metadata = await gistManager.getGistMetadata(group.gistId, group.name);
					if (metadata) {
						console.log(chalk.gray(`Last Upload: ${new Date(metadata.uploadDate).toLocaleString()}`));
						console.log(chalk.gray(`Version: ${metadata.version}`));
					}
				} catch (error) {
					console.error(chalk.red(`Error fetching gist metadata for ${group.name}:`), error);
				}
			}

			console.log('Files:');
			group.files.forEach(file => console.log(chalk.yellow(`- ${file}`)));
		}
	});

program
	.command('watch')
	.description('Start watching file groups')
	.option('-i, --interval <minutes>', 'Check for changes every N minutes instead of watching continuously')
	.action((options) => {
		const config = configManager.getConfig();
		if (!config.githubToken) {
			console.log(chalk.red('GitHub token not configured. Please run `gist-sync config` first.'));
			return;
		}

		if (config.groups.length === 0) {
			console.log(chalk.yellow('No groups configured. Create a group first.'));
			return;
		}

		gistManager = new GistManager(config.githubToken);
		fileWatcher = new FileWatcher(gistManager, configManager);

		const intervalMinutes = options.interval ? parseInt(options.interval) : undefined;

		config.groups.forEach(group => {
			try {
				fileWatcher!.watchGroup(group, intervalMinutes);
				console.log(chalk.green(`Started watching group: ${group.name}`));
			} catch (error) {
				console.error(chalk.red(`Error setting up watching for group ${group.name}:`), error);
			}
		});

		const mode = intervalMinutes ? `checking every ${intervalMinutes} minutes` : 'watching continuously';
		console.log(chalk.blue(`\nFiles are being monitored (${mode})... Press Ctrl+C to stop.`));

		process.on('SIGINT', () => {
			if (fileWatcher) {
				fileWatcher.dispose();
				console.log(chalk.yellow('\nStopped monitoring all groups.'));
			}
			process.exit(0);
		});
	});

program
	.command('remove')
	.description('Remove a file group')
	.action(async () => {
		const config = configManager.getConfig();
		if (config.groups.length === 0) {
			console.log(chalk.yellow('No groups configured.'));
			return;
		}

		const { groupName } = await inquirer.prompt([
			{
				type: 'list',
				name: 'groupName',
				message: 'Select group to remove:',
				choices: config.groups.map(g => g.name)
			}
		]);

		const group = configManager.getGroup(groupName);
		if (group && group.gistId) {
			if (!config.githubToken) {
				console.log(chalk.red('GitHub token not configured. Please run `gist-sync config` first.'));
				return;
			}

			gistManager = new GistManager(config.githubToken);
			try {
				await gistManager.deleteGist(group.gistId);
			} catch (error) {
				console.error(chalk.red('Error deleting gist:'), error);
			}
		}

		configManager.removeGroup(groupName);
		console.log(chalk.green(`Group "${groupName}" removed successfully!`));
	});

program.parse(); 