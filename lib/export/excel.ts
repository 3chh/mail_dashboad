type ExcelCellValue = string | number | null | undefined;

function escapeXml(value: ExcelCellValue) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeWorksheetName(value: string) {
  const sanitized = value.replace(/[\\/*?:[\]]/g, "-").trim();
  return (sanitized || "Sheet1").slice(0, 31);
}

function buildCell(value: ExcelCellValue, styleId: string) {
  const type = typeof value === "number" ? "Number" : "String";

  return [
    `<Cell ss:StyleID="${styleId}">`,
    `<Data ss:Type="${type}">${escapeXml(value)}</Data>`,
    "</Cell>",
  ].join("");
}

export function buildExcelWorkbook(args: {
  sheetName: string;
  headers: string[];
  rows: ExcelCellValue[][];
}) {
  const headerRow = `<Row>${args.headers.map((value) => buildCell(value, "header")).join("")}</Row>`;
  const dataRows = args.rows.map((row) => `<Row>${row.map((value) => buildCell(value, "body")).join("")}</Row>`).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    "<Styles>",
    '<Style ss:ID="header"><Font ss:Bold="1" /><Alignment ss:Vertical="Top" ss:WrapText="1" /></Style>',
    '<Style ss:ID="body"><Alignment ss:Vertical="Top" ss:WrapText="1" /></Style>',
    "</Styles>",
    `<Worksheet ss:Name="${escapeXml(sanitizeWorksheetName(args.sheetName))}">`,
    "<Table>",
    headerRow,
    dataRows,
    "</Table>",
    "</Worksheet>",
    "</Workbook>",
  ].join("");
}
