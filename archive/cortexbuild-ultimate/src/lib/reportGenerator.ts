import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportConfig {
  title: string;
  subtitle?: string;
  sections: ReportSection[];
  orientation?: 'portrait' | 'landscape';
}


// Sanitize text for PDF (prevent XSS)

// Sanitize text for PDF (prevent XSS)
const sanitizeText = (text: string): string => text.replace(/[<>]/g, '');


// PDF layout constants
const _PDF_MARGIN_X = 14;
const _TITLE_Y = 20;
const _SUBTITLE_Y = 28;
const _TIMESTAMP_Y = 36;
const _START_Y = 45;
const FONT_SIZE_TITLE = 20;
const FONT_SIZE_SUBTITLE = 12;
const FONT_SIZE_BODY = 10;
const FONT_SIZE_SECTION = 14;



interface ReportSection {
  type: 'text' | 'table' | 'chart' | 'kpi';
  title?: string;
  data: unknown;
}

export class ReportGenerator {
  private doc: jsPDF;

  constructor() {
    this.doc = new jsPDF();
  }

  async generate(config: ReportConfig): Promise<Blob> {
    this.doc = new jsPDF({ orientation: config.orientation || 'portrait' });

    // Add title
    this.doc.setFontSize(FONT_SIZE_TITLE);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(sanitizeText(config.title), 14, 20);

    if (config.subtitle) {
      this.doc.setFontSize(FONT_SIZE_SUBTITLE);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(sanitizeText(config.subtitle || ''), 14, 28);
    }

    // Add timestamp
    this.doc.setFontSize(FONT_SIZE_BODY);
    this.doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 36);

    let yPos = 45;

    // Add sections
    for (const section of config.sections) {
      yPos = await this.addSection(section, yPos);
    }

    return this.doc.output('blob');
  }

  private async addSection(section: ReportSection, yPos: number): Promise<number> {
    switch (section.type) {
      case 'text':
        return this.addTextSection(section, yPos);
      case 'table':
        return this.addTableSection(section, yPos);
      case 'kpi':
        return this.addKpiSection(section, yPos);
      default:
        return yPos + 20;
    }
  }

  private addTextSection(section: ReportSection, yPos: number): number {
    if (section.title) {
      this.doc.setFontSize(FONT_SIZE_SECTION);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(section.title, 14, yPos);
      yPos += 10;
    }

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');
    const lines = this.doc.splitTextToSize(section.data as string, 180);
    this.doc.text(lines, 14, yPos);

    return yPos + (lines.length * 5) + 10;
  }

  private addTableSection(section: ReportSection, yPos: number): number {
    if (section.title) {
      this.doc.setFontSize(FONT_SIZE_SECTION);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(section.title, 14, yPos);
      yPos += 10;
    }

    const data = section.data as { columns: string[]; rows: (string | number)[][] };
    
    autoTable(this.doc, {
      startY: yPos,
      head: [data.columns],
      body: data.rows,
      theme: 'striped',
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: 14 },
    });

    const finalY = (this.doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    return (finalY ?? yPos) + 10;
  }

  private addKpiSection(section: ReportSection, yPos: number): number {
    if (section.title) {
      this.doc.setFontSize(FONT_SIZE_SECTION);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(section.title, 14, yPos);
      yPos += 10;
    }

    const kpis = section.data as { label: string; value: string | number }[];
    let xPos = 14;

    kpis.forEach((kpi, index) => {
      if (index > 0 && index % 3 === 0) {
        xPos = 14;
        yPos += 20;
      }

      this.doc.setFontSize(FONT_SIZE_BODY);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(kpi.label, xPos, yPos);
      
      this.doc.setFontSize(FONT_SIZE_SECTION);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(String(kpi.value), xPos, yPos + 6);

      xPos += 60;
    });

    return yPos + 30;
  }

  async download(config: ReportConfig, filename: string) {
    const blob = await this.generate(config);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}

export const reportGenerator = new ReportGenerator();
