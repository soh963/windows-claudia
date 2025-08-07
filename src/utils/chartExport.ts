import { toPng, toSvg } from 'html-to-image';
import jsPDF from 'jspdf';

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf' | 'csv' | 'json';
  chartType: string;
  dateRange?: {
    start: number;
    end: number;
  };
  includeMetadata?: boolean;
  filename?: string;
  quality?: number;
  width?: number;
  height?: number;
}

export class ChartExporter {
  private static generateFilename(chartType: string, format: string, customFilename?: string): string {
    if (customFilename) return customFilename;
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    return `claudia-${chartType}-${timestamp}.${format}`;
  }

  private static downloadFile(content: string | Blob, filename: string, mimeType: string) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  static async exportChart(element: HTMLElement, options: ExportOptions): Promise<void> {
    const {
      format,
      chartType,
      filename,
      quality = 1.0,
      width,
      height,
      includeMetadata = true,
    } = options;

    const generatedFilename = this.generateFilename(chartType, format, filename);

    try {
      switch (format) {
        case 'png':
          await this.exportAsPNG(element, generatedFilename, quality, width, height);
          break;
        case 'svg':
          await this.exportAsSVG(element, generatedFilename, width, height);
          break;
        case 'pdf':
          await this.exportAsPDF(element, generatedFilename, quality, width, height, includeMetadata);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error(`Failed to export chart as ${format}:`, error);
      throw error;
    }
  }

  private static async exportAsPNG(
    element: HTMLElement,
    filename: string,
    quality: number,
    width?: number,
    height?: number
  ): Promise<void> {
    const options = {
      quality,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      ...(width && height && { width, height }),
    };

    const dataUrl = await toPng(element, options);
    const blob = await fetch(dataUrl).then(res => res.blob());
    this.downloadFile(blob, filename, 'image/png');
  }

  private static async exportAsSVG(
    element: HTMLElement,
    filename: string,
    width?: number,
    height?: number
  ): Promise<void> {
    const options = {
      backgroundColor: '#ffffff',
      ...(width && height && { width, height }),
    };

    const dataUrl = await toSvg(element, options);
    const svgData = dataUrl.replace('data:image/svg+xml;charset=utf-8,', '');
    const decodedData = decodeURIComponent(svgData);
    
    this.downloadFile(decodedData, filename, 'image/svg+xml');
  }

  private static async exportAsPDF(
    element: HTMLElement,
    filename: string,
    quality: number,
    width?: number,
    height?: number,
    includeMetadata = true
  ): Promise<void> {
    const dataUrl = await toPng(element, {
      quality,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      ...(width && height && { width, height }),
    });

    const img = new Image();
    img.src = dataUrl;
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const pdf = new jsPDF({
            orientation: img.width > img.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [img.width, img.height],
          });

          if (includeMetadata) {
            pdf.setProperties({
              title: `Claudia Chart Export - ${filename}`,
              subject: 'Task Visualization Dashboard Export',
              author: 'Claudia AI Assistant',
              creator: 'Claudia Task Visualization',
              creationDate: new Date(),
            });
          }

          pdf.addImage(dataUrl, 'PNG', 0, 0, img.width, img.height);
          pdf.save(filename);
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = reject;
    });
  }

  static exportDataAsCSV(data: any[], filename?: string): void {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          let value = row[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            value = `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');

    const generatedFilename = filename || this.generateFilename('data', 'csv');
    this.downloadFile(csvContent, generatedFilename, 'text/csv');
  }

  static exportDataAsJSON(data: any, filename?: string, pretty = true): void {
    const jsonContent = pretty 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);

    const generatedFilename = filename || this.generateFilename('data', 'json');
    this.downloadFile(jsonContent, generatedFilename, 'application/json');
  }

  static async exportMultipleCharts(
    charts: Array<{ element: HTMLElement; options: ExportOptions }>,
    format: 'png' | 'svg' | 'pdf' = 'png'
  ): Promise<void> {
    if (format === 'pdf') {
      await this.exportChartsAsCombinedPDF(charts);
    } else {
      // Export individual files
      for (const { element, options } of charts) {
        await this.exportChart(element, { ...options, format });
      }
    }
  }

  private static async exportChartsAsCombinedPDF(
    charts: Array<{ element: HTMLElement; options: ExportOptions }>
  ): Promise<void> {
    if (charts.length === 0) return;

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    pdf.setProperties({
      title: 'Claudia Dashboard Export',
      subject: 'Combined Task Visualization Charts',
      author: 'Claudia AI Assistant',
      creator: 'Claudia Task Visualization',
      creationDate: new Date(),
    });

    for (let i = 0; i < charts.length; i++) {
      const { element, options } = charts[i];
      
      if (i > 0) {
        pdf.addPage();
      }

      // Add title
      pdf.setFontSize(16);
      pdf.text(options.chartType.replace('-', ' ').toUpperCase(), 20, 20);

      // Export chart as image
      const dataUrl = await toPng(element, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      });

      const img = new Image();
      img.src = dataUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Calculate dimensions to fit on page
            const pageWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const margin = 20;
            const availableWidth = pageWidth - (2 * margin);
            const availableHeight = pageHeight - 40; // Leave space for title

            const aspectRatio = img.width / img.height;
            let finalWidth = availableWidth;
            let finalHeight = finalWidth / aspectRatio;

            if (finalHeight > availableHeight) {
              finalHeight = availableHeight;
              finalWidth = finalHeight * aspectRatio;
            }

            const x = (pageWidth - finalWidth) / 2;
            const y = 30;

            pdf.addImage(dataUrl, 'PNG', x, y, finalWidth, finalHeight);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = reject;
      });
    }

    const filename = this.generateFilename('dashboard-combined', 'pdf');
    pdf.save(filename);
  }
}

// Hook for easy chart export from components
export const useChartExport = () => {
  const exportChart = async (element: HTMLElement | null, options: ExportOptions) => {
    if (!element) {
      throw new Error('Chart element not found');
    }

    return ChartExporter.exportChart(element, options);
  };

  const exportData = (data: any[], format: 'csv' | 'json', filename?: string) => {
    if (format === 'csv') {
      ChartExporter.exportDataAsCSV(data, filename);
    } else {
      ChartExporter.exportDataAsJSON(data, filename);
    }
  };

  return {
    exportChart,
    exportData,
    exportMultipleCharts: ChartExporter.exportMultipleCharts,
  };
};

export default ChartExporter;