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
        const needed = columnWidths[i] - len;
        return `${cell}${" ".repeat(needed)}`;
      })
      .join(tableChars.middle);
  }
  
  function table(data, properties, grouper = "") {
      let output = "";
      const reorderedProperties = properties.filter(
        (property) => property !== grouper
      );
      if (grouper) {
        reorderedProperties.unshift(grouper);
      }
    
      const columnWidths = calculateColumnWidths(data, reorderedProperties);
    
      output += "┌";
      reorderedProperties.forEach((property, index) => {
        output += "─".repeat(columnWidths[index] + 2) + "┬";
      });
      output = output.slice(0, -1) + "┐\n";
    
      output += "│";
      reorderedProperties.forEach((property, index) => {
        output += ` ${property.padEnd(columnWidths[index], " ")} │`;
      });
      output += "\n";
    
      output += "├";
      reorderedProperties.forEach((_, index) => {
        output += "─".repeat(columnWidths[index] + 2) + "┼";
      });
      output = output.slice(0, -1) + "┤\n";
    
      const groupedData = groupDataBy(data, grouper);
    
      const groups = Object.keys(groupedData);
    
      groups.forEach((group, groupIndex) => {
        const groupData = groupedData[group];
        let isFirstInGroup = true;
    
        groupData.forEach((item) => {
          output += "│";
    
          reorderedProperties.forEach((property, index) => {
            let value;
            if (!isFirstInGroup && property === grouper) {
              value = " ".repeat(columnWidths[index]);
            } else {
              value = item[property];
              isFirstInGroup = false;
            }
            output += ` ${value.toString().padEnd(columnWidths[index], " ")} │`;
          });
          output += "\n";
        });
    
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
    
      return output;
    }
    
  
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
          properties[index].toString().length
        );
      });
    });
    return columnWidths;
  }
  
  module.exports = { table };
  