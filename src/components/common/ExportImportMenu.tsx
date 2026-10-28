import React from "react";
import { Download, FileSpreadsheet, FileText, Upload, ChevronDown, FileCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { exportToExcel, exportToPDF, exportToWord, type ExportableEntity } from "@/lib/exportUtils";

interface ExportImportMenuProps {
  entityLabel?: string;
  onExportExcel?: () => void;
  onExportPDF?: () => void;
  onExportWord?: () => void;
  onImportExcel?: () => void;
  disabled?: boolean;
  // Unified props used in clients, cases, and tasks pages:
  entityType?: ExportableEntity;
  data?: any[];
  onImportClick?: () => void;
}

export function ExportImportMenu({
  entityLabel,
  onExportExcel,
  onExportPDF,
  onExportWord,
  onImportExcel,
  disabled = false,
  entityType,
  data,
  onImportClick,
}: ExportImportMenuProps) {
  const label =
    entityLabel ||
    (entityType === "clients"
      ? "Clients"
      : entityType === "cases"
      ? "Cases"
      : entityType === "tasks"
      ? "Tasks"
      : "Records");

  const handleExcel = () => {
    if (onExportExcel) {
      onExportExcel();
    } else if (entityType && data) {
      exportToExcel({ entity: entityType, records: data });
    }
  };

  const handlePDF = () => {
    if (onExportPDF) {
      onExportPDF();
    } else if (entityType && data) {
      exportToPDF({ entity: entityType, records: data });
    }
  };

  const handleWord = () => {
    if (onExportWord) {
      onExportWord();
    } else if (entityType && data) {
      exportToWord({ entity: entityType, records: data });
    }
  };

  const handleImport = () => {
    if (onImportExcel) {
      onImportExcel();
    } else if (onImportClick) {
      onImportClick();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-9 gap-1.5 rounded-md px-3 text-xs font-medium border-border/80 bg-background hover:bg-muted/50 transition-colors cursor-pointer"
        >
          <Download size={14} className="text-muted-foreground" />
          <span>Export / Import</span>
          <ChevronDown size={13} className="text-muted-foreground opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-xs p-1.5 shadow-lift rounded-xl border-border bg-popover">
        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Export {label}
        </div>
        <DropdownMenuItem
          onClick={handleExcel}
          className="flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <FileSpreadsheet size={15} className="text-emerald-600 dark:text-emerald-400" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">Export to Excel</span>
            <span className="text-[10px] text-muted-foreground">Editable spreadsheet (.xlsx)</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handlePDF}
          className="flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <FileText size={15} className="text-rose-600 dark:text-rose-400" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">Export to PDF</span>
            <span className="text-[10px] text-muted-foreground">Printable document (.pdf)</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleWord}
          className="flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer hover:bg-muted focus:bg-muted"
        >
          <FileCheck size={15} className="text-blue-600 dark:text-blue-400" />
          <div className="flex flex-col">
            <span className="font-medium text-foreground">Export to Word</span>
            <span className="text-[10px] text-muted-foreground">Formatted document (.docx)</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1 border-border/60" />

        <div className="px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Database Synchronization
        </div>
        <DropdownMenuItem
          onClick={handleImport}
          className="flex items-center gap-2 py-2 px-2.5 rounded-lg cursor-pointer hover:bg-primary/10 text-primary focus:bg-primary/10"
        >
          <Upload size={15} className="text-primary" />
          <div className="flex flex-col">
            <span className="font-medium">Import from Excel</span>
            <span className="text-[10px] text-muted-foreground">Validate &amp; update records (.xlsx)</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
