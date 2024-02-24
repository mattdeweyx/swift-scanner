#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const { table } = require("./nstable");

let allComponents = {};
let filesScanned = 0;
let totalComponentsFound = 0;
let currentPath = "./";

function getModuleName(filePath) {
    filePath = filePath.replace(/^\.\//, '');
    const keywords = ['.build/checkout/', 'Pods/'];
    for (const keyword of keywords) {
        if (filePath.includes(keyword)) {
            const parts = filePath.split(keyword);
            if (parts.length > 1) {
                const moduleName = parts[1].split('/')[0];
                return moduleName || "unknown";
            }
        }
    }
    return "unknown";
}

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
                const componentType = component["key.kind"];
                const name = component["key.name"];
                const path = filePath;
                const moduleName = getModuleName(path);
                const thirdParty = isThirdParty(path);
                components.push({
                    name,
                    path,
                    moduleName,
                    type: componentType,
                    thirdParty
                });
            }
        });
    }
    return components;
}

async function update(fileName) {
    try {
        if (filesScanned < 5) {
            process.stdout.cursorTo(0);
        }
        const components = await extractPublicComponents(fileName);
        updateAllComponents(components);
        updateFilesScanned(components);
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
            console.log("Scanning directories:\n\n");
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

async function main() {
    try {
        await scanDirectory();
        console.log("\nScanning completed successfully.");
        const reportData = createReportData(allComponents);
        await writeResults("results.json", allComponents);
        await writeResults("report.json", reportData);
        console.log("Report Table:\n");
        const report = table(reportData, Object.keys(reportData[0]), "componentType");
        console.log(report);
        await fs.writeFile("report.txt", report);
        console.log(`Results written to report.txt`);
    } catch (error) {
        console.error("An error occurred during scanning:", error.message);
    }
}

// Helper Functions

function isAccessible(accessibility) {
    return accessibility === "source.lang.swift.accessibility.internal" ||
        accessibility === "source.lang.swift.accessibility.public";
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
    Object.keys(components).forEach((kind) => {
        allComponents[kind] = allComponents[kind]
            ? allComponents[kind].concat(components[kind])
            : components[kind];
    });
}

function updateFilesScanned(components) {
    filesScanned++;
}

function updateTotalComponentsFound(components) {
    totalComponentsFound += Object.values(components).reduce(
        (total, current) => total + current.length, 0
    );
}

function clearConsole() {
    clearLines(4);
}

function clearLines(n) {
    for (let i = 0; i < n; i++) {
        const y = i === 0 ? null : -1;
        process.stdout.moveCursor(0, y);
        process.stdout.clearLine(1);
    }
}

function displayProgress() {
    process.stdout.write(
        `\nCurrent Path     : ${currentPath}\nFiles scanned    : ${filesScanned}\nComponents found : ${totalComponentsFound}`
    );
}

function createReportData(allComponents) {
    const reportData = [];
    Object.keys(allComponents).forEach((kind) => {
        allComponents[kind].forEach((component) => {
            reportData.push({ componentType: kind, componentName: component.name });
        });
    });
    return reportData;
}

async function writeResults(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Error writing results to ${filePath}:`, error.message);
    }
}

main();
