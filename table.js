class TableRenderer {
    static isSet(obj) {
      return obj instanceof Set;
    }
  
    static isMap(obj) {
      return obj instanceof Map;
    }
  
    static isSetIterator(obj) {
      return obj.__proto__ === new Set()[Symbol.iterator]().__proto__;
    }
  
    static isMapIterator(obj) {
      return obj.__proto__ === new Map()[Symbol.iterator]().__proto__;
    }
  
    static previewEntries(iterator, isMap) {
      const result = [];
      if (isMap) {
        result[1] = true;
        result[0] = [];
      }
      var state = iterator.next();
      if (isMap) {
        while (!state.done) {
          result[0].push(state.value[0], state.value[1]);
          state = iterator.next();
        }
      } else {
        while (!state.done) {
          result.push(state.value);
          state = iterator.next();
        }
      }
      return result;
    }
  }
  
  const hasOwnProperty = Function.call.bind(Object.prototype.hasOwnProperty);
  const colorRegExp = /\u001b\[\d\d?m/g;
  function removeColors(str) {
    return str.replace(colorRegExp, "");
  }
  const tableChars = {
    middleMiddle: "─",
    rowMiddle: "┼",
    topRight: "┐",
    topLeft: "┌",
    leftMiddle: "├",
    topMiddle: "┬",
    bottomRight: "┘",
    fbottomLeft: "└",
    bottomMiddle: "┴",
    rightMiddle: "┤",
    left: "│ ",
    right: " │",
    middle: " │ ",
  };
  const countSymbols = (string) => removeColors(string).length;
  
  function renderRow(row, columnWidths, properties) {
    return row
      .map((cell, i) => {
        const len = countSymbols(cell);
        const needed = columnWidths[i] - len; // Calculate the number of spaces needed to align to the left
        return `${cell}${" ".repeat(needed)}`; // Add spaces after the cell value
      })
      .join(tableChars.middle);
  }
  
  // nstable.js
  
  // nstable.js
  
  function table(data, properties, grouper = "") {
      let output = "";
      // Reorder properties to ensure the grouped keyword appears first
      const reorderedProperties = properties.filter(
        (property) => property !== grouper
      );
      if (grouper) {
        reorderedProperties.unshift(grouper);
      }
    
      // Calculate the maximum width for each column
      const columnWidths = calculateColumnWidths(data, reorderedProperties);
    
      // Create the header row
      output += "┌";
      reorderedProperties.forEach((property, index) => {
        output += "─".repeat(columnWidths[index] + 2) + "┬";
      });
      output = output.slice(0, -1) + "┐\n";
    
      // Create the header row with property names
      output += "│";
      reorderedProperties.forEach((property, index) => {
        output += ` ${property.padEnd(columnWidths[index], " ")} │`;
      });
      output += "\n";
    
      // Create separator row
      output += "├";
      reorderedProperties.forEach((_, index) => {
        output += "─".repeat(columnWidths[index] + 2) + "┼";
      });
      output = output.slice(0, -1) + "┤\n";
    
      // Group data if a grouper is provided
      const groupedData = groupDataBy(data, grouper);
    
      // Get the list of groups
      const groups = Object.keys(groupedData);
    
      // Iterate over each group
      groups.forEach((group, groupIndex) => {
        const groupData = groupedData[group];
        let isFirstInGroup = true;
    
        // Iterate over each item in the group
        groupData.forEach((item) => {
          output += "│";
    
          // Iterate over each property
          reorderedProperties.forEach((property, index) => {
            let value;
            if (!isFirstInGroup && property === grouper) {
              value = " ".repeat(columnWidths[index]); // Repeat spaces based on group length
            } else {
              value = item[property];
              isFirstInGroup = false;
            }
            output += ` ${value.toString().padEnd(columnWidths[index], " ")} │`;
          });
          output += "\n";
        });
    
        // Add a separator row after each group except the last one
        if (groupIndex !== groups.length - 1) {
          output += "├";
          reorderedProperties.forEach((_, index) => {
            output += "─".repeat(columnWidths[index] + 2) + "┼";
          });
          output = output.slice(0, -1) + "┤\n";
        } else {
          output += "└";
          reorderedProperties.forEach((_, index) => {
            output += "─".repeat(columnWidths[index] + 2) + "┴";
          });
          output = output.slice(0, -1) + "┘\n";
        }
      });
    
      // Return the final table
      return output;
    }
    
    // Rest of the code remains unchanged
    
  
  function groupDataBy(data, key) {
    if (!key) return { default: data };
    return data.reduce((grouped, item) => {
      const group = item[key];
      if (!grouped[group]) {
        grouped[group] = [];
      }
      grouped[group].push(item);
      return grouped;
    }, {});
  }
  
  function calculateColumnWidths(data, properties) {
    const columnWidths = new Array(properties.length).fill(0);
    data.forEach((item) => {
      properties.forEach((property, index) => {
        columnWidths[index] = Math.max(
          columnWidths[index],
          item[property].toString().length,
          properties[index].toString().length // Consider the length of keys as well
        );
      });
    });
    return columnWidths;
  }
  
  module.exports = { table };
  