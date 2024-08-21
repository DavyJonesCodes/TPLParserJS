// src/tplReader.ts

import { readFileSync, writeFileSync } from "fs";
import { extractText, extractLabel, extractProperty, validateTplHeader, moveToToolDataSection } from "./utils";

interface ToolData {
  name: string;
  properties: Record<string, any>[];
}

interface TPLData {
  [toolType: string]: ToolData[];
}

/**
 * Class for reading and parsing Photoshop TPL files.
 */
export class TPLReader {
  private filePath: string;
  private tplData: TPLData = {};

  /**
   * Initializes the TPLReader with the path to the TPL file.
   *
   * @param {string} filePath - The path to the TPL file to be read.
   */
  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Reads tool data from the TPL file and extracts relevant properties.
   *
   * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
   * @param {number} offset - The current offset within the Buffer.
   * @returns {[TPLData, number]} - A tuple containing the tool data extracted from the file and the updated offset.
   */
  private readTool(file: Buffer, offset: number): [TPLData, number] {
    const tpl: TPLData = {};

    while (true) {
      // Extract the tool name
      const [toolName, newOffset] = extractText(file, offset);
      offset = newOffset;
      // Skip 10 bytes (typically padding or non-essential data)
      offset += 10;

      // Extract the tool type
      const [toolTypeBuffer, newOffset2] = extractLabel(file, offset);
      const toolType = toolTypeBuffer.toString("ascii").trim();
      offset = newOffset2;

      // Initialize the tool type in the dictionary if not already present
      if (!tpl[toolType]) {
        tpl[toolType] = [];
      }

      // Extract the number of properties and their values
      const count = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
      offset += 4;
      const properties: Record<string, any>[] = [];

      for (let i = 0; i < count; i++) {
        const [property, newOffset3] = extractProperty(file, offset);
        properties.push(property);
        offset = newOffset3;
      }

      // Append the tool data to the dictionary
      tpl[toolType].push({
        name: toolName.split("=").pop() || "",
        properties,
      });

      // Check if there are more tools to read
      if (file.subarray(offset, offset + 4).length !== 4) {
        break;
      }
    }

    return [tpl, offset];
  }

  /**
   * Reads and parses the TPL file.
   *
   * @returns {TPLData} - A dictionary containing the parsed TPL data.
   */
  public readTpl(): TPLData {
    const file = readFileSync(this.filePath);

    // Validate the TPL file header and move the cursor to the tool data section
    const [isValid, offset] = validateTplHeader(file, 0);
    if (!isValid) {
      return {};
    }

    const [moved, newOffset] = moveToToolDataSection(file);
    if (!moved) {
      return {};
    }

    const [tplData] = this.readTool(file, newOffset);
    this.tplData = tplData;
    return this.tplData;
  }

  /**
   * Saves the parsed TPL data to a JSON file.
   *
   * @param {string} outputFile - The path to the JSON file where the data will be saved.
   */
  public saveToJson(outputFile: string): void {
    writeFileSync(outputFile, JSON.stringify(this.tplData, null, 2), { encoding: "utf-8" });
  }
}
