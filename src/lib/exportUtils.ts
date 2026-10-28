import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } from "docx";
import { formatSafeDate } from "@/lib/dates";

export type ExportableEntity = "clients" | "cases" | "tasks";

export interface ExportOptions {
  entity: ExportableEntity;
  records: any[];
  filename?: string;
  scopeDescription?: string;
  userRole?: string;
}

// ---------------------------------------------------------------------------
// Helpers: Formula Injection Protection & Date Formatting
// ---------------------------------------------------------------------------

function sanitizeSpreadsheetText(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  // If the cell begins with formula trigger symbols (=, +, -, @), prepend with single quote
  if (/^[=\+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function formatDateDDMMYYYY(val: any): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(val);
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// 1. EXCEL EXPORT (.xlsx)
// ---------------------------------------------------------------------------

export function exportToExcel({ entity, records, filename, userRole }: ExportOptions) {
  const isAdmin = userRole === "admin";
  const wb = XLSX.utils.book_new();

  let headers: string[] = [];
  let rows: string[][] = [];
  let sheetName = "";

  if (entity === "clients") {
    sheetName = "Clients";
    headers = [
      "ID",
      "Client Name",
      "Client Type",
      "Tag",
      "Phone",
      "Email",
      "Address",
      ...(isAdmin ? ["Aadhaar", "PAN"] : []),
      "Assigned To",
      "KYC Status",
      "Created Date",
    ];

    rows = records.map((c) => {
      const assignedNames = Array.isArray(c.assignedTo)
        ? c.assignedTo.map((a: any) => (typeof a === "object" ? a.name : a)).filter(Boolean).join(", ")
        : c.assignedTo?.name || "";

      return [
        c._id || "",
        sanitizeSpreadsheetText(c.name || ""),
        c.type || "Individual",
        c.tag || "Active",
        sanitizeSpreadsheetText(c.phone || ""),
        sanitizeSpreadsheetText(c.email || ""),
        sanitizeSpreadsheetText(c.address || ""),
        ...(isAdmin ? [sanitizeSpreadsheetText(c.aadhar || ""), sanitizeSpreadsheetText(c.pan || "")] : []),
        assignedNames || "Unassigned",
        c.kyc || "Pending",
        formatDateDDMMYYYY(c.createdAt),
      ];
    });
  } else if (entity === "cases") {
    sheetName = "Cases";
    headers = [
      "ID",
      "Case Number",
      "Court Case ID",
      "Case Title",
      "Primary Client",
      "Main Category",
      "Subcategory",
      "Priority",
      "Status",
      "Assigned To",
      "Assigned By",
      "Court",
      "Next Hearing Date",
      "Description",
      "Created Date",
    ];

    rows = records.map((c) => {
      const assignedNames = Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0
        ? c.assignedUsers.map((u: any) => u.name).join(", ")
        : c.assignedTo?.name || "";

      const primaryClient = c.parties?.find((p: any) => p.role === "Primary Client" || p.type === "client")?.name || c.parties?.[0]?.name || "—";
      const assignedBy = typeof c.assignedBy === "object" && c.assignedBy?.name ? c.assignedBy.name : (c.createdBy?.name || "Administrator");

      return [
        c._id || "",
        sanitizeSpreadsheetText(c.number || ""),
        sanitizeSpreadsheetText(c.courtCaseId || ""),
        sanitizeSpreadsheetText(c.title || ""),
        sanitizeSpreadsheetText(primaryClient),
        sanitizeSpreadsheetText(c.mainCategory || c.practice || ""),
        sanitizeSpreadsheetText(c.subCategory || ""),
        c.priority || "Medium",
        c.status || "Active",
        assignedNames || "Unassigned",
        assignedBy,
        sanitizeSpreadsheetText(c.court || ""),
        formatDateDDMMYYYY(c.nextHearing),
        sanitizeSpreadsheetText(c.description || ""),
        formatDateDDMMYYYY(c.createdAt),
      ];
    });
  } else if (entity === "tasks") {
    sheetName = "Tasks";
    headers = [
      "ID",
      "Task Title",
      "Related Case",
      "Client Name",
      "Main Category",
      "Subcategory",
      "Priority",
      "Status",
      "Deadline",
      "Assigned To",
      "Assigned By",
      "Description",
      "Created Date",
    ];

    rows = records.map((t) => {
      const assignedNames = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
        ? t.assignedUsers.map((u: any) => u.name).join(", ")
        : t.assignedTo?.name || "";

      const caseName = typeof t.caseId === "object" && t.caseId?.title ? `${t.caseId.number || ""} - ${t.caseId.title}` : (t.caseName || "—");
      const clientName = typeof t.clientId === "object" && t.clientId?.name ? t.clientId.name : (t.clientName || "—");
      const assignedBy = typeof t.assignedBy === "object" && t.assignedBy?.name ? t.assignedBy.name : (t.createdBy?.name || "Administrator");

      return [
        t._id || "",
        sanitizeSpreadsheetText(t.title || ""),
        sanitizeSpreadsheetText(caseName),
        sanitizeSpreadsheetText(clientName),
        sanitizeSpreadsheetText(t.mainCategory || ""),
        sanitizeSpreadsheetText(t.subCategory || ""),
        t.priority || "Medium",
        t.status || "pending",
        formatDateDDMMYYYY(t.deadline),
        assignedNames || "Unassigned",
        assignedBy,
        sanitizeSpreadsheetText(t.description || ""),
        formatDateDDMMYYYY(t.createdAt),
      ];
    });
  }

  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 4, 16) }));

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const defaultName = `LegalOS_${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename || defaultName);
}

// ---------------------------------------------------------------------------
// 2. PDF EXPORT (.pdf)
// ---------------------------------------------------------------------------

export function exportToPDF({ entity, records, filename, scopeDescription, userRole }: ExportOptions) {
  const isAdmin = userRole === "admin";
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  const titleMap = {
    clients: "CLIENTS REGISTER & DIRECTORY",
    cases: "CASES & MATTERS REGISTER",
    tasks: "UPCOMING & OPERATIONAL TASKS REGISTER",
  };

  const title = `S & S ASSOCIATES LEGAL-TECH LLP — ${titleMap[entity] || entity.toUpperCase()}`;
  const exportDate = `Exported on: ${formatDateDDMMYYYY(new Date())}`;
  const scope = scopeDescription ? `Filter Scope: ${scopeDescription}` : `Total Records: ${records.length}`;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 40, 40);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`${exportDate}  |  ${scope}`, 40, 56);

  let headers: string[] = [];
  let rows: string[][] = [];

  if (entity === "clients") {
    headers = ["Client Name", "Type", "Tag", "Phone", "Email", "Assigned To", "KYC", "Created"];
    rows = records.map((c) => {
      const assignedNames = Array.isArray(c.assignedTo)
        ? c.assignedTo.map((a: any) => (typeof a === "object" ? a.name : a)).filter(Boolean).join(", ")
        : c.assignedTo?.name || "Unassigned";

      return [
        c.name || "—",
        c.type || "Individual",
        c.tag || "Active",
        c.phone || "—",
        c.email || "—",
        assignedNames,
        c.kyc || "Pending",
        formatDateDDMMYYYY(c.createdAt),
      ];
    });
  } else if (entity === "cases") {
    headers = ["Case No", "Title", "Client", "Category", "Assigned To", "Assigned By", "Status", "Priority", "Hearing"];
    rows = records.map((c) => {
      const assignedNames = Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0
        ? c.assignedUsers.map((u: any) => u.name).join(", ")
        : c.assignedTo?.name || "Unassigned";
      const primaryClient = c.parties?.find((p: any) => p.role === "Primary Client" || p.type === "client")?.name || c.parties?.[0]?.name || "—";
      const assignedBy = typeof c.assignedBy === "object" && c.assignedBy?.name ? c.assignedBy.name : (c.createdBy?.name || "Administrator");

      return [
        c.number || "—",
        c.title || "—",
        primaryClient,
        c.mainCategory || c.practice || "General",
        assignedNames,
        assignedBy,
        c.status || "Active",
        c.priority || "Medium",
        formatDateDDMMYYYY(c.nextHearing),
      ];
    });
  } else if (entity === "tasks") {
    headers = ["Task Title", "Related Case", "Client", "Assigned To", "Assigned By", "Priority", "Status", "Deadline"];
    rows = records.map((t) => {
      const assignedNames = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
        ? t.assignedUsers.map((u: any) => u.name).join(", ")
        : t.assignedTo?.name || "Unassigned";
      const caseName = typeof t.caseId === "object" && t.caseId?.title ? t.caseId.title : (t.caseName || "—");
      const clientName = typeof t.clientId === "object" && t.clientId?.name ? t.clientId.name : (t.clientName || "—");
      const assignedBy = typeof t.assignedBy === "object" && t.assignedBy?.name ? t.assignedBy.name : (t.createdBy?.name || "Administrator");

      return [
        t.title || "—",
        caseName,
        clientName,
        assignedNames,
        assignedBy,
        t.priority || "Medium",
        (t.status || "pending").replace(/_/g, " "),
        formatDateDDMMYYYY(t.deadline),
      ];
    });
  }

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 70,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40 },
    didDrawPage: (data) => {
      const pageCount = (doc.internal as any).getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.width - 80,
        doc.internal.pageSize.height - 20
      );
    },
  });

  const defaultName = `LegalOS_${entity}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename || defaultName);
}

// ---------------------------------------------------------------------------
// 3. WORD EXPORT (.docx)
// ---------------------------------------------------------------------------

export async function exportToWord({ entity, records, filename, scopeDescription }: ExportOptions) {
  const titleMap = {
    clients: "Clients Register & Directory",
    cases: "Cases & Matters Register",
    tasks: "Upcoming & Operational Tasks Register",
  };

  const entityTitle = titleMap[entity] || entity.toUpperCase();
  const exportDate = formatDateDDMMYYYY(new Date());

  let headers: string[] = [];
  let rows: string[][] = [];

  if (entity === "clients") {
    headers = ["Client Name", "Type", "Tag", "Phone", "Email", "Assigned To", "KYC", "Created"];
    rows = records.map((c) => {
      const assignedNames = Array.isArray(c.assignedTo)
        ? c.assignedTo.map((a: any) => (typeof a === "object" ? a.name : a)).filter(Boolean).join(", ")
        : c.assignedTo?.name || "Unassigned";

      return [
        c.name || "—",
        c.type || "Individual",
        c.tag || "Active",
        c.phone || "—",
        c.email || "—",
        assignedNames,
        c.kyc || "Pending",
        formatDateDDMMYYYY(c.createdAt),
      ];
    });
  } else if (entity === "cases") {
    headers = ["Case No", "Title", "Client", "Category", "Assigned To", "Assigned By", "Status", "Priority", "Hearing"];
    rows = records.map((c) => {
      const assignedNames = Array.isArray(c.assignedUsers) && c.assignedUsers.length > 0
        ? c.assignedUsers.map((u: any) => u.name).join(", ")
        : c.assignedTo?.name || "Unassigned";
      const primaryClient = c.parties?.find((p: any) => p.role === "Primary Client" || p.type === "client")?.name || c.parties?.[0]?.name || "—";
      const assignedBy = typeof c.assignedBy === "object" && c.assignedBy?.name ? c.assignedBy.name : (c.createdBy?.name || "Administrator");

      return [
        c.number || "—",
        c.title || "—",
        primaryClient,
        c.mainCategory || c.practice || "General",
        assignedNames,
        assignedBy,
        c.status || "Active",
        c.priority || "Medium",
        formatDateDDMMYYYY(c.nextHearing),
      ];
    });
  } else if (entity === "tasks") {
    headers = ["Task Title", "Related Case", "Client", "Assigned To", "Assigned By", "Priority", "Status", "Deadline"];
    rows = records.map((t) => {
      const assignedNames = Array.isArray(t.assignedUsers) && t.assignedUsers.length > 0
        ? t.assignedUsers.map((u: any) => u.name).join(", ")
        : t.assignedTo?.name || "Unassigned";
      const caseName = typeof t.caseId === "object" && t.caseId?.title ? t.caseId.title : (t.caseName || "—");
      const clientName = typeof t.clientId === "object" && t.clientId?.name ? t.clientId.name : (t.clientName || "—");
      const assignedBy = typeof t.assignedBy === "object" && t.assignedBy?.name ? t.assignedBy.name : (t.createdBy?.name || "Administrator");

      return [
        t.title || "—",
        caseName,
        clientName,
        assignedNames,
        assignedBy,
        t.priority || "Medium",
        (t.status || "pending").replace(/_/g, " "),
        formatDateDDMMYYYY(t.deadline),
      ];
    });
  }

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: headers.map(
      (h) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18, color: "FFFFFF" })] })],
          shading: { fill: "1E293B" },
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
        })
    ),
  });

  const tableBodyRows = rows.map(
    (row, idx) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: cell, size: 16 })] })],
              shading: { fill: idx % 2 === 1 ? "F8FAFC" : "FFFFFF" },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
            })
        ),
      })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 },
          },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "S & S ASSOCIATES LEGAL-TECH LLP",
                bold: true,
                size: 28,
                color: "1E293B",
              }),
            ],
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${entityTitle}  •  Exported on ${exportDate}`,
                size: 20,
                color: "64748B",
              }),
            ],
          }),
          ...(scopeDescription
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Filter Scope: ${scopeDescription}`,
                      italics: true,
                      size: 18,
                      color: "64748B",
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [tableHeaderRow, ...tableBodyRows],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const defaultName = `LegalOS_${entity}_${new Date().toISOString().slice(0, 10)}.docx`;
  downloadBlob(blob, filename || defaultName);
}
