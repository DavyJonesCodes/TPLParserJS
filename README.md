# TPLParserJS

<p align="center">
  <img src="https://raw.githubusercontent.com/DavyJonesCodes/TPLParserPy/ff1be2e10922593ffe2949b8927ff6696000ecde/assets/logo.png" alt="Logo" height="128px">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/javascript-323330?style=for-the-badge&logo=javascript&logoColor=F7DF1E" />
  <img src="https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/adobe%20photoshop-%2331A8FF.svg?style=for-the-badge&logo=adobe%20photoshop&logoColor=white"/>
</p>

# 🎨 TPLParserJS

Welcome to **TPLParserJS**! 🛠️ This JavaScript/TypeScript package is designed to help you parse Photoshop TPL (Tool Preset) files and extract the data into a friendly JSON format. Perfect for anyone who wants to dive deep into TPL files and understand their inner workings! 💡

## ✨ Features

- 🔍 **Parse Photoshop TPL files** with ease.
- 🗂️ **Extract tool names, types, and properties** into JSON format.
- 💾 **Save the extracted data** for further use or analysis.

## 🚀 Installation

You can easily install TPLParserJS via npm:

```bash
npm install tpl-parser
```

## 🛠️ Usage

### Importing and Using the Library

Here's a quick example of how to use TPLParserJS in your JavaScript/TypeScript project:

```typescript
import { TPLReader } from "tpl-parser";

const filePath = "path/to/yourfile.tpl";
const reader = new TPLReader(filePath);
const tplData = reader.readTpl();
reader.saveToJson("output.json");
```

### Command-Line Interface

TPLParserJS also includes a handy command-line interface for quick parsing:

```bash
tpl-parser path/to/yourfile.tpl -o output.json
```

## 🤝 Contributions

Contributions are welcome! 🎉 If you'd like to contribute to TPLParserJS, feel free to fork the repository and submit a pull request. If you have any questions or need guidance, don't hesitate to contact me at [devjonescodes@gmail.com](mailto:devjonescodes@gmail.com).

## 📄 License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License. For more details, see the [LICENSE](./LICENSE) file. For commercial use, please contact [Dev Jones](mailto:devjonescodes@gmail.com).

## 📬 Contact

If you have any questions, suggestions, or just want to say hi, feel free to reach out via email: [devjonescodes@gmail.com](mailto:devjonescodes@gmail.com). We'd love to hear from you! 😊
