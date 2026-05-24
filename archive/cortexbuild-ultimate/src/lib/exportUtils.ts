/**
 * CortexBuild Ultimate - Export Utilities
 * 
 * PDF and CSV export functionality for data tables and reports.
 * Uses jsPDF and autoTable for PDF generation.
 * 
 * @packageDocumentation
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportOptions {
  filename?: string;
  title?: string;
  columns: { header: string; key: string }[];
  data: Record<string, unknown>[];
  orientation?: 'portrait' | 'landscape';
}

export function exportToPDF(options: ExportOptions) {
  const {
    filename = 'export.pdf',
    title = 'Export',
    columns,
    data,
    orientation = 'landscape',
  } = options;

  const doc = new jsPDF({ orientation });

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 20);

  // Add timestamp
  doc.setFontSize(10);
  doc.text('Generated: ' + new Date().toLocaleString(), 14, 28);

  // Prepare table data
  const tableHeaders = columns.map(col => col.header);
  const tableData = data.map(row =>
    columns.map(col => String(row[col.key] ?? ''))
  );

  // Add table
  autoTable(doc, {
    head: [tableHeaders],
    body: tableData,
    startY: 35,
    theme: 'striped',
    headStyles: { fillColor: [245, 158, 11] }, // Amber primary color
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 35 },
  });

  // Save file
  doc.save(filename);
}

export function exportToCSV(data: Record<string, unknown>[], filename: string = 'export.csv') {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        const escaped = String(value ?? '').replace(/"/g, '""');
        return escaped.includes(',') ? '"' + escaped + '"' : escaped;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
