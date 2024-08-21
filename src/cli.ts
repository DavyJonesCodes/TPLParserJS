#!/usr/bin/env node

// src/cli.ts

import { Command } from "commander";
import { TPLReader } from "./tplReader";

const program = new Command();

/**
 * Main function to parse Photoshop TPL files and save the output as JSON.
 */
function main() {
  program
    .name("tpl-parser")
    .description("Parse Photoshop TPL files and save the output as JSON.")
    .argument("<input_file>", "Path to the TPL file to be parsed.")
    .option("-o, --output <output_file>", "Path to save the parsed JSON data. Defaults to 'output.json'.", "output.json")
    .action((inputFile, options) => {
      const tplReader = new TPLReader(inputFile);
      tplReader.readTpl();
      tplReader.saveToJson(options.output);
      console.log(`Parsed TPL data has been saved to ${options.output}`);
    });

  program.parse(process.argv);
}

if (require.main === module) {
  main();
}
