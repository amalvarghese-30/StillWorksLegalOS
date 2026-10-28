import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Upload,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  ArrowRight,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { clientKeys } from "@/services/clients";
import { caseKeys } from "@/services/cases";
import { taskKeys } from "@/services/tasks";

export type ImportEntity = "clients" | "cases" | "tasks";

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  entity?: ImportEntity;
  entityType?: ImportEntity;
  existingRecords?: any[];
  onImportSuccess?: () => void;
}

interface RowDiff {
  rowNum: number;
  id: string;
  recordName: string;
  field: string;
  currentVal: string;
  importedVal: string;
  status: "valid" | "unchanged" | "error";
  errorMessage?: string;
}

const SUPPORTED_COLUMNS_MAP: Record<ImportEntity, { displayNames: Record<string, string>; allowedHeaders: string[] }> = {
  clients: {
    displayNames: {
      id: "id",
      "record id": "id",
      "client name": "name",
      name: "name",
      "client type": "type",
      type: "type",
      tag: "tag",
      phone: "phone",
      "phone number": "phone",
      email: "email",
      address: "address",
      aadhar: "aadhar",
      aadhaar: "aadhar",
      pan: "pan",
      notes: "notes",
      kyc: "kyc",
      "kyc status": "kyc",
      "created date": "createdAt",
      "assigned to": "assignedTo",
    },
    allowedHeaders: [
      "id", "record id", "client name", "name", "client type", "type", "tag",
      "phone", "phone number", "email", "address", "aadhar", "aadhaar", "pan",
      "notes", "kyc", "kyc status", "created date", "assigned to",
    ],
  },
  cases: {
    displayNames: {
      id: "id",
      "record id": "id",
      "case number": "number",
      "court case id": "courtCaseId",
      "case title": "title",
      title: "title",
      "primary client": "client",
      client: "client",
      "main category": "mainCategory",
      category: "category",
      practice: "practice",
      subcategory: "subCategory",
      priority: "priority",
      status: "status",
      "assigned to": "assignedTo",
      "assigned by": "assignedBy",
      court: "court",
      "next hearing date": "nextHearing",
      "hearing date": "nextHearing",
      description: "description",
      "created date": "createdAt",
    },
    allowedHeaders: [
      "id", "record id", "case number", "court case id", "case title", "title",
      "primary client", "client", "main category", "category", "practice",
      "subcategory", "priority", "status", "assigned to", "assigned by", "court",
      "next hearing date", "hearing date", "description", "created date",
    ],
  },
  tasks: {
    displayNames: {
      id: "id",
      "record id": "id",
      "task title": "title",
      title: "title",
      "related case": "case",
      "client name": "client",
      client: "client",
      "main category": "mainCategory",
      subcategory: "subCategory",
      priority: "priority",
      status: "status",
      deadline: "deadline",
      "assigned to": "assignedTo",
      "assigned by": "assignedBy",
      description: "description",
      notes: "notes",
      "created date": "createdAt",
    },
    allowedHeaders: [
      "id", "record id", "task title", "title", "related case", "client name",
      "client", "main category", "subcategory", "priority", "status",
      "deadline", "assigned to", "assigned by", "description", "notes", "created date",
    ],
  },
};

const EDITABLE_FIELDS: Record<ImportEntity, string[]> = {
  clients: ["name", "type", "tag", "phone", "email", "address", "aadhar", "pan", "notes", "kyc"],
  cases: ["title", "description", "category", "practice", "mainCategory", "subCategory", "court", "courtCaseId", "priority", "status", "nextHearing"],
  tasks: ["title", "description", "priority", "status", "deadline", "notes", "category", "mainCategory", "subCategory"],
};

export function ExcelImportDialog({
  open,
  onClose,
  entity: propEntity,
  entityType,
  existingRecords = [],
  onImportSuccess,
}: ExcelImportDialogProps) {
  const entity = (propEntity || entityType || "clients") as ImportEntity;
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [diffs, setDiffs] = useState<RowDiff[]>([]);
  const [recordsToUpdateCount, setRecordsToUpdateCount] = useState(0);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const entityName = entity === "clients" ? "Clients" : entity === "cases" ? "Cases" : "Tasks";

  const handleReset = () => {
    setFile(null);
    setGlobalError(null);
    setParsedRows([]);
    setDiffs([]);
    setRecordsToUpdateCount(0);
    setUnchangedCount(0);
    setErrorCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const parseDateDDMMYYYY = (val: string): { valid: boolean; isoDate?: string; error?: string } => {
    if (!val || typeof val !== "string") return { valid: false, error: "Empty date" };
    const trimmed = val.trim();
    if (trimmed === "—" || trimmed === "-" || !trimmed) return { valid: true, isoDate: undefined };

    // Support DD/MM/YYYY
    const parts = trimmed.split(/[\/\-]/);
    if (parts.length === 3) {
      let [d, m, y] = parts.map(Number);
      if (y && m && d && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const dateObj = new Date(Date.UTC(y, m - 1, d, 18, 29, 59));
        return { valid: true, isoDate: dateObj.toISOString() };
      }
    }
    return { valid: false, error: `Invalid date "${trimmed}". Expected DD/MM/YYYY format` };
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.toLowerCase().endsWith(".xlsx")) {
      setGlobalError("Only valid Excel files (.xlsx) are supported for import.");
      return;
    }

    setFile(selectedFile);
    setGlobalError(null);
    setIsProcessing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });

      if (workbook.SheetNames.length === 0) {
        setGlobalError("The uploaded Excel workbook contains no sheets.");
        setIsProcessing(false);
        return;
      }

      // Find appropriate sheet or take the first one
      const sheetName = workbook.SheetNames.find((s) => s.toLowerCase().includes(entity.toLowerCase())) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      if (!rawRows || rawRows.length < 2) {
        setGlobalError(`The "${sheetName}" worksheet contains no data rows to import.`);
        setIsProcessing(false);
        return;
      }

      const headerRow: string[] = (rawRows[0] || []).map((h) => String(h).trim());
      const config = SUPPORTED_COLUMNS_MAP[entity];

      // 1. Detect unsupported columns
      for (const h of headerRow) {
        if (!h) continue;
        const normalized = h.toLowerCase().trim();
        if (!config.allowedHeaders.includes(normalized)) {
          setGlobalError(
            `Import failed: Unsupported column "${h}" found in the ${entityName} worksheet. Remove the column and try again.`
          );
          setIsProcessing(false);
          return;
        }
      }

      // 2. Detect missing required ID column
      const idColIdx = headerRow.findIndex(
        (h) => h.toLowerCase() === "id" || h.toLowerCase() === "record id"
      );
      if (idColIdx === -1) {
        setGlobalError(`Import failed: Required column "ID" is missing from the ${entityName} worksheet.`);
        setIsProcessing(false);
        return;
      }

      // Map headers to schema field names
      const colToField: Record<number, string> = {};
      for (let c = 0; c < headerRow.length; c++) {
        const rawH = headerRow[c].toLowerCase().trim();
        const mapped = config.displayNames[rawH];
        if (mapped) colToField[c] = mapped;
      }

      // 3. Process rows
      const existingMap = new Map<string, any>();
      for (const rec of existingRecords) {
        if (rec?._id) existingMap.set(String(rec._id), rec);
      }

      const calculatedDiffs: RowDiff[] = [];
      const validPayloadRows: Array<{ id: string; updates: Record<string, any> }> = [];
      const seenIds = new Set<string>();

      let updateCount = 0;
      let noChangeCount = 0;
      let errCount = 0;

      for (let r = 1; r < rawRows.length; r++) {
        const rowData = rawRows[r];
        if (!rowData || rowData.every((cell) => cell === "" || cell === null || cell === undefined)) {
          continue; // skip blank rows
        }

        const rawId = String(rowData[idColIdx] || "").trim();
        const rowNum = r + 1;

        if (!rawId) {
          errCount++;
          calculatedDiffs.push({
            rowNum,
            id: "—",
            recordName: `Row ${rowNum}`,
            field: "ID",
            currentVal: "—",
            importedVal: "Empty",
            status: "error",
            errorMessage: "Record ID is missing in row",
          });
          continue;
        }

        // Validate MongoDB ObjectId format
        if (!/^[0-9a-fA-F]{24}$/.test(rawId)) {
          errCount++;
          calculatedDiffs.push({
            rowNum,
            id: rawId,
            recordName: `Row ${rowNum}`,
            field: "ID",
            currentVal: rawId,
            importedVal: rawId,
            status: "error",
            errorMessage: `Invalid ID format "${rawId}" (must be a valid 24-character hexadecimal ID)`,
          });
          continue;
        }

        // Check for duplicate ID within file
        if (seenIds.has(rawId)) {
          errCount++;
          calculatedDiffs.push({
            rowNum,
            id: rawId,
            recordName: `Row ${rowNum}`,
            field: "ID",
            currentVal: rawId,
            importedVal: rawId,
            status: "error",
            errorMessage: `Duplicate record ID "${rawId}" found in spreadsheet`,
          });
          continue;
        }
        seenIds.add(rawId);

        // Find existing record
        const existingDoc = existingMap.get(rawId);
        if (!existingDoc && existingRecords.length > 0) {
          errCount++;
          calculatedDiffs.push({
            rowNum,
            id: rawId,
            recordName: `Row ${rowNum}`,
            field: "ID",
            currentVal: "Not Found",
            importedVal: rawId,
            status: "error",
            errorMessage: `Record with ID "${rawId}" does not exist or you do not have permission to edit it`,
          });
          continue;
        }

        const recordTitle =
          existingDoc?.name ||
          existingDoc?.title ||
          existingDoc?.number ||
          `Record ${rawId.slice(-6)}`;

        const allowedEditable = EDITABLE_FIELDS[entity];
        const rowUpdates: Record<string, any> = {};
        let rowHasChanges = false;
        let rowHasError = false;

        for (let colIdx = 0; colIdx < rowData.length; colIdx++) {
          const field = colToField[colIdx];
          if (!field || field === "id" || field === "createdAt") continue;

          // Only process editable fields
          if (!allowedEditable.includes(field)) continue;

          let rawCell = rowData[colIdx];
          if (typeof rawCell === "string") {
            // Strip leading quote from formula sanitization
            if (rawCell.startsWith("'")) rawCell = rawCell.slice(1);
            rawCell = rawCell.trim();
          }

          const currentVal = existingDoc ? String(existingDoc[field] ?? "").trim() : "";
          const importedVal = String(rawCell ?? "").trim();

          // Date validation for deadline or nextHearing
          if (field === "deadline" || field === "nextHearing") {
            if (importedVal && importedVal !== "—" && importedVal !== "-") {
              const dateCheck = parseDateDDMMYYYY(importedVal);
              if (!dateCheck.valid) {
                rowHasError = true;
                errCount++;
                calculatedDiffs.push({
                  rowNum,
                  id: rawId,
                  recordName: recordTitle,
                  field,
                  currentVal,
                  importedVal,
                  status: "error",
                  errorMessage: dateCheck.error,
                });
                continue;
              }
              if (currentVal !== importedVal) {
                rowHasChanges = true;
                rowUpdates[field] = dateCheck.isoDate;
                calculatedDiffs.push({
                  rowNum,
                  id: rawId,
                  recordName: recordTitle,
                  field,
                  currentVal: currentVal || "—",
                  importedVal,
                  status: "valid",
                });
              }
            } else if (currentVal && !importedVal) {
              rowHasChanges = true;
              rowUpdates[field] = null;
              calculatedDiffs.push({
                rowNum,
                id: rawId,
                recordName: recordTitle,
                field,
                currentVal,
                importedVal: "Cleared",
                status: "valid",
              });
            }
            continue;
          }

          // Enum validation
          if (field === "priority" && importedVal) {
            if (!["High", "Medium", "Low"].includes(importedVal)) {
              rowHasError = true;
              errCount++;
              calculatedDiffs.push({
                rowNum,
                id: rawId,
                recordName: recordTitle,
                field,
                currentVal,
                importedVal,
                status: "error",
                errorMessage: `Invalid priority "${importedVal}". Expected High, Medium, or Low`,
              });
              continue;
            }
          }

          if (currentVal !== importedVal) {
            rowHasChanges = true;
            rowUpdates[field] = importedVal;
            calculatedDiffs.push({
              rowNum,
              id: rawId,
              recordName: recordTitle,
              field,
              currentVal: currentVal || "—",
              importedVal: importedVal || "—",
              status: "valid",
            });
          }
        }

        if (!rowHasError) {
          if (rowHasChanges) {
            updateCount++;
            validPayloadRows.push({ id: rawId, updates: rowUpdates });
          } else {
            noChangeCount++;
          }
        }
      }

      setDiffs(calculatedDiffs);
      setParsedRows(validPayloadRows);
      setRecordsToUpdateCount(updateCount);
      setUnchangedCount(noChangeCount);
      setErrorCount(errCount);
    } catch (err: any) {
      console.error("[ExcelImport] Parsing error:", err);
      setGlobalError(err?.message || "Failed to read Excel file. Please ensure it is a valid .xlsx file.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyImport = async () => {
    if (parsedRows.length === 0) {
      toast.info("No modified records to update.");
      return;
    }

    setIsProcessing(true);
    try {
      const endpoint = `/${entity}/import-excel`;
      const res: any = await api.post(endpoint, { rows: parsedRows });

      toast.success(
        `Import Successful: ${res.updatedCount || parsedRows.length} record(s) updated, ${res.unchangedCount || unchangedCount} unchanged.`
      );

      // Invalidate relevant caches immediately
      if (entity === "clients") {
        queryClient.invalidateQueries({ queryKey: clientKeys.all });
      } else if (entity === "cases") {
        queryClient.invalidateQueries({ queryKey: caseKeys.all });
      } else if (entity === "tasks") {
        queryClient.invalidateQueries({ queryKey: taskKeys.all });
      }

      onImportSuccess?.();
      handleClose();
    } catch (err: any) {
      console.error("[ExcelImport] Submission error:", err);
      toast.error(err?.message || "Failed to apply Excel updates to database.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : null)}>
      <DialogContent className="max-w-3xl rounded-2xl p-6 shadow-lift border-border bg-card">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileSpreadsheet className="size-5 text-primary" />
            <span>Import &amp; Synchronize {entityName} from Excel</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Upload an edited <code>.xlsx</code> file previously exported from LegalOS. Existing records will be updated safely using their record IDs.
          </DialogDescription>
        </DialogHeader>

        {/* Global Error Banner */}
        {globalError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 flex items-start gap-3 text-destructive text-xs">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Validation Error</span>
              <p className="mt-0.5 text-[11px] leading-relaxed">{globalError}</p>
            </div>
          </div>
        )}

        {/* File Picker Zone */}
        {!file ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-border/80 bg-muted/20 p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/40 transition-all group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".xlsx"
              className="hidden"
            />
            <div className="size-12 rounded-full bg-primary/10 text-primary grid place-items-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <Upload className="size-6" />
            </div>
            <p className="text-xs font-semibold text-foreground">Click to select an Excel workbook (.xlsx)</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Supports exported {entityName} spreadsheets with preserved ID columns
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info bar */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30 text-xs">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-foreground">{file.name}</span>
                <span className="text-[11px] text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={isProcessing}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Choose another file
              </Button>
            </div>

            {/* Validation & Diff Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 block">Records to Update</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 num mt-0.5 block">
                  {recordsToUpdateCount}
                </span>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 text-center">
                <span className="text-[11px] font-medium text-muted-foreground block">Unchanged Records</span>
                <span className="text-xl font-bold text-foreground num mt-0.5 block">{unchangedCount}</span>
              </div>
              <div className={`rounded-xl border p-3 text-center ${errorCount > 0 ? "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400" : "border-border bg-card text-muted-foreground"}`}>
                <span className="text-[11px] font-medium block">Errors / Invalid Rows</span>
                <span className="text-xl font-bold num mt-0.5 block">{errorCount}</span>
              </div>
            </div>

            {/* Diff Preview Table */}
            {diffs.length > 0 ? (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between text-xs font-semibold">
                  <span>Import Preview &amp; Changes Detected ({diffs.length})</span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Review modifications before synchronizing
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[11px]">
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Record</th>
                        <th className="py-2 px-3">Field</th>
                        <th className="py-2 px-3">Current Value</th>
                        <th className="py-2 px-3">Imported Value</th>
                        <th className="py-2 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {diffs.map((d, i) => (
                        <tr key={i} className={d.status === "error" ? "bg-rose-500/5" : "hover:bg-muted/10"}>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{d.rowNum}</td>
                          <td className="py-2 px-3 font-medium text-foreground truncate max-w-[120px]" title={d.recordName}>
                            {d.recordName}
                          </td>
                          <td className="py-2 px-3 capitalize text-muted-foreground">{d.field}</td>
                          <td className="py-2 px-3 text-muted-foreground truncate max-w-[100px]" title={d.currentVal}>
                            {d.currentVal}
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground truncate max-w-[120px]" title={d.importedVal}>
                            {d.importedVal}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {d.status === "valid" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="size-3" /> Valid change
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium" title={d.errorMessage}>
                                <AlertTriangle className="size-3" /> {d.errorMessage || "Error"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : !globalError && (
              <div className="p-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                <CheckCircle2 className="size-6 text-muted-foreground mx-auto mb-2 opacity-60" />
                No field differences detected between the uploaded spreadsheet and current database records.
              </div>
            )}
          </div>
        )}

        <DialogFooter className="border-t border-border pt-3 gap-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isProcessing} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleApplyImport}
            disabled={isProcessing || parsedRows.length === 0 || Boolean(globalError)}
            className="gradient-primary text-primary-foreground text-xs font-semibold gap-1.5"
          >
            {isProcessing && <Loader2 className="size-3.5 animate-spin" />}
            Confirm &amp; Update Database ({recordsToUpdateCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
