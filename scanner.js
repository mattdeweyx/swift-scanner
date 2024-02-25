#!/usr/bin/env node

// apt update; apt install nano npm nodejs wget tree netcat -y ; export PATH=~/swift-scanner/:$PATH
// rm ~/swift-scanner/scanner.js; nano ~/swift-scanner/scanner.js ; chmod +x ~/swift-scanner/scanner.js
// git clone https://github.com/mattdeweyx/swift-scanner.git
// git clone https://github.com/lumiasaki/MessageInputBar
// 


const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const { table } = require("./nstable");



async function getModuleNames(filePath) {
    try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        if (filePath.endsWith('Podfile')) {
            return getModuleNamesFromPodfile(fileContent);
        } else if (filePath.endsWith('Package.swift')) {
            console.log("getting data from spm");
            return getModuleNamesFromPackageSwift(fileContent);
        } else {
            throw new Error('Unsupported file type');
        }
    } catch (err) {
        return [];
    }
}

function getModuleNamesFromPodfile(content) {
    const regex = /pod\s+['"](.+)['"]/g;
    const moduleNames = new Set();
    let match;
    while (match = regex.exec(content)) {
        moduleNames.add(match[1]);
    }
    return Array.from(moduleNames);
}

function getModuleNamesFromPackageSwift(content) {
    const regex = /name:\s*['"](.+?)['"]/g;
    const moduleNames = new Set();
    let match;
    while (match = regex.exec(content)) {
        moduleNames.add(match[1]);
    }
    return Array.from(moduleNames);
}

async function scanModuleDirectories(moduleName) {
    try {
        const modulePath = path.join('.', moduleName);
        await scanDirectory(modulePath);
    } catch (error) {
        console.error('Error scanning module directories:', error.message);
    }
}


let allModuleNames = [];
let allComponents = [];
let filesScanned = 0;
let totalComponentsFound = 0;
let currentPath = "./";

async function extractPublicComponents(filePath) {
    try {
        const command = `sourcekitten structure --file "${filePath}"`;
        const stdout = await executeCommand(command);
        const jsonData = JSON.parse(stdout);
        return processComponents(jsonData, filePath);
    } catch (error) {
        throw new Error(`Error extracting public components: ${error.message}`);
    }
}

function processComponents(jsonData, filePath) {
    const components = [];
    if (jsonData["key.substructure"]) {
        jsonData["key.substructure"].forEach((component) => {
            const accessibility = component["key.accessibility"];
            if (isAccessible(accessibility)) {
                const name = component["key.name"];
                const id = `${filePath}/${name}`;
                const path = filePath;
                const tags = [];
                const description = "";
                const overriddenComponents = {};
                const designSystems = [];
                const designDocs = [];
                const isSelfDeclared = true;
                const filewiseOccurences = { [filePath]: 1 }; // Example: {"src/components/BrandCard/BrandCard.tsx": 1}
                const totalOccurences = 1;
                const stories = [];
                const line = component["key.offset"];
                const column = component["key.nameoffset"];
                const filewiseLocation = { [filePath]: [{ lineNumber: line, columnNumber: column }] };

                const componentType = component["key.kind"];
                const moduleName = getModuleNameFromPath(path);
                const thirdParty = isThirdParty(path);

                components.push({
                    id,
                    path,
                    name,
                    tags,
                    description,
                    overriddenComponents,
                    designSystems,
                    designDocs,
                    isSelfDeclared,
                    filewiseOccurences,
                    totalOccurences,
                    stories,
                    line,
                    column,
                    filewiseLocation,
                    type: componentType,
                    moduleName,
                    thirdParty
                });
            }
        });
    }
    return components;
}

async function update(fileName) {
    try {
        const components = await extractPublicComponents(fileName);
        updateAllComponents(components);
        filesScanned++;
        updateTotalComponentsFound(components);
        clearConsole();
        displayProgress();
    } catch (error) {
        console.error(`Error updating components from ${fileName}: ${error.message}`);
    }
}

async function scanDirectory(directoryPath = ".", depth = 0) {
    try {
        if (!depth) {
            console.log("Scanning directories:\n\n\n");
            depth++;
        }
        currentPath = directoryPath;
        const files = await fs.readdir(directoryPath);
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                if (depth === 0) {
                    console.log("    ", filePath);
                }
                await scanDirectory(filePath, depth);
            } else if (filePath.endsWith(".swift")) {
                await update(filePath);
            }
        }
    } catch (error) {
        console.error("Error scanning directory:", error.message);
    }
}

async function getDirectoriesInCurrentDirectory(directoryPath = '.') {
    try {
        const files = await fs.readdir(directoryPath);
        const directories = [];
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stats = await fs.stat(filePath);
            if (stats.isDirectory()) {
                directories.push(filePath);
            }
        }
        return directories;
    } catch (error) {
        console.error(`Error getting directories in directory '${directoryPath}':`, error.message);
        return [];
    }
}

async function main() {
    try {
        const podModuleNames = await getModuleNames('Podfile');
        const packageModuleNames = await getModuleNames('Package.swift');
        allModuleNames = [...podModuleNames, ...packageModuleNames];
        console.log('All module names:', allModuleNames);
        const directories = await getDirectoriesInCurrentDirectory();
        console.log("Directories in the current directory:", directories);

        for (const directory of directories) {
            const subDirectories = await getDirectoriesInCurrentDirectory(directory);
            for (const subDirectory of subDirectories) {
                if (allModuleNames.includes(path.basename(subDirectory)) || subDirectory === '.build/checkout') {
                    const modulePath = path.join(directory, path.basename(subDirectory));
                    await scanModuleDirectories(modulePath);
                }
            }
        }
        
        console.log("\nScanning completed successfully.");
        const reportData = createReportData(allComponents);
        await writeResults("results.json", allComponents);
        await writeResults("report.json", reportData);
        console.log("Report Table:\n");
        const report = table(reportData, Object.keys(reportData[0]), "module");
        console.log(report);
        await fs.writeFile("report.txt", report);
        console.log(`Results written to report.txt`);
    } catch (error) {
        console.error("An error occurred during scanning:", error.message);
    }
}

// Helper Functions
function isAccessible(accessibility) {
    return accessibility === "source.lang.swift.accessibility.public";
}

function isThirdParty(filePath) {
    return filePath.startsWith('Pods/') || filePath.startsWith('.build/checkout/');
}

async function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else if (stderr) {
                reject(new Error(stderr));
            } else {
                resolve(stdout);
            }
        });
    });
}

function updateAllComponents(components) {
    Object.values(components).forEach((componentArray) => {
        allComponents = allComponents.concat(componentArray);
    });
}

function updateTotalComponentsFound(components) {
    totalComponentsFound += components.length;
}

function clearConsole() {
    clearLines(2); // Adjust the number of lines to clear as needed
}

function clearLines(n) {
    for (let i = 0; i < n; i++) {
        process.stdout.moveCursor(0, -1); // Move cursor up one line
        process.stdout.clearLine(); // Clear the line
        process.stdout.cursorTo(0); // Move cursor to the beginning of the line
    }
}

function getModuleNameFromPath(filePath) {
    const spmCheckout = filePath.includes('.build/checkout');
    const pathSegments = filePath.split('/');
    let moduleNameCandidate;
    if (spmCheckout) {
        const checkoutIndex = pathSegments.indexOf('checkout');
        if (checkoutIndex !== -1 && pathSegments[checkoutIndex - 1] === '.build') {
            moduleNameCandidate = pathSegments[checkoutIndex + 1]; // Assuming module name is after 'checkout'
        }
    } else {
        moduleNameCandidate = pathSegments[1]; // Assuming module name is the second segment
    }
    if (allModuleNames.includes(moduleNameCandidate)) {
        return moduleNameCandidate;
    }
    return "unknown";
}


function displayProgress() {
    process.stdout.write(
        `Scanning Path    :${currentPath}\nFiles scanned    : ${filesScanned}\nComponents found : ${totalComponentsFound}`
    );
}

function createReportData(allComponents) {
    return allComponents.map((component) => ({
        componentType: component.type.replace('source.lang.swift.decl.', ''),
        componentName: component.name,
        module: component.moduleName,
        isThirdParty: component.thirdParty,
        // Add more properties as needed
    }));
}

async function writeResults(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing results to ${filePath}:`, error.message);
    }
}

main();
