import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import type { InventoryItem, ReturnedItem, Product } from './types';

export function generateInventoryPDF(
  title: string,
  items: any[],
  columns: string[],
  dataMapper: (item: any) => string[],
  totalValue?: number
) {
  const doc = new jsPDF();
  const now = new Date();
  const timestamp = format(now, 'PPp');

  // Add Branded Header
  doc.setFontSize(22);
  doc.setTextColor(41, 171, 226); // SheetSync Blue
  doc.text('SheetSync Inventory System', 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(100, 100, 100);
  doc.text(title, 14, 30);

  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on: ${timestamp}`, 14, 38);

  // Draw Line
  doc.setDrawColor(41, 171, 226);
  doc.setLineWidth(0.5);
  doc.line(14, 42, 196, 42);

  // Table
  (doc as any).autoTable({
    startY: 48,
    head: [columns],
    body: items.map(dataMapper),
    headStyles: { fillColor: [41, 171, 226], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 248, 255] },
    margin: { left: 14, right: 14 },
    theme: 'striped',
  });

  // Footer / Totals
  const finalY = (doc as any).lastAutoTable.finalY || 50;
  if (totalValue !== undefined) {
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Selection Value: QAR ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 14, finalY + 15);
  }

  // Page Numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 196, 285, { align: 'right' });
  }

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
}
