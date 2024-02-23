const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { table } = require('./nstable');


// Store all scanned components
let allComponents = {};

// Store the number of files scanned
let filesScanned = 0;

// Store the total number of components found
let totalComponentsFound = 0;

// Store the current path
let currentPath = './';

// Extracts public components from a Swift file
async function extractPublicComponents(filePath) {
  return new Promise((resolve, reject) => {
    const command = `sourcekitten structure --file "${filePath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(`Error executing command: ${error.message}`);
        return;
      }
      if (stderr) {
        reject(`Command error: ${stderr}`);
        return;
      }
      let jsonData;
      try {
        jsonData = JSON.parse(stdout);
      } catch (parseError) {
        reject(`Error parsing JSON: ${parseError}`);
        return;
      }
      const components = {};
      if (jsonData['key.substructure']) {
        jsonData['key.substructure'].forEach(component => {
          if (component['key.accessibility'] === 'source.lang.swift.accessibility.public') {
            // Extract the last part of the component type
            let typeParts = component['key.kind'];
            let componentType = typeParts.replace('source.lang.swift.decl.', '');
            const name = component['key.name'];
            const path = filePath; // Path to the file
            if (!components[componentType]) {
              components[componentType] = [];
            }
            components[componentType].push({ name, path }); // Push an object with name and path
          }
        });
      }
      resolve(components);
    });
  });
}

// Updates the list of components with those found in a file
async function update(fileName) {
    try {
        
      if (filesScanned<5) {
        process.stdout.cursorTo(0);
      }
      const components = await extractPublicComponents(fileName);
      Object.keys(components).forEach(kind => {
        allComponents[kind] = allComponents[kind] ? allComponents[kind].concat(components[kind]) : components[kind];
      });
      filesScanned++;
      totalComponentsFound += Object.values(components).reduce((total, current) => total + current.length, 0);
      
      // Clear multiple lines from the console
      clearLines(4); // Adjust the number of lines to clear as needed
  
      // Write the updated information
      process.stdout.write(`\nCurrent Path     : ${currentPath}\nFiles scanned    : ${filesScanned}\nComponents found : ${totalComponentsFound}`);
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Add a delay of 100 milliseconds
    } catch (error) {
      console.error(`Error updating components from ${fileName}:`, error.message);
    } finally {
    }
  }
  
  // Function to clear multiple lines from the console
  const clearLines = (n) => {
    for (let i = 0; i < n; i++) {
      // First clear the current line, then clear the previous line
      const y = i === 0 ? null : -1;
      process.stdout.moveCursor(0, y);
      process.stdout.clearLine(1);
    }
  }
  

// Recursively scans a directory for Swift files
async function scanDirectory(directoryPath = ".", depth = 0) {
  try {
    if (!depth) {
      console.log('Scanning directories:\n\n');
      depth++;
    }
    currentPath = directoryPath; // Update the current path
    const files = await fs.readdir(directoryPath);
    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);
      if (stats.isDirectory()) {
        if (depth === 0) {
          console.log("    ", filePath);
        }
        await scanDirectory(filePath, depth);
      } else if (filePath.endsWith('.swift')) {
        await update(filePath);
      }
    }
  } catch (error) {
    console.error('Error scanning directory:', error.message);
  }
}

// Main function orchestrating the scanning process
async function main() {
  try {
    await scanDirectory();
    console.log('\nScanning completed successfully.');
    const reportData = createReportData(allComponents);
    await writeResults('results.json', allComponents);
    await writeResults('report.json', reportData);
    console.log('Report Table:\n');
    const report = table(reportData, Object.keys(reportData[0]), "componentType");
    console.log(report);
    await fs.writeFile('report.txt', report);
    console.log(`Results written to report.txt`);
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
  } catch (error) {
    console.error(`Error writing results to ${filePath}:`, error.message);
  }
}

// Start the scanning process
main();
