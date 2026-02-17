import * as XLSX from "xlsx";

/**
 * Exporta datos a un archivo Excel (.xlsx).
 * @param {string} filename - Nombre del archivo (sin extensión)
 * @param {string} sheetName - Nombre de la hoja
 * @param {string[]} headers - Encabezados de columnas
 * @param {any[][]} rows - Filas de datos (array de arrays)
 */
export function exportToExcel(filename, sheetName, headers, rows) {
  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
