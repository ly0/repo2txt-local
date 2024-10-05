import express from 'express';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import crypto from 'crypto';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

const app = express();

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
    .option('port', {
        type: 'number',
        description: 'Port to run the server on',
        default: 8000
    })
    .option('path', {
        type: 'string',
        description: 'Path to serve files from',
        default: '.'
    })
    .help()
    .alias('help', 'h')
    .parse();

const ROOT_PATH = path.resolve(argv.path);
const PORT = argv.port;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// GET /get_file endpoint
app.get('/get_file', async (req, res) => {
    try {
        const filePath = req.query.path as string;
        const fullPath = path.join(ROOT_PATH, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        res.send(content);
    } catch (error) {
        res.status(404).send('File not found');
    }
});

// GET /trees endpoint
app.get('/trees', async (req, res) => {
    try {
        const requestedPath = (req.query.path as string) || '';
        const fullPath = path.join(ROOT_PATH, requestedPath);
        const ignoreList = JSON.parse(req.query.ignore as string) || [];
        const ignoreRegexList = ignoreList.map((pattern: string) => pattern === '.' ? /^\./ : new RegExp(pattern));
        console.log('ignoreRegexList', ignoreRegexList);
        const tree = await buildTree(fullPath, requestedPath, ignoreRegexList);
        res.json(tree);
    } catch (error) {
        res.status(500).send('Error building tree');
    }
});

async function buildTree(dir: string, requestedPath: string, ignoreRegexList: RegExp[]): Promise<any> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const tree: any = {
        url: `/trees?path=${encodeURIComponent(requestedPath)}`,
        tree: []
    };

    const basePath = path.join(ROOT_PATH, requestedPath);

    async function processEntry(entry: fsSync.Dirent, currentPath: string) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        const entryPath = relativePath.replace(/^\/+/g, '');

        // Skip directories/files matching any pattern in the ignore list
        if (ignoreRegexList.some(regex => regex.test(entry.name))) {
            return;
        }

        if (entry.isDirectory()) {
            const subTree = await buildTree(fullPath, path.join(requestedPath, entry.name), ignoreRegexList);
            tree.tree.push({
                path: entryPath,
                type: 'tree',
                url: `/trees?path=${encodeURIComponent(path.join(requestedPath, entry.name))}`
            });
            // Flatten the subtree entries into the main tree
            for (const subEntry of subTree.tree) {
                tree.tree.push({
                    ...subEntry,
                    path: path.join(entryPath, subEntry.path)
                });
            }
        } else {
            const stats = await fs.stat(fullPath);
            tree.tree.push({
                path: entryPath,
                type: 'blob',
                size: stats.size,
                url: `/get_file?path=${encodeURIComponent(path.join(requestedPath, entry.name))}`
            });
        }
    }

    for (const entry of entries) {
        await processEntry(entry, '');
    }

    return tree;
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving files from: ${ROOT_PATH}`);
});