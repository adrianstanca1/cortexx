import { useState, useCallback } from 'react';
import {
  Download,
  Upload,
  FileText,
  FileJson,
  FileSpreadsheet,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

export type ExportFormat = 'csv' | 'json' | 'xlsx';
export type ImportFormat = 'csv' | 'json';

export interface ColumnMapping {
  source: string;
  target: string;
  transform?: (value: string) => unknown;
}

interface ExportOptions {
  filename: string;
  format: ExportFormat;
  data: Record<string, unknown>[];
  columns?: string[];
  headers?: Record<string, string>;
}

interface _ImportOptions {
  format: ImportFormat;
  onMapping?: (headers: string[], data: string[][]) => ColumnMapping[];
}

interface _ImportResult {
  success: boolean;
  rows: number;
  errors: string[];
  data: Record<string, unknown>[];
}

export function exportData(options: ExportOptions): void {
  const { filename, format, data, columns, headers } = options;
  
  if (data.length === 0) {
    toast.error('No data to export');
    return;
  }

  const keys = columns || Object.keys(data[0]);
  const headerLabels = headers || {};

  if (format === 'csv') {
    const csvContent = [
      keys.map(k => `"${headerLabels[k] || k}"`).join(','),
      ...data.map(row => 
        keys.map(k => {
          const val = row[k];
          const str = val === null || val === undefined ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Exported ${data.length} rows to CSV`);
  }

  if (format === 'json') {
    const exportData = data.map(row => {
      const obj: Record<string, unknown> = {};
      keys.forEach(k => { obj[k] = row[k]; });
      return obj;
    });

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Exported ${data.length} records to JSON`);
  }
}

function parseCSV(content: string): { headers: string[]; data: string[][] } {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], data: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const data = lines.slice(1).map(parseRow);

  return { headers, data };
}

function parseJSON(content: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed === 'object' && parsed !== null) return [parsed];
    throw new Error('JSON must be an array or object');
  } catch {
    throw new Error('Invalid JSON format');
  }
}

export function parseFile(content: string, format: ImportFormat): {
  headers: string[];
  data: string[][];
  rawData: Record<string, unknown>[];
} {
  if (format === 'csv') {
    const { headers, data } = parseCSV(content);
    return { headers, data, rawData: [] };
  }

  if (format === 'json') {
    const rawData = parseJSON(content);
    const headers = rawData.length > 0 ? Object.keys(rawData[0]) : [];
    const data = rawData.map(row => headers.map(h => String(row[h] ?? '')));
    return { headers, data, rawData };
  }

  throw new Error('Unsupported format');
}

interface DataImporterProps {
  onImport: (data: Record<string, unknown>[], mapping: ColumnMapping[]) => Promise<void>;
  format?: ImportFormat;
  exampleData?: Record<string, unknown>;
}

export function DataImporter({ onImport, format = 'csv', exampleData }: DataImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; data: string[][] } | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    const content = await f.text();
    
    try {
      const parsed = parseFile(content, format);
      setPreview({ headers: parsed.headers, data: parsed.data.slice(0, 5) });
      
      if (exampleData) {
        const targetKeys = Object.keys(exampleData);
        const autoMapping: ColumnMapping[] = parsed.headers.map((source, i) => {
          const matchingTarget = targetKeys.find(
            target => target.toLowerCase() === source.toLowerCase() ||
                     target.toLowerCase().includes(source.toLowerCase()) ||
                     source.toLowerCase().includes(target.toLowerCase())
          );
          return { source, target: matchingTarget || targetKeys[i % targetKeys.length] };
        });
        setMapping(autoMapping);
      } else {
        setMapping(parsed.headers.map((source, i) => ({ source, target: `column_${i}` })));
      }
    } catch {
      toast.error('Failed to parse file');
      setFile(null);
      setPreview(null);
    }
  }, [format, exampleData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!preview || mapping.length === 0) return;
    
    setImporting(true);
    try {
      const importedData = preview.data.map(row => {
        const obj: Record<string, unknown> = {};
        row.forEach((val, i) => {
          const map = mapping[i];
          if (map?.target) {
            obj[map.target] = map.transform ? map.transform(val) : val;
          }
        });
        return obj;
      });

      await onImport(importedData, mapping);
      toast.success(`Imported ${importedData.length} rows`);
      setFile(null);
      setPreview(null);
      setMapping([]);
    } catch {
      toast.error('Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-700 hover:border-gray-600'
        )}
      >
        <Upload className="h-12 w-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-300 mb-2">Drag and drop your file here, or</p>
        <label className="cursor-pointer">
          <span className="btn btn-primary">Browse Files</span>
          <input
            type="file"
            accept={format === 'csv' ? '.csv' : '.json'}
            onChange={handleFileInput}
            className="hidden"
          />
        </label>
        <p className="text-xs text-gray-600 mt-2">
          Supported: {format.toUpperCase()} files
        </p>
      </div>

      {file && (
        <div className="bg-gray-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <button onClick={() => { setFile(null); setPreview(null); }} className="text-gray-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-400 mb-2">Preview (first 5 rows)</h4>
            <div className="cb-table-scroll touch-pan-x">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    {preview.headers.map((h, i) => (
                      <th key={i} className="text-left p-2 text-gray-400">
                        <select
                          value={mapping[i]?.target || ''}
                          onChange={(e) => setMapping(prev => {
                            const next = [...prev];
                            next[i] = { ...next[i], target: e.target.value };
                            return next;
                          })}
                          className="w-full bg-gray-700 text-white text-xs p-1 rounded"
                        >
                          <option value="">-- Skip --</option>
                          {exampleData && Object.keys(exampleData).map(key => (
                            <option key={key} value={key}>{key}</option>
                          ))}
                          <option value={`custom:${h}`}>{h} (as-is)</option>
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.map((row, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      {row.map((cell, j) => (
                        <td key={j} className="p-2 text-gray-300 truncate max-w-32">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => { setFile(null); setPreview(null); }} className="btn btn-secondary">
              Cancel
            </button>
            <button onClick={handleImport} disabled={importing} className="btn btn-primary">
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Import {preview.data.length} rows
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns?: string[];
  headers?: Record<string, string>;
  filename: string;
  formats?: ExportFormat[];
  className?: string;
}

export function ExportButton({ data, columns, headers, filename, formats = ['csv', 'json'], className }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = (format: ExportFormat) => {
    exportData({ filename, format, data, columns, headers });
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setShowMenu(!showMenu)} className={clsx('btn btn-secondary', className)}>
        <Download className="h-4 w-4 mr-2" />
        Export
      </button>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20">
            {formats.includes('csv') && (
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-700 text-left"
              >
                <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                <span className="text-sm">CSV (Excel compatible)</span>
              </button>
            )}
            {formats.includes('json') && (
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-700 text-left"
              >
                <FileJson className="h-4 w-4 text-gray-400" />
                <span className="text-sm">JSON</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
