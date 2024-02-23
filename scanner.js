const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { table } = require('./nstable');

// Store all scanned components
let allComponents = {};

// Extracts public components from a Swift file
async function extractPublicComponents(filePath) {
  try {
    const command = `sourcekitten structure --file "${filePath}"`;
    const { stdout, stderr } = await execCommand(command);
    if (stderr) {
      throw new Error(`Command error: ${stderr}`);
    }
    const jsonData = JSON.parse(stdout);
    const components = {};
    if (jsonData['key.substructure']) {
      jsonData['key.substructure'].forEach(component => {
        if (component['key.accessibility'] === 'source.lang.swift.accessibility.public') {
          const kind = component['key.kind'];
          const name = component['key.name'];
          if (!components[kind]) {
            components[kind] = [];
          }
          components[kind].push({ name, path: filePath });
        }
      });
    }
    return components;
  } catch (error) {
    throw new Error(`Error extracting public components from ${filePath}: ${error.message}`);
  }
}

// Updates the list of components with those found in a file
async function update(fileName) {
  try {
    const components = await extractPublicComponents(fileName);
    Object.keys(components).forEach(kind => {
      allComponents[kind] = allComponents[kind] ? allComponents[kind].concat(components[kind]) : components[kind];
    });
  } catch (error) {
    console.error(`Error updating components from ${fileName}:`, error.message);
  }
}

// Recursively scans a directory for Swift files
async function scanDirectory(directoryPath = ".", depth = 0) {
  try {
    if (depth === 0) {
      console.log('Scanning directories:');
    }
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        if (depth === 0) {
          console.log("    ", filePath);
        }
        await scanDirectory(filePath, depth + 1);
      } else if (filePath.endsWith('.swift')) {
        await update(filePath);
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error.message);
  }
}

// Executes a command in the shell and returns the result
async function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { maxBuffer: 1024 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

// Main function orchestrating the scanning process
async function main() {
  try {
    await scanDirectory();
    await writeResults('results.json', allComponents);
    const reportData = createReportData(allComponents);
    await writeResults('report.json', reportData);
    console.log('Scanning completed successfully.');
    console.log('Report Table:\n');
    console.log(table(reportData, Object.keys(reportData[0])));
  } catch (error) {
    console.error('An error occurred during scanning:', error.message);
  }
}

// Converts the components data into a format suitable for reporting
function createReportData(allComponents) {
  const reportData = [];
  Object.keys(allComponents).forEach(kind => {
    allComponents[kind].forEach(component => {
      reportData.push({ componentType: kind, componentName: component.name });
    });
  });
  return reportData;
}

// Writes data to a file 
async function writeResults(filePath, data) {
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`Results written to ${filePath}`);
  } catch (error) {
    console.error(`Error writing results to ${filePath}:`, error.message);
  }
}

// Start the scanning process
main();
