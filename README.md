# Gist Sync

A CLI tool to sync groups of files with GitHub Gists. Watch multiple files and automatically sync their changes to private gists.

## Features

- Create groups of files to sync together
- Watch files for changes and automatically update gists
- Manage multiple file groups
- Interactive CLI interface
- Secure GitHub token management

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```
3. Build the project:
```bash
npm run build
```
4. Link the package globally (optional):
```bash
npm link
```

## Usage

### Configure GitHub Token

First, you need to configure your GitHub personal access token:

```bash
gist-sync config
```

You'll need to create a token with the `gist` scope at https://github.com/settings/tokens

### Create a File Group

Create a new group of files to sync:

```bash
gist-sync create
```

Follow the interactive prompts to:
1. Enter a group name
2. Add an optional description
3. Add file paths to watch
4. Confirm creation

### List Groups

View all configured file groups:

```bash
gist-sync list
```

### Watch Files

Start watching all configured groups for changes:

```bash
gist-sync watch
```

The tool will watch for changes in all files across all groups and automatically sync them to their respective gists.

### Remove a Group

Remove a file group and optionally delete its associated gist:

```bash
gist-sync remove
```

## Development

- `npm run dev`: Run the CLI in development mode
- `npm run build`: Build the TypeScript code
- `npm start`: Run the built version

## License

ISC 