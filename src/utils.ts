// src/utils.ts

import struct from "python-struct";

/**
 * Reads a label from the TPL file.
 *
 * A label is typically a string with a specified length or a fixed 4-byte identifier.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[Buffer, number]} - A tuple where the first element is the label and the second element is the updated offset.
 */
export function extractLabel(file: Buffer, offset: number): [Buffer, number] {
  const labelLength = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
  offset += 4;
  if (labelLength === 0) {
    return [file.subarray(offset, offset + 4), offset + 4];
  }

  return [file.subarray(offset, offset + labelLength), offset + labelLength];
}

/**
 * Extracts a property from the TPL file.
 *
 * This function extracts the label (name) of a property and, if the label is not 'null',
 * it extracts and returns the property's value.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[Record<string, any>, number]} - A tuple where the first element is a dictionary representing the property with its name and value, or an empty object if the label is 'null'. The second element is the updated offset.
 */
export function extractProperty(file: Buffer, offset: number): [Record<string, any>, number] {
  const [propertyName, newOffset] = extractLabel(file, offset);
  offset = newOffset;
  if (propertyName.toString("ascii") !== "null") {
    return extractPropertyValue(file, offset, propertyName);
  }

  return [{}, offset];
}

/**
 * Extracts the value of a property based on its type.
 *
 * This function reads the property type from the file and then extracts the property's value
 * using the appropriate method based on the type.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @param {Buffer} propertyName - The name of the property whose value is to be extracted.
 * @return {[Record<string, any>, number]} - A tuple containing a dictionary with the property's name, type, and value, and the updated offset.
 */
export function extractPropertyValue(file: Buffer, offset: number, propertyName: Buffer): [Record<string, any>, number] {
  const propertyType = file.subarray(offset, offset + 4).toString("ascii");
  offset += 4;

  const [propertyValue, newOffset] = extractOsTypeValue(file, offset, propertyName.toString("ascii").trim(), propertyType);
  // Handle case where propertyValue might be null
  if (propertyValue === null) {
    return [{}, newOffset];
  }

  return [
    {
      [propertyValue.name]: {
        type: propertyValue.os_type,
        value: propertyValue.value,
      },
    },
    newOffset,
  ];
}

/**
 * Extracts data from the TPL file based on the property's type (os_type).
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @param {string} propertyName - The name of the property being extracted.
 * @param {string} propertyType - The type of the property (os_type).
 * @return {[Record<string, any> | null, number]} - A tuple containing the property's data (or null if unrecognized) and the updated offset.
 */
export function extractOsTypeValue(file: Buffer, offset: number, propertyName: string, propertyType: string): [Record<string, any> | null, number] {
  const typeHandlers: Record<string, (file: Buffer, offset: number) => [any, number]> = {
    Objc: (f, o) => extractObjectClass(f, o, propertyName),
    VlLs: extractList,
    doub: extractDouble,
    UntF: extractUnitFloat,
    TEXT: extractText,
    enum: extractEnum,
    long: extractInteger,
    comp: extractLargeInteger,
    bool: extractBoolean,
  };

  if (typeHandlers[propertyType]) {
    const [value, newOffset] = typeHandlers[propertyType](file, offset);
    return [
      {
        name: propertyName,
        os_type: propertyType,
        value: value,
      },
      newOffset,
    ];
  }

  if (["type", "GlbC", "obj ", "alis", "tdta"].includes(propertyType)) {
    return [null, offset];
  }

  const [nameFound, newPropertyType, newOffset] = extractUntilPlaceholder(file, offset, propertyName + propertyType);
  return extractOsTypeValue(file, newOffset, nameFound, newPropertyType);
}

/**
 * Extracts text from the file until one of the predefined placeholders is found.
 *
 * @param {Buffer} file - The Buffer object to read from.
 * @param {number} offset - The current offset within the Buffer.
 * @param {string} [prefix=""] - A prefix to start with when searching for the placeholder.
 * @return {[string, string, number]} - A tuple containing the extracted text before the placeholder and the placeholder itself and the updated offset.
 */
export function extractUntilPlaceholder(file: Buffer, offset: number, prefix = ""): [string, string, number] {
  let extractedText = prefix;
  const placeholders = ["GlbO", "Objc", "VlLs", "dou", "UntF", "TEXT", "enum", "long", "comp", "bool", "type", "GlbC", "obj ", "alis", "tdta"];

  while (true) {
    extractedText += file.subarray(offset, offset + 1).toString("ascii");
    offset += 1;

    if (placeholders.some((placeholder) => extractedText.endsWith(placeholder))) {
      const placeholderLength = placeholders[0].length;
      return [extractedText.slice(0, -placeholderLength), extractedText.slice(-placeholderLength), offset];
    }
  }
}

/**
 * Extracts and processes a class (Objc) from the TPL file.
 *
 * This function processes a specified number of properties associated with the object class,
 * with a special case for the "Grad" object class.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @param {string} name - The name of the object class to process.
 * @return {[Record<string, any>[], number]} - A tuple where the first element is a list of dictionaries, each representing a property of the object class, and the second element is the updated offset.
 */
export function extractObjectClass(file: Buffer, offset: number, name: string): [Record<string, any>[], number] {
  let propertyCount: number;

  if (name === "Grad") {
    // Special case for "Grad" object class: process text and set property count to 4
    offset = extractText(file, offset)[1];
    propertyCount = 4;
  } else {
    // For other object classes, skip 6 bytes, read the label, and determine property count
    offset += 6;
    offset = extractLabel(file, offset)[1];
    propertyCount = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
    offset += 4;
  }

  // Extract the properties based on the determined property count
  const properties: Record<string, any>[] = [];
  for (let i = 0; i < propertyCount; i++) {
    const [property, newOffset] = extractProperty(file, offset);
    properties.push(property);
    offset = newOffset;
  }

  return [properties, offset];
}

/**
 * Extracts and processes text from the TPL file.
 *
 * This function reads a length-prefixed text block, handles edge cases where the length is zero,
 * and decodes the text into a readable ASCII string.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[string, number]} - A tuple where the first element is the extracted and decoded text string, and the second element is the updated offset.
 */
export function extractText(file: Buffer, offset: number): [string, number] {
  let length = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
  offset += 4;

  while (length === 0) {
    offset -= 4;
    offset = extractProperty(file, offset)[1];

    length = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
    offset += 4;

    if (length) {
      const tempCursor = offset;
      const textHex = file.subarray(offset, offset + length * 2).toString("hex");
      const numZeros = (textHex.match(/00/g) || []).length;

      offset = tempCursor;

      if (numZeros === length + 1) {
        break;
      }

      length = 0;
    }
  }

  const textHex = file.subarray(offset, offset + length * 2).toString("hex");
  const text = Buffer.from(textHex, "hex").toString("ascii").replace(/\x00/g, "");
  offset += length * 2;

  return [text, offset];
}

/**
 * Extracts a boolean value from the TPL file.
 *
 * This function reads a single byte from the file, converts it to an integer,
 * and then returns its boolean equivalent.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[boolean, number]} - A tuple where the first element is the boolean value extracted from the file, and the second element is the updated offset.
 */
export function extractBoolean(file: Buffer, offset: number): [boolean, number] {
  // Read a single byte, convert it to an integer, and then to a boolean
  const boolValue = Boolean(parseInt(file.subarray(offset, offset + 1).toString("hex"), 16));
  return [boolValue, offset + 1];
}

/**
 * Extracts an enumeration value from the TPL file.
 *
 * This function reads the class ID and value of an enum, ensuring a minimum length of 4 bytes,
 * and returns them as a dictionary.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[{classId: string, value: string}, number]} - A tuple where the first element is a dictionary containing the 'classId' and 'value' of the enum, both decoded to ASCII, and the second element is the updated offset.
 */
export function extractEnum(file: Buffer, offset: number): [{ classId: string; value: string }, number] {
  // Read and ensure the class ID length is at least 4 bytes
  let classIdLength = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
  offset += 4;
  if (classIdLength === 0) {
    classIdLength = 4;
  }
  const classId = file.subarray(offset, offset + classIdLength).toString("ascii");
  offset += classIdLength;

  // Read and ensure the value length is at least 4 bytes
  let valueLength = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
  offset += 4;
  if (valueLength === 0) {
    valueLength = 4;
  }
  const value = file.subarray(offset, offset + valueLength).toString("ascii");
  offset += valueLength;

  // Return the class ID and value as a dictionary, both decoded to ASCII
  return [{ classId, value }, offset];
}

/**
 * Extracts a double-precision floating-point number from the TPL file.
 *
 * This function reads 8 bytes from the file and unpacks them as a double-precision
 * floating-point number using big-endian format.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[number, number]} - A tuple where the first element is the extracted double-precision floating-point number, and the second element is the updated offset.
 */
export function extractDouble(file: Buffer, offset: number): [number, number] {
  const result = struct.unpack(">d", file.subarray(offset, offset + 8));
  const value = result[0] as number;
  return [value, offset + 8];
}

/**
 * Extracts a unit float value from the TPL file.
 *
 * This function reads a unit identifier (as a 4-byte ASCII string) and a double-precision
 * floating-point value (8 bytes) from the file, then returns them as a dictionary.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[{ unit: string, value: number }, number]} - A tuple where the first element is a dictionary containing the 'unit' (as an ASCII string) and 'value' (as a float), and the second element is the updated offset.
 */
export function extractUnitFloat(file: Buffer, offset: number): [{ unit: string; value: number }, number] {
  const unit = file.subarray(offset, offset + 4).toString("ascii");
  offset += 4;

  const result = struct.unpack(">d", file.subarray(offset, offset + 8));
  const value = result[0] as number;
  offset += 8;

  return [{ unit, value }, offset];
}

/**
 * Extracts a 4-byte integer from the TPL file.
 *
 * This function reads 4 bytes from the file, interprets them as a hexadecimal string,
 * and converts the result to an integer.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[number, number]} - A tuple where the first element is the extracted integer value, and the second element is the updated offset.
 */
export function extractInteger(file: Buffer, offset: number): [number, number] {
  const value = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
  return [value, offset + 4];
}

/**
 * Extracts an 8-byte large integer from the TPL file.
 *
 * This function reads 8 bytes from the file, interprets them as a hexadecimal string,
 * and converts the result to a large integer.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[number, number]} - A tuple where the first element is the extracted large integer value, and the second element is the updated offset.
 */
export function extractLargeInteger(file: Buffer, offset: number): [number, number] {
  const value = parseInt(file.subarray(offset, offset + 8).toString("hex"), 16);
  return [value, offset + 8];
}

/**
 * Extracts a list of properties from the TPL file.
 *
 * This function reads the number of properties (count) from the file,
 * then reads and returns each property as a dictionary.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[Record<string, any>[], number]} - A tuple where the first element is a list of dictionaries, each representing a property, and the second element is the updated offset.
 */
export function extractList(file: Buffer, offset: number): [Record<string, any>[], number] {
  const count = parseInt(file.subarray(offset, offset + 4).toString("hex"), 16);
  offset += 4;

  const properties: Record<string, any>[] = [];
  for (let i = 0; i < count; i++) {
    const iAsString = i.toString();
    const [property, newOffset] = extractPropertyValue(file, offset, Buffer.from(iAsString, "ascii"));
    properties.push(property[iAsString]);
    offset = newOffset;
  }

  return [properties, offset];
}

/**
 * Extracts a class label from the TPL file.
 *
 * This function reads and returns a label, which typically represents a class name or identifier.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[string, number]} - A tuple where the first element is the extracted label as a string and the second element is the updated offset.
 */
export function extractClass(file: Buffer, offset: number): [string, number] {
  const [labelBuffer, newOffset] = extractLabel(file, offset);
  const labelString = labelBuffer.toString("ascii");
  return [labelString, newOffset];
}

/**
 * Validates the TPL file header to ensure it is a valid Photoshop TPL file.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @param {number} offset - The current offset within the Buffer.
 * @return {[boolean, number]} - A tuple where the first element is True if the file header is valid, False otherwise, and the second element is the updated offset.
 */
export function validateTplHeader(file: Buffer, offset: number): [boolean, number] {
  const headerSignature = file
    .subarray(offset, offset + 4)
    .toString("ascii")
    .toLowerCase();
  offset += 4;
  if (headerSignature !== "8btp") {
    return [false, offset];
  }

  offset += 8; // Skip the next 8 bytes

  const photoshopSignature = file
    .subarray(offset, offset + 4)
    .toString("ascii")
    .toLowerCase();
  offset += 4;
  if (photoshopSignature !== "8bim") {
    return [false, offset];
  }

  return [true, offset];
}

/**
 * Moves the file cursor to the start of the tool data section in the TPL file.
 *
 * @param {Buffer} file - The Buffer object containing the binary data of the TPL file.
 * @return {[boolean, number]} - A tuple where the first element is True if the cursor was successfully moved, False otherwise, and the second element is the updated offset.
 */
export function moveToToolDataSection(file: Buffer): [boolean, number] {
  const toolDataSignature = "8BIMtptp";
  const lastOccurrencePos = file.lastIndexOf(Buffer.from(toolDataSignature, "ascii"));

  if (lastOccurrencePos !== -1) {
    const offset = lastOccurrencePos + 16;
    return [true, offset];
  }

  return [false, 0];
}
