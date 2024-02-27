const { execSync } = require('child_process');
const Parser = require('tree-sitter');
const Swift = require('tree-sitter-swift');

class SourceKittenHelper {
    constructor() {
        this.parser = new Parser();
        this.parser.setLanguage(Swift);

        this.allComponents = this.getAllComponents();
        this.importableModules = this.getAllModulesToImport();
        this.mainModule = this.getMainModule();
        this.tempFilePath = createTempFile();
    }

    createTempFile(tempFileName=null, content='') {
        if (!this.mainModule) {
            console.error("Main module information not available.");
            return null;
        }
        
        if (!tempFileName) {
            const randomString =  Math.random().toString(36).substring(2);
            const tempFileName = `temp-${randomString}.swift`;
        }
        const tempFilePath = path.join(this.mainModule.path, tempFileName);
        
        try {
            fs.writeFileSync(tempFilePath, content);
            console.log(`Temporary file '${tempFileName}' created at '${tempFilePath}'`);
            return tempFilePath;
        } catch (error) {
            console.error("Error creating temporary file:", error.message);
            return null;
        }
    }

    executeCommand(command) {
        try {
            const output = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 1024 });
            return output;
        } catch (error) {
            console.error("Error:", error.message);
            return null;
        }
    }

    getDependenciesModules() {
        const fs = require('fs');
        if (err) {
            console.error('Error reading file:', err);
            return;
        }
        try {
            const packageJson = JSON.parse(data);
            const moduleNames = packageJson.targets[0].product_dependencies || [];
            const moduleNameString = moduleNames.join(',');
            console.log('Module names:', moduleNameString);
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    }

    traverseAST(node, importedModules) {
        if (node.type === "import_declaration") {
            const importName = node.text.split(' ')[1].trim();
            importedModules.push(importName);
        }
        node.children.forEach(child => this.traverseAST(child, importedModules));
    }

    getImportedModules(code) {
        try {
            const importedModules = [];
            const ast = this.getAst(code);
            this.traverseAST(ast, importedModules);
            return importedModules;
        } catch (error) {
            console.error("Error:", error.message);
            return null;
        }
    }

    getAst(swiftCode) {
        try {
            const tree = this.parser.parse(swiftCode);
            return tree.rootNode;
        } catch (error) {
            console.error("Error:", error.message);
            return null;
        }
    }

    // Method to merge suggestions from all modules into one list
    getAllComponents() {
        console.log("Loading all available components..");
        const allModules = this.getAllModulesToImport();
        if (!allModules) return null;
        const allComponents = {};
    
        allModules.forEach(module => {
            const completionSuggestions = this.getCompletionSuggestions(module);
            if (completionSuggestions) {
                allComponents[module] = completionSuggestions;
            }
        });
    
        return allComponents;
    }
    

    getCompletionSuggestions(libraryName) {
        const importStatement = `import ${libraryName}; ${libraryName}.`;
        const offset = importStatement.length - 1;
        const command = `sourcekitten complete --text "${importStatement}" --offset ${offset} -- -sdk ${this.sdkPath}`;

        try {
            const output = this.executeCommand(command);
            const completionSuggestions = JSON.parse(output);
            const declarationSuggestions = completionSuggestions.filter(suggestion => suggestion.kind.startsWith('source.lang.swift.decl'));
            return declarationSuggestions;
        } catch (error) {
            console.error("Error:", error.message);
            return null;
        }
    }
   
    getMainModule() {
        const command = `swift package describe --type json`;
        
        try {
            const output = this.executeCommand(command);
            const packageJson = JSON.parse(output);
                        
            // Extract module name and its path
            const moduleName = packageJson.name;
            const modulePath = packageJson.targets[0].path;
            return {
                name: moduleName,
                path: modulePath
            };
        } catch (error) {
            console.error("Error:", error.message);
            return null;
        }
    }

    getAllModulesToImport(include="") {
        const command = `sourcekitten complete --file Sources/HelloWorld/main.swift --offset 7 --spm-module HelloWorld -- ""`;
        console.log(command);
        try {
            const output = this.executeCommand(command);
            const completionSuggestions = JSON.parse(output);
            const allModuleNames = completionSuggestions.map(module => module.name);
            return allModuleNames;
        } catch (error) {
            console.error("Error:", error.message);
            return null;
        }
    }
}

// how can i find the right compilerargs for running sourcekitten in my project
//  sourcekitten complete --file Sources/HelloWorld/main.swift --offset 7 --spm-module HelloWorld -- "" > x; ls -l
//sourcekitten complete --text "import Alamofire" --offset 0 -- -module-name Alamofiree -I Sources/
// Example usage
const sdkPath = "/usr/lib/libsourcekitdInProc.so";
const sourceKittenHelper = new SourceKittenHelper(sdkPath);

// Example Swift code
const swiftCode = `
import Alamofire
import Firebasecore
import FirebaseStorage
import Foundation
import Test
`;
