let ignoreSubpaths = [
    { value: '^\\.', label: '.' },
    { value: '.git', label: '.git' },
    { value: 'node_modules', label: 'node_modules' },
    { value: '.idea', label: '.idea' },
    { value: 'dist', label: 'dist' }

];

let commonExtensions = [
    { value: '.js', label: '.js' },
    { value: '.py', label: '.py' },
    { value: '.java', label: '.java' },
    { value: '.cpp', label: '.cpp' },
    { value: '.html', label: '.html' },
    { value: '.css', label: '.css' },
    { value: '.ts', label: '.ts' },
    { value: '.jsx', label: '.jsx' },
    { value: '.tsx', label: '.tsx' },
    { value: '.cc', label: '.cc' },
    { value: '.h', label: '.h' }
];
function generateCheckboxes(containerId, items, className, title) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id ${containerId} not found`);
        return;
    }
    container.innerHTML = `
        <label class="block text-sm font-medium text-gray-600 mb-2">${title}:</label>
        <div class="grid grid-cols-3 gap-2">
            ${items.map(item => `
                <label class="inline-flex items-center">
                    <input type="checkbox" class="${className} form-checkbox h-5 w-5 text-blue-600" value="${item.value}" ${item.checked ? 'checked' : ''}>
                    <span class="ml-2 text-gray-700">${item.label}</span>
                    ${!item.preset ? `<button type="button" class="ml-2 text-red-500 delete-item" data-value="${item.value}">X</button>` : ''}
                </label>
            `).join('')}
        </div>
    `;

    container.querySelectorAll('.delete-item').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const valueToRemove = this.getAttribute('data-value');
            if (className === 'ignore-subpath') {
                ignoreSubpaths = ignoreSubpaths.filter(item => item.value !== valueToRemove);
                saveIgnoreSubpaths();
                generateCheckboxes('ignore-subpaths-container', ignoreSubpaths, 'ignore-subpath', 'Ignore subpaths');
            } else if (className === 'common-extension') {
                commonExtensions = commonExtensions.filter(item => item.value !== valueToRemove);
                saveCommonExtensions();
                generateCheckboxes('common-extensions-container', commonExtensions, 'common-extension', 'Common file extensions');
            }
        });
    });
}

function loadIgnoreSubpaths() {
    const savedIgnoreSubpaths = JSON.parse(localStorage.getItem('ignoreSubpaths'));

    if (savedIgnoreSubpaths && savedIgnoreSubpaths.length > 0) {
        // 用户之前有设置或勾选，使用保存的设置
        ignoreSubpaths = ignoreSubpaths.map(item => {
            const savedItem = savedIgnoreSubpaths.find(saved => saved.value === item.value);
            return {
                ...item,
                checked: savedItem ? savedItem.checked : false
            };
        });

        // 添加用户自定义的 subpaths
        savedIgnoreSubpaths.forEach(saved => {
            if (!ignoreSubpaths.some(item => item.value === saved.value)) {
                ignoreSubpaths.push({...saved, preset: false});
            }
        });
    } else {
        // 用户从未设置过，预设的 subpaths 全选
        ignoreSubpaths = ignoreSubpaths.map(item => ({...item, checked: true}));
    }

    generateCheckboxes('ignore-subpaths-container', ignoreSubpaths, 'ignore-subpath', 'Ignore subpaths');
}

function loadCommonExtensions() {
    const savedExtensions = JSON.parse(localStorage.getItem('commonExtensions'));

    if (savedExtensions && savedExtensions.length > 0) {
        commonExtensions = commonExtensions.map(item => {
            const savedItem = savedExtensions.find(saved => saved.value === item.value);
            return {
                ...item,
                checked: savedItem ? savedItem.checked : false
            };
        });

        savedExtensions.forEach(saved => {
            if (!commonExtensions.some(item => item.value === saved.value)) {
                commonExtensions.push({...saved, preset: false});
            }
        });
    } else {
        commonExtensions = commonExtensions.map(item => ({...item, checked: true}));
    }

    generateCheckboxes('common-extensions-container', commonExtensions, 'common-extension', 'Common file extensions');
}

function saveCommonExtensions() {
    localStorage.setItem('commonExtensions', JSON.stringify(commonExtensions));
}

function saveIgnoreSubpaths() {
    const checkedSubpaths = Array.from(document.querySelectorAll('.ignore-subpath:checked')).map(cb => cb.value);
    console.log('saveIgnoreSubpaths', checkedSubpaths);
    const savedSubpaths = ignoreSubpaths.map(item => ({
        value: item.value,
        label: item.label,
        preset: item.preset,
        checked: checkedSubpaths.includes(item.value)
    }));
    console.log(savedSubpaths);
    localStorage.setItem('ignoreSubpaths', JSON.stringify(savedSubpaths));
    return checkedSubpaths;
}


document.getElementById('repoForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const path = document.getElementById('path').value || '';

    const outputText = document.getElementById('outputText');
    outputText.value = '';

    try {
        const tree = await fetchRepoTree(path);
        displayDirectoryStructure(tree.tree);
        document.getElementById('generateTextButton').style.display = 'flex';
    } catch (error) {
        outputText.value = `Error fetching directory contents: ${error.message}\n\nPlease ensure:\n1. The path is correct and accessible.\n2. You have the necessary permissions to access the directory.`;
    }
});

document.getElementById('generateTextButton').addEventListener('click', async function () {
    const outputText = document.getElementById('outputText');
    outputText.value = '';

    try {
        const selectedFiles = getSelectedFiles();
        if (selectedFiles.length === 0) {
            throw new Error('No files selected');
        }
        const fileContents = await fetchFileContents(selectedFiles);
        const formattedText = formatRepoContents(fileContents);
        outputText.value = formattedText;

        document.getElementById('copyButton').style.display = 'flex';
        document.getElementById('downloadButton').style.display = 'flex';
    } catch (error) {
        outputText.value = `Error generating text file: ${error.message}\n\nPlease ensure:\n1. You have selected at least one file from the directory structure.\n2. You have a stable internet connection.\n3. The server is accessible and functioning normally.`;
    }
});

document.getElementById('copyButton').addEventListener('click', function () {
    const outputText = document.getElementById('outputText');
    outputText.select();
    navigator.clipboard.writeText(outputText.value).then(() => {
        console.log('Text copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
});

document.getElementById('downloadButton').addEventListener('click', function () {
    const outputText = document.getElementById('outputText').value;
    if (!outputText.trim()) {
        document.getElementById('outputText').value = 'Error: No content to download. Please generate the text file first.';
        return;
    }
    const blob = new Blob([outputText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
});

async function fetchRepoTree(path = '') {
    const ignoreSubpaths = saveIgnoreSubpaths();
    const url = `/trees?path=${encodeURIComponent(path)}&ignore=${encodeURIComponent(JSON.stringify(ignoreSubpaths))}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch directory tree. Status: ${response.status}. Please check your input and try again.`);
    }
    return await response.json();
}

async function fetchFileContents(files) {
    const contents = await Promise.all(files.map(async file => {
        const response = await fetch(file.url);
        if (!response.ok) {
            throw new Error(`Failed to fetch content for ${file.path}. Status: ${response.status}. Please check your permissions and try again.`);
        }
        const text = await response.text();
        return { url: file.url, path: file.path, text };
    }));
    return contents;
}

function displayDirectoryStructure(tree) {
    tree = tree.filter(item => item.type === 'blob');
    tree = sortContents(tree);
    const container = document.getElementById('directoryStructure');
    container.innerHTML = '';
    const rootUl = document.createElement('ul');
    container.appendChild(rootUl);

    const directoryStructure = {};

    tree.forEach(item => {
        item.path = item.path.startsWith('/') ? item.path : '/' + item.path;
        const pathParts = item.path.split('/');
        let currentLevel = directoryStructure;

        pathParts.forEach((part, index) => {
            if (part === '') {
                part = './';
            }
            if (!currentLevel[part]) {
                currentLevel[part] = index === pathParts.length - 1 ? item : {};
            }
            currentLevel = currentLevel[part];
        });
    });

    function createTreeNode(name, item, parentUl) {
        const li = document.createElement('li');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        // const commonExtensions = ['.js', '.py', '.java', '.cpp', '.html', '.css', '.ts', '.jsx', '.tsx', '.cc', '.h'];
        const checkedExtensions = commonExtensions.filter(ext => ext.checked).map(ext => ext.value);

        const fileName = name.toLowerCase();
        const isCommonFile = checkedExtensions.some(ext => fileName.endsWith(ext));
        checkbox.checked = isCommonFile;
        checkbox.className = 'mr-2';

        if (typeof item === 'object' && (!item.type || typeof item.type !== 'string')) {
            // Directory
            checkbox.classList.add('directory-checkbox');
            li.appendChild(checkbox);

            // Add collapse/expand button
            const collapseButton = document.createElement('button');
            collapseButton.innerHTML = '<i data-lucide="chevron-down" class="w-4 h-4"></i>';
            collapseButton.className = 'mr-1 focus:outline-none';
            li.appendChild(collapseButton);

            const folderIcon = document.createElement('i');
            folderIcon.setAttribute('data-lucide', 'folder');
            folderIcon.className = 'inline-block w-4 h-4 mr-1';
            li.appendChild(folderIcon);
            li.appendChild(document.createTextNode(name));
            const ul = document.createElement('ul');
            ul.className = 'ml-6 mt-2';
            li.appendChild(ul);

            for (const [childName, childItem] of Object.entries(item)) {
                createTreeNode(childName, childItem, ul);
            }

            checkbox.addEventListener('change', function() {
                const childCheckboxes = li.querySelectorAll('input[type="checkbox"]');
                childCheckboxes.forEach(childBox => {
                    childBox.checked = this.checked;
                    childBox.indeterminate = false;
                });
            });

            // Add collapse/expand functionality
            collapseButton.addEventListener('click', function() {
                ul.classList.toggle('hidden');
                const icon = this.querySelector('[data-lucide]');
                if (ul.classList.contains('hidden')) {
                    icon.setAttribute('data-lucide', 'chevron-right');
                } else {
                    icon.setAttribute('data-lucide', 'chevron-down');
                }
                lucide.createIcons();
            });
        } else {
            // File
            checkbox.value = JSON.stringify({ url: item.url, path: item.path });
            li.appendChild(checkbox);
            const fileIcon = document.createElement('i');
            fileIcon.setAttribute('data-lucide', 'file');
            fileIcon.className = 'inline-block w-4 h-4 mr-1';
            li.appendChild(fileIcon);
            li.appendChild(document.createTextNode(name));
        }

        li.className = 'my-2';
        parentUl.appendChild(li);
        updateParentCheckbox(checkbox);
    }

    for (const [name, item] of Object.entries(directoryStructure)) {
        createTreeNode(name, item, rootUl);
    }
    // Add event listener to container for checkbox changes
    container.addEventListener('change', function(event) {
        if (event.target.type === 'checkbox') {
            updateParentCheckbox(event.target);
        }
    });

    function updateParentCheckbox(checkbox) {
        if (!checkbox) return;
        const li = checkbox.closest('li');
        if (!li) return;
        if (!li.parentElement) return;
        const parentLi = li.parentElement.closest('li');
        if (!parentLi) return;

        const parentCheckbox = parentLi.querySelector(':scope > input[type="checkbox"]');
        const siblingCheckboxes = parentLi.querySelectorAll(':scope > ul > li > input[type="checkbox"]');

        const checkedCount = Array.from(siblingCheckboxes).filter(cb => cb.checked).length;
        const indeterminateCount = Array.from(siblingCheckboxes).filter(cb => cb.indeterminate).length;

        if (indeterminateCount !== 0) {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = true;
        } else if (checkedCount === 0) {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = false;
        } else if (checkedCount === siblingCheckboxes.length) {
            parentCheckbox.checked = true;
            parentCheckbox.indeterminate = false;
        } else {
            parentCheckbox.checked = false;
            parentCheckbox.indeterminate = true;
        }

        // Recursively update parent checkboxes
        updateParentCheckbox(parentCheckbox);
    }

    lucide.createIcons();
}

function getSelectedFiles() {
    const checkboxes = document.querySelectorAll('#directoryStructure input[type="checkbox"]:checked:not(.directory-checkbox)');
    return Array.from(checkboxes).map(checkbox => JSON.parse(checkbox.value));
}

function formatRepoContents(contents) {
    let text = '';
    let index = '';

    contents = sortContents(contents);

    // Create a directory tree structure
    const tree = {};
    contents.forEach(item => {
        const parts = item.path.split('/');
        let currentLevel = tree;
        parts.forEach((part, i) => {
            if (!currentLevel[part]) {
                currentLevel[part] = i === parts.length - 1 ? null : {};
            }
            currentLevel = currentLevel[part];
        });
    });

    // Function to recursively build the index
    function buildIndex(node, prefix = '') {
        let result = '';
        const entries = Object.entries(node);
        entries.forEach(([name, subNode], index) => {
            const isLastItem = index === entries.length - 1;
            const linePrefix = isLastItem ? '└── ' : '├── ';
            const childPrefix = isLastItem ? '    ' : '│   ';

            if (name === '') {
                name = './';
            }

            result += `${prefix}${linePrefix}${name}\n`;
            if (subNode) {
                result += buildIndex(subNode, `${prefix}${childPrefix}`);
            }
        });
        return result;
    }

    index = buildIndex(tree);

    contents.forEach((item) => {
        text += `\n\n---\nFile: ${item.path}\n---\n\n${item.text}\n`;
    });

    return `Directory Structure:\n\n${index}\n${text}`;
}

function sortContents(contents) {
    contents.sort((a, b) => {
        const aPath = a.path.split('/');
        const bPath = b.path.split('/');
        const minLength = Math.min(aPath.length, bPath.length);

        for (let i = 0; i < minLength; i++) {
            if (aPath[i] !== bPath[i]) {
                if (i === aPath.length - 1 && i < bPath.length - 1) return 1; // a is a directory, b is a file or subdirectory
                if (i === bPath.length - 1 && i < aPath.length - 1) return -1;  // b is a directory, a is a file or subdirectory
                return aPath[i].localeCompare(bPath[i]);
            }
        }

        return aPath.length - bPath.length;
    });
    return contents;
}

document.addEventListener('DOMContentLoaded', function() {
    lucide.createIcons();

    loadIgnoreSubpaths();
    loadCommonExtensions();


    const addCommonExtensionButton = document.getElementById('add-common-extension');
    const newCommonExtensionInput = document.getElementById('new-common-extension');

    addCommonExtensionButton.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('addCommonExtensionButton clicked');
        const newExtension = newCommonExtensionInput.value.trim();
        if (newExtension && !commonExtensions.some(item => item.value === newExtension)) {
            commonExtensions.push({
                value: newExtension,
                label: newExtension,
                preset: false,
                checked: true
            });
            newCommonExtensionInput.value = '';
            saveCommonExtensions();
            generateCheckboxes('common-extensions-container', commonExtensions, 'common-extension', 'Common file extensions');
        }
    });

    document.getElementById('common-extensions-container').addEventListener('change', function(e) {
        if (e.target.classList.contains('common-extension')) {
            const value = e.target.value;
            const index = commonExtensions.findIndex(item => item.value === value);
            if (index !== -1) {
                commonExtensions[index].checked = e.target.checked;
                saveCommonExtensions();
            }
        }
    });

    const addIgnoreSubpathButton = document.getElementById('add-ignore-subpath');
    const newIgnoreSubpathInput = document.getElementById('new-ignore-subpath');

    addIgnoreSubpathButton.addEventListener('click', function(e) {
        e.preventDefault(); // Prevent form submission
        const newSubpath = newIgnoreSubpathInput.value.trim();
        if (newSubpath && !ignoreSubpaths.some(item => item.value === newSubpath)) {
            ignoreSubpaths.push({
                value: newSubpath,
                label: newSubpath,
                preset: false,
                checked: true  // 设置为 true，使新添加的 subpath 默认选中
            });
            newIgnoreSubpathInput.value = '';
            generateCheckboxes('ignore-subpaths-container', ignoreSubpaths, 'ignore-subpath', 'Ignore subpaths');
            saveIgnoreSubpaths();
        }
    });


    // Add event listener for the showMoreInfo button
    // const showMoreInfoButton = document.getElementById('showMoreInfo');

    showMoreInfoButton.addEventListener('click', function() {
        tokenInfo.classList.toggle('hidden');

        // Change the icon based on the visibility state
        const icon = this.querySelector('[data-lucide]');
        if (icon) {
            if (tokenInfo.classList.contains('hidden')) {
                icon.setAttribute('data-lucide', 'info');
            } else {
                icon.setAttribute('data-lucide', 'x');
            }
            lucide.createIcons();
        }
    });
});