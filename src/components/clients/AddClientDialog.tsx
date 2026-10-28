import { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  UserPlus,
  Building2,
  Users,
  FileBadge,
  Home,
  Loader2,
  Calendar,
  Clock,
  UserCheck,
  FileText,
  Check,
  AlertCircle,
  Briefcase,
  CheckSquare,
  FolderOpen,
  CornerDownRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useCreateClient, type CreateClientPayload, type SubClient } from "@/services/clients";
import { useCreateCase, type CaseTaskPayload, type CaseParty } from "@/services/cases";
import { useEmployees } from "@/services/admin";
import { useTaskOptions, type ChecklistItem } from "@/services/tasks";
import { useCategoryTree, useCategories, extractCategoryName, isOtherWorkCategory, isHeirshipCategory } from "@/services/categories";
import { AssigneeMultiSelect } from "@/components/common/AssigneeMultiSelect";
import { toSafeIso } from "@/lib/dates";
import {
  validatePhone,
  validateAadhaar,
  validatePan,
  validateEmail,
  sanitizePhone,
  sanitizePan,
  sanitizeAadhaar,
} from "@/lib/validation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubClientEntry {
  name: string;
  relationship: string;
  description: string;
  phone: string;
  email: string;
}

interface FormState {
  type: "Individual" | "Corporate";
  tag: "Active" | "VIP" | "Corporate" | "Individual" | "Archived";
  name: string;
  phone: string;
  email: string;
  address: string;
  aadhar: string;
  pan: string;
  notes: string;
  promisedCompletionDate: string;
  assignedTo: string[];
  propertyAddress: string;
  surveyNo: string;
  chsName: string;
  sector: string;
  plot: string;
  area: string;
}

const EMPTY_FORM: FormState = {
  type: "Individual",
  tag: "Active",
  name: "",
  phone: "",
  email: "",
  address: "",
  aadhar: "",
  pan: "",
  notes: "",
  promisedCompletionDate: "",
  assignedTo: [],
  propertyAddress: "",
  surveyNo: "",
  chsName: "",
  sector: "",
  plot: "",
  area: "",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AddClientDialogProps {
  open: boolean;
  onClose: () => void;
}

interface CaseFormState {
  title: string;
  courtCaseId: string;
  countCaseNumber: string;
  nextHearing: string;
  description: string;
  category: string;
  mainCategory: string;
  subCategory: string;
  selectedSubCategories: string[];
  customCategory: string;
  localPath: string;
  status: "Active" | "On Hold" | "Closed" | "Urgent";
  priority: "High" | "Medium" | "Low";
  tags: string[];
  assignedTo: string[];
}

const EMPTY_CASE_FORM: CaseFormState = {
  title: "",
  courtCaseId: "",
  countCaseNumber: "",
  nextHearing: "",
  description: "",
  category: "Other Work",
  mainCategory: "",
  subCategory: "",
  selectedSubCategories: [],
  customCategory: "",
  localPath: "",
  status: "Active",
  priority: "Medium",
  tags: [],
  assignedTo: [],
};

export interface OnboardingTaskEntry {
  title: string;
  description?: string;
  notes?: string;
  mainCategory?: string;
  subCategory?: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  deadline: string;
  assignedTo: string[];
  checklist: ChecklistItem[];
}

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  aadhar?: string;
  pan?: string;
  caseTitle?: string;
}

export function AddClientDialog({ open, onClose }: AddClientDialogProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [subClients, setSubClients] = useState<SubClientEntry[]>([]);
  const [showProperty, setShowProperty] = useState(false);
  const [showSubClient, setShowSubClient] = useState(false);

  // Optional Onboarding Case & Tasks State
  const [createInitialCase, setCreateInitialCase] = useState(false);
  const [caseForm, setCaseForm] = useState<CaseFormState>(EMPTY_CASE_FORM);
  const [parties, setParties] = useState<Array<{ name: string; role: string; type: "client" | "sub_client" | "opposing_party" | "counsel" | "other" }>>([]);
  const [initialTasks, setInitialTasks] = useState<OnboardingTaskEntry[]>([]);
  const [checkedSubCategoriesForTasks, setCheckedSubCategoriesForTasks] = useState<string[]>([]);
  const [expandedTaskIndexes, setExpandedTaskIndexes] = useState<Record<number, boolean>>({});
  const [tagInput, setTagInput] = useState("");
  const [subtaskInput, setSubtaskInput] = useState<Record<number, string>>({});
  const [isCreatingCase, setIsCreatingCase] = useState(false);
  const [isCaseTitleManuallyEdited, setIsCaseTitleManuallyEdited] = useState(false);

  useEffect(() => {
    if (open) {
      setIsCaseTitleManuallyEdited(false);
    }
  }, [open]);

  const { data: rawCategories = [] } = useCategories();
  const { data: categoryTree = [], isLoading: isCategoriesLoading, isError: isCategoriesError } = useCategoryTree();

  const categories = useMemo(() => {
    const rawObj = rawCategories && typeof rawCategories === "object" ? (rawCategories as Record<string, unknown>) : null;
    const list = Array.isArray(rawCategories)
      ? rawCategories
      : Array.isArray(rawObj?.categories)
      ? (rawObj?.categories as unknown[])
      : [];
    return list
      .map(extractCategoryName)
      .filter(Boolean);
  }, [rawCategories]);

  const normalizedTree = useMemo(() => {
    const rawObj = categoryTree && typeof categoryTree === "object" ? (categoryTree as Record<string, unknown>) : null;
    let list: any[] = [];
    if (Array.isArray(categoryTree)) list = categoryTree;
    else if (Array.isArray(rawObj?.tree)) list = rawObj.tree as any[];
    else if (Array.isArray(rawObj?.data)) list = rawObj.data as any[];
    return list.filter((c) => !isOtherWorkCategory(c?.name));
  }, [categoryTree]);

  const selectedParent = normalizedTree.find((c) => c?.name === caseForm.mainCategory);
  const availableSubCategories = selectedParent?.children ?? [];
  const selectedSubCatNode = availableSubCategories.find((sc) => sc.name === caseForm.subCategory);
  const availableNestedSubCategories = selectedSubCatNode?.children ?? [];
  const [expandedSubCategoryGroups, setExpandedSubCategoryGroups] = useState<Record<string, boolean>>({ "SPECIAL LEGAL WORK": true });

  const updateCase = <K extends keyof CaseFormState>(key: K, value: CaseFormState[K]) => {
    setCaseForm((prev) => ({ ...prev, [key]: value }));
    if (key === "title" && fieldErrors.caseTitle) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.caseTitle;
        return next;
      });
    }
  };

  const handleSelectMainCategory = (catName: string) => {
    const isSelected = caseForm.mainCategory === catName;
    const nextVal = isSelected ? "" : catName;
    setCaseForm((prev) => {
      const clientName = form.name.trim();
      const catLabel = nextVal === "__other__" ? (prev.customCategory.trim() || "Custom Matter") : nextVal;
      // Auto-fill title like (Client Name - Main Category)
      const autoTitle = catLabel ? (clientName ? `${clientName} - ${catLabel}` : catLabel) : (clientName || "");
      return {
        ...prev,
        mainCategory: nextVal,
        subCategory: "",
        selectedSubCategories: [],
        categoryPath: [],
        customCategory: nextVal !== "__other__" ? "" : prev.customCategory,
        title: isCaseTitleManuallyEdited && prev.title.trim() ? prev.title : (autoTitle || prev.title),
        nextHearing: isHeirshipCategory(nextVal) ? prev.nextHearing : "",
      };
    });
    if (fieldErrors.caseTitle) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.caseTitle;
        return next;
      });
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !caseForm.tags.includes(trimmed)) {
      updateCase("tags", [...caseForm.tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateCase("tags", caseForm.tags.filter((t) => t !== tagToRemove));
  };

  const addParty = () => {
    setParties((prev) => [
      ...prev,
      { name: "", role: "Opposing Party", type: "opposing_party" },
    ]);
  };

  const updateParty = (
    index: number,
    field: "name" | "role" | "type",
    val: string
  ) => {
    setParties((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: val } : p))
    );
  };

  const removeParty = (index: number) => {
    setParties((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleTaskExpand = (index: number) => {
    setExpandedTaskIndexes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleAddSelectedSubCategoriesAsTasks = () => {
    if (checkedSubCategoriesForTasks.length === 0) return;
    const newTasks: OnboardingTaskEntry[] = [];
    const existingTitles = new Set(initialTasks.map((t) => t.title.toLowerCase()));

    const defaultTaskAssignees = (caseForm.assignedTo && caseForm.assignedTo.length > 0)
      ? caseForm.assignedTo
      : (form.assignedTo && form.assignedTo.length > 0)
      ? form.assignedTo
      : [];

    for (const scName of checkedSubCategoriesForTasks) {
      if (!existingTitles.has(scName.toLowerCase())) {
        newTasks.push({
          title: scName,
          category: scName,
          mainCategory: caseForm.mainCategory,
          subCategory: scName,
          priority: "Medium",
          deadline: "",
          assignedTo: defaultTaskAssignees,
          notes: "",
          description: "",
          checklist: [],
        });
        existingTitles.add(scName.toLowerCase());
      }
    }

    if (newTasks.length > 0) {
      const startIdx = initialTasks.length;
      setInitialTasks((prev) => [...prev, ...newTasks]);
      toast.success(`Added ${newTasks.length} task(s) from selected subcategories`);
      setExpandedTaskIndexes((prev) => {
        const next = { ...prev };
        for (let i = 0; i < newTasks.length; i++) {
          next[startIdx + i] = true;
        }
        return next;
      });
      setCheckedSubCategoriesForTasks([]);
    } else {
      toast.info("Selected subcategories are already added as tasks");
    }
  };

  const addTask = () => {
    const newIdx = initialTasks.length;
    const defaultAssignees = (caseForm.assignedTo && caseForm.assignedTo.length > 0)
      ? caseForm.assignedTo
      : (form.assignedTo && form.assignedTo.length > 0)
      ? form.assignedTo
      : [];
    setInitialTasks((prev) => [
      ...prev,
      {
        title: "",
        category: caseForm.category || "Other Work",
        mainCategory: caseForm.mainCategory,
        subCategory: "",
        priority: "Medium",
        deadline: "",
        assignedTo: defaultAssignees,
        notes: "",
        description: "",
        checklist: [],
      },
    ]);
    setExpandedTaskIndexes((prev) => ({ ...prev, [newIdx]: true }));
  };

  const updateTask = (
    index: number,
    field: keyof OnboardingTaskEntry,
    val: any
  ) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: val } : t))
    );
  };

  const removeTask = (index: number) => {
    setInitialTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const addChecklistItemToTask = (taskIndex: number) => {
    const text = (subtaskInput[taskIndex] || "").trim();
    if (!text) return;
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        const newItem: ChecklistItem = {
          id: `task_${taskIndex}_cl_${Date.now()}_${t.checklist.length}`,
          text,
          done: false,
          subItems: [],
        };
        return { ...t, checklist: [...t.checklist, newItem] };
      })
    );
    setSubtaskInput((prev) => ({ ...prev, [taskIndex]: "" }));
  };

  const addSubCategoryToTaskChecklist = (taskIndex: number, scName: string) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        if (t.checklist.some((item) => item.text.toLowerCase() === scName.toLowerCase())) {
          return t;
        }
        const newItem: ChecklistItem = {
          id: `task_${taskIndex}_cl_${Date.now()}_${t.checklist.length}`,
          text: scName,
          done: false,
          subItems: [],
        };
        return { ...t, checklist: [...t.checklist, newItem] };
      })
    );
  };

  const addAllSubCategoriesToTaskChecklist = (taskIndex: number) => {
    if (!availableSubCategories.length) return;
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        const existingTexts = new Set(t.checklist.map((item) => item.text.toLowerCase()));
        const toAdd: ChecklistItem[] = availableSubCategories
          .filter((sc) => !existingTexts.has(sc.name.toLowerCase()))
          .map((sc, idx) => ({
            id: `task_${taskIndex}_cl_${Date.now()}_${t.checklist.length + idx}`,
            text: sc.name,
            done: false,
            subItems: [],
          }));
        return { ...t, checklist: [...t.checklist, ...toAdd] };
      })
    );
  };

  const removeChecklistItemFromTask = (taskIndex: number, checkIndex: number) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          checklist: t.checklist.filter((_, ci) => ci !== checkIndex),
        };
      })
    );
  };

  const updateChecklistItemText = (taskIndex: number, checkIndex: number, text: string) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          checklist: t.checklist.map((item, ci) => (ci === checkIndex ? { ...item, text } : item)),
        };
      })
    );
  };

  const addSubItemToTaskChecklist = (taskIndex: number, checkIndex: number) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          checklist: t.checklist.map((item, ci) => {
            if (ci !== checkIndex) return item;
            const subItems = Array.isArray(item.subItems) ? item.subItems : [];
            return {
              ...item,
              subItems: [
                ...subItems,
                { id: `sub_${Date.now()}_${subItems.length}`, text: "", done: false },
              ],
            };
          }),
        };
      })
    );
  };

  const updateSubItemText = (
    taskIndex: number,
    checkIndex: number,
    subIndex: number,
    text: string
  ) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          checklist: t.checklist.map((item, ci) => {
            if (ci !== checkIndex) return item;
            const subItems = Array.isArray(item.subItems) ? item.subItems : [];
            return {
              ...item,
              subItems: subItems.map((sub, si) => (si === subIndex ? { ...sub, text } : sub)),
            };
          }),
        };
      })
    );
  };

  const removeSubItemFromTaskChecklist = (
    taskIndex: number,
    checkIndex: number,
    subIndex: number
  ) => {
    setInitialTasks((prev) =>
      prev.map((t, i) => {
        if (i !== taskIndex) return t;
        return {
          ...t,
          checklist: t.checklist.map((item, ci) => {
            if (ci !== checkIndex) return item;
            const subItems = Array.isArray(item.subItems) ? item.subItems : [];
            return {
              ...item,
              subItems: subItems.filter((_, si) => si !== subIndex),
            };
          }),
        };
      })
    );
  };

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [subClientErrors, setSubClientErrors] = useState<{
    [idx: number]: { name?: string; relationship?: string; phone?: string; email?: string };
  }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  const { data: empData } = useEmployees();
  const employees = empData?.employees ?? [];

  const createClient = useCreateClient();
  const createCase = useCreateCase();
  const isPending = createClient.isPending || isCreatingCase;
  const isError = createClient.isError;

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "name" && typeof value === "string") {
      const nextName = value.trim();
      setCaseForm((prev) => {
        if (isCaseTitleManuallyEdited && prev.title.trim()) return prev;
        if (!prev.mainCategory) return prev;
        const catLabel = prev.mainCategory === "__other__" ? (prev.customCategory.trim() || "Custom Matter") : prev.mainCategory;
        return {
          ...prev,
          title: nextName ? `${nextName} - ${catLabel}` : catLabel,
        };
      });
    }
    const errorKey = key as keyof FormErrors;
    if (fieldErrors[errorKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
    if (generalError) setGeneralError(null);
  };

  const toggleStaff = (empId: string) => {
    setForm((prev) => {
      const exists = prev.assignedTo.includes(empId);
      const nextAssigned = exists
        ? prev.assignedTo.filter((id) => id !== empId)
        : [...prev.assignedTo, empId];

      setCaseForm((cPrev) => {
        const isCaseUntouchedOrInSync =
          cPrev.assignedTo.length === 0 ||
          (cPrev.assignedTo.length === prev.assignedTo.length &&
            cPrev.assignedTo.every((id) => prev.assignedTo.includes(id)));
        if (isCaseUntouchedOrInSync) {
          return { ...cPrev, assignedTo: nextAssigned };
        }
        return cPrev;
      });

      return {
        ...prev,
        assignedTo: nextAssigned,
      };
    });
  };

  const addSubClient = () => {
    setSubClients((prev) => [
      ...prev,
      { name: "", relationship: "", description: "", phone: "", email: "" },
    ]);
    setShowSubClient(true);
  };

  const updateSubClient = (idx: number, key: keyof SubClientEntry, value: string) => {
    setSubClients((prev) =>
      prev.map((sc, i) => (i === idx ? { ...sc, [key]: value } : sc)),
    );
    if (subClientErrors[idx]?.[key as "name" | "relationship" | "phone" | "email"]) {
      setSubClientErrors((prev) => {
        const next = { ...prev };
        if (next[idx]) {
          delete next[idx][key as "name" | "relationship" | "phone" | "email"];
        }
        return next;
      });
    }
    if (generalError) setGeneralError(null);
  };

  const removeSubClient = (idx: number) => {
    setSubClients((prev) => prev.filter((_, i) => i !== idx));
    setSubClientErrors((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // If client was already created in previous attempt, retry only the case creation
    if (createdClientId) {
      if (!caseForm.title.trim()) {
        setFieldErrors({ caseTitle: "Case title is required" });
        return;
      }
      setIsCreatingCase(true);
      setGeneralError(null);
      try {
        const validParties: CaseParty[] = [
          {
            clientId: createdClientId,
            name: form.name.trim() || "Primary Client",
            role: "Primary Client",
            type: "client",
          },
          ...parties
            .filter((p) => p.name.trim())
            .map((p) => ({
              name: p.name.trim(),
              role: p.role.trim() || "Party",
              type: p.type,
            })),
        ];

        const caseTasksPayload: CaseTaskPayload[] = initialTasks
          .filter((t) => t.title.trim())
          .map((t) => ({
            title: t.title.trim(),
            description: t.description?.trim() || undefined,
            notes: t.notes?.trim() || undefined,
            mainCategory: t.mainCategory || caseForm.mainCategory || undefined,
            subCategory: t.subCategory || undefined,
            category: t.category || t.subCategory || "Other Work",
            priority: t.priority,
            deadline: t.deadline ? toSafeIso(t.deadline) ?? undefined : undefined,
            assignedTo:
              t.assignedTo.length > 0
                ? t.assignedTo
                : caseForm.assignedTo?.length > 0
                ? caseForm.assignedTo
                : form.assignedTo?.length > 0
                ? form.assignedTo
                : undefined,
            assignedUsers:
              t.assignedTo.length > 0
                ? t.assignedTo
                : caseForm.assignedTo?.length > 0
                ? caseForm.assignedTo
                : form.assignedTo?.length > 0
                ? form.assignedTo
                : undefined,
            checklist: t.checklist
              .filter((item) => item.text && item.text.trim())
              .map((item) => ({
                text: item.text.trim(),
                done: Boolean(item.done),
                subItems: (item.subItems || [])
                  .filter((sub) => sub.text && sub.text.trim())
                  .map((sub) => ({
                    text: sub.text.trim(),
                    done: Boolean(sub.done),
                  })),
              })),
          }));

        const subCatJoined =
          caseForm.selectedSubCategories.length > 0
            ? caseForm.selectedSubCategories.join(", ")
            : caseForm.subCategory;

        const chosenCategory =
          (subCatJoined === "__other__" || caseForm.mainCategory === "__other__"
            ? caseForm.customCategory.trim()
            : subCatJoined) ||
          (caseForm.mainCategory === "__other__"
            ? caseForm.customCategory.trim()
            : caseForm.mainCategory) ||
          caseForm.category ||
          "Other Work";

        const casePayload = {
          title: caseForm.title.trim(),
          description: caseForm.description.trim() || undefined,
          category: chosenCategory,
          mainCategory:
            caseForm.mainCategory === "__other__"
              ? caseForm.customCategory.trim() || "Other Work"
              : caseForm.mainCategory || undefined,
          subCategory:
            subCatJoined === "__other__"
              ? caseForm.customCategory.trim() || undefined
              : subCatJoined || undefined,
          categoryPath:
            caseForm.selectedSubCategories.length > 0
              ? caseForm.selectedSubCategories
              : undefined,
          courtCaseId: caseForm.courtCaseId.trim() || undefined,
          countCaseNumber:
            caseForm.countCaseNumber.trim() ||
            caseForm.courtCaseId.trim() ||
            undefined,
          nextHearing: isHeirshipCategory(caseForm.mainCategory) && caseForm.nextHearing
            ? (toSafeIso(caseForm.nextHearing) ?? undefined)
            : undefined,
          localPath: caseForm.localPath.trim() || undefined,
          status: caseForm.status,
          priority: caseForm.priority,
          assignedTo:
            caseForm.assignedTo && caseForm.assignedTo.length > 0
              ? caseForm.assignedTo
              : form.assignedTo && form.assignedTo.length > 0
              ? form.assignedTo
              : undefined,
          assignedUsers:
            caseForm.assignedTo && caseForm.assignedTo.length > 0
              ? caseForm.assignedTo
              : form.assignedTo && form.assignedTo.length > 0
              ? form.assignedTo
              : undefined,
          parties: validParties,
          tags: caseForm.tags.length > 0 ? caseForm.tags : undefined,
          tasks: caseTasksPayload.length > 0 ? caseTasksPayload : undefined,
        };

        await createCase.mutateAsync(casePayload);
        toast.success(`Matter "${caseForm.title.trim()}" created successfully!`);
        setCreatedClientId(null);
        setForm(EMPTY_FORM);
        setSubClients([]);
        setCreateInitialCase(false);
        setCaseForm(EMPTY_CASE_FORM);
        setParties([]);
        setInitialTasks([]);
        onClose();
        return;
      } catch (retryErr: any) {
        console.error("Failed to retry case creation:", retryErr);
        const errDetail = retryErr?.message || retryErr?.body?.message || "Unknown error";
        setGeneralError(`Case creation failed: ${errDetail}. Please check fields and try again.`);
        toast.error(`Case creation failed: ${errDetail}`);
        setIsCreatingCase(false);
        return;
      }
    }
    setGeneralError(null);
    const errors: FormErrors = {};

    if (!form.name.trim()) {
      errors.name = "Client name is required";
    }

    if (form.phone.trim()) {
      const pCheck = validatePhone(form.phone);
      if (!pCheck.valid) errors.phone = pCheck.error ?? "Invalid phone number";
    }

    if (form.email.trim()) {
      const eCheck = validateEmail(form.email);
      if (!eCheck.valid) errors.email = eCheck.error ?? "Invalid email format";
    }

    if (form.aadhar.trim()) {
      const aCheck = validateAadhaar(form.aadhar);
      if (!aCheck.valid) errors.aadhar = aCheck.error ?? "Invalid Aadhaar number";
    }

    if (form.pan.trim()) {
      const panCheck = validatePan(form.pan);
      if (!panCheck.valid) errors.pan = panCheck.error ?? "Invalid PAN format";
    }

    // Sub-client validation
    const scErrors: { [idx: number]: { name?: string; relationship?: string; phone?: string; email?: string } } = {};
    let hasScErrors = false;

    // Filter sub-clients that have any field filled
    const activeSubClients = subClients.filter(
      (sc) =>
        sc.name.trim() ||
        sc.relationship.trim() ||
        sc.phone.trim() ||
        sc.email.trim() ||
        sc.description.trim()
    );

    subClients.forEach((sc, idx) => {
      const hasAny =
        sc.name.trim() ||
        sc.relationship.trim() ||
        sc.phone.trim() ||
        sc.email.trim() ||
        sc.description.trim();

      if (hasAny) {
        const itemErrors: { name?: string; relationship?: string; phone?: string; email?: string } = {};
        if (!sc.name.trim()) {
          itemErrors.name = "Sub-client name is required";
          hasScErrors = true;
        }
        if (!sc.relationship.trim()) {
          itemErrors.relationship = "Relationship is required (e.g. Spouse, Director, Partner)";
          hasScErrors = true;
        }
        if (sc.phone.trim()) {
          const pCheck = validatePhone(sc.phone);
          if (!pCheck.valid) {
            itemErrors.phone = pCheck.error ?? "Invalid phone number";
            hasScErrors = true;
          }
        }
        if (sc.email.trim()) {
          const eCheck = validateEmail(sc.email);
          if (!eCheck.valid) {
            itemErrors.email = eCheck.error ?? "Invalid email format";
            hasScErrors = true;
          }
        }
        if (Object.keys(itemErrors).length > 0) {
          scErrors[idx] = itemErrors;
        }
      }
    });

    // Case Title validation if initial case creation is toggled on
    if (createInitialCase && !caseForm.title.trim()) {
      errors.caseTitle = "Matter / Case title is required when initial case is enabled";
    }

    if (Object.keys(errors).length > 0 || hasScErrors) {
      setFieldErrors(errors);
      setSubClientErrors(scErrors);
      setGeneralError("Please fix the errors in the form before saving.");
      return;
    }
    setFieldErrors({});
    setSubClientErrors({});

    const payload: CreateClientPayload = {
      type: form.type,
      tag: form.tag,
      name: form.name.trim(),
      ...(form.phone && { phone: form.phone.trim() }),
      ...(form.email && { email: form.email.trim() }),
      ...(form.address && { address: form.address.trim() }),
      ...(form.aadhar && { aadhar: form.aadhar.trim() }),
      ...(form.pan && { pan: form.pan.trim().toUpperCase() }),
      ...(form.notes && { notes: form.notes.trim() }),
      ...(form.assignedTo.length > 0 && { assignedTo: form.assignedTo }),
      ...(form.promisedCompletionDate && toSafeIso(form.promisedCompletionDate) && {
        promisedCompletionDate: toSafeIso(form.promisedCompletionDate)!,
      }),
      ...(showProperty && {
        propertyDetails: {
          address: form.propertyAddress,
          surveyNo: form.surveyNo,
          chsName: form.chsName,
          sector: form.sector,
          plot: form.plot,
          area: form.area,
        },
      }),
      ...(activeSubClients.length > 0 && {
        subClients: activeSubClients.map((sc): SubClient => ({
          name: sc.name.trim(),
          relationship: sc.relationship.trim(),
          phone: sc.phone.trim(),
          email: sc.email.trim(),
          notes: sc.description.trim(),
        })),
      }),
    };

    createClient.mutate(payload, {
      onSuccess: async (clientRes) => {
        const newClient = clientRes.client;

        if (createInitialCase && caseForm.title.trim()) {
          setIsCreatingCase(true);
          try {
            const validParties: CaseParty[] = [
              {
                clientId: newClient._id,
                name: newClient.name,
                role: "Primary Client",
                type: "client",
              },
              ...parties
                .filter((p) => p.name.trim())
                .map((p) => ({
                  name: p.name.trim(),
                  role: p.role.trim() || "Party",
                  type: p.type,
                })),
            ];

            const caseTasksPayload: CaseTaskPayload[] = initialTasks
              .filter((t) => t.title.trim())
              .map((t) => ({
                title: t.title.trim(),
                description: t.description?.trim() || undefined,
                notes: t.notes?.trim() || undefined,
                mainCategory: t.mainCategory || caseForm.mainCategory || undefined,
                subCategory: t.subCategory || undefined,
                category: t.category || t.subCategory || "Other Work",
                priority: t.priority,
                deadline: t.deadline ? toSafeIso(t.deadline) ?? undefined : undefined,
                assignedTo:
                  t.assignedTo.length > 0
                    ? t.assignedTo
                    : caseForm.assignedTo?.length > 0
                    ? caseForm.assignedTo
                    : form.assignedTo?.length > 0
                    ? form.assignedTo
                    : undefined,
                assignedUsers:
                  t.assignedTo.length > 0
                    ? t.assignedTo
                    : caseForm.assignedTo?.length > 0
                    ? caseForm.assignedTo
                    : form.assignedTo?.length > 0
                    ? form.assignedTo
                    : undefined,
                checklist: t.checklist
                  .filter((item) => item.text && item.text.trim())
                  .map((item) => ({
                    text: item.text.trim(),
                    done: Boolean(item.done),
                    subItems: (item.subItems || [])
                      .filter((sub) => sub.text && sub.text.trim())
                      .map((sub) => ({
                        text: sub.text.trim(),
                        done: Boolean(sub.done),
                      })),
                  })),
              }));

            const subCatJoined =
              caseForm.selectedSubCategories.length > 0
                ? caseForm.selectedSubCategories.join(", ")
                : caseForm.subCategory;

            const chosenCategory =
              (subCatJoined === "__other__" || caseForm.mainCategory === "__other__"
                ? caseForm.customCategory.trim()
                : subCatJoined) ||
              (caseForm.mainCategory === "__other__"
                ? caseForm.customCategory.trim()
                : caseForm.mainCategory) ||
              caseForm.category ||
              "Other Work";

            const casePayload = {
              title: caseForm.title.trim(),
              description: caseForm.description.trim() || undefined,
              category: chosenCategory,
              mainCategory:
                caseForm.mainCategory === "__other__"
                  ? caseForm.customCategory.trim() || "Other Work"
                  : caseForm.mainCategory || undefined,
              subCategory:
                subCatJoined === "__other__"
                  ? caseForm.customCategory.trim() || undefined
                  : subCatJoined || undefined,
              categoryPath:
                caseForm.selectedSubCategories.length > 0
                  ? caseForm.selectedSubCategories
                  : undefined,
              courtCaseId: caseForm.courtCaseId.trim() || undefined,
              countCaseNumber:
                caseForm.countCaseNumber.trim() ||
                caseForm.courtCaseId.trim() ||
                undefined,
              nextHearing: isHeirshipCategory(caseForm.mainCategory) && caseForm.nextHearing
                ? (toSafeIso(caseForm.nextHearing) ?? undefined)
                : undefined,
              localPath: caseForm.localPath.trim() || undefined,
              status: caseForm.status,
              priority: caseForm.priority,
              assignedTo:
                caseForm.assignedTo && caseForm.assignedTo.length > 0
                  ? caseForm.assignedTo
                  : form.assignedTo && form.assignedTo.length > 0
                  ? form.assignedTo
                  : undefined,
              assignedUsers:
                caseForm.assignedTo && caseForm.assignedTo.length > 0
                  ? caseForm.assignedTo
                  : form.assignedTo && form.assignedTo.length > 0
                  ? form.assignedTo
                  : undefined,
              parties: validParties,
              tags: caseForm.tags.length > 0 ? caseForm.tags : undefined,
              tasks: caseTasksPayload.length > 0 ? caseTasksPayload : undefined,
            };

            await createCase.mutateAsync(casePayload);

            toast.success(
              `Client and initial matter "${caseForm.title.trim()}" created successfully`
            );
          } catch (caseErr: any) {
            console.error("Failed to create initial case for client:", caseErr);
            setCreatedClientId(newClient._id);
            const errDetail = caseErr?.message || caseErr?.body?.message || "Unknown error";
            setGeneralError(
              `Client "${newClient.name}" created successfully, but creating initial case failed: ${errDetail}. You can adjust case details and click "Retry Saving Case" below without recreating the client.`
            );
            toast.warning(
              `Client "${newClient.name}" created, but initial case failed. You can retry creating the case.`
            );
            return; // Keep modal open for safe recovery without duplicate client creation
          } finally {
            setIsCreatingCase(false);
          }
        } else {
          toast.success("Client created successfully");
        }

        setCreatedClientId(null);
        setForm(EMPTY_FORM);
        setSubClients([]);
        setShowProperty(false);
        setShowSubClient(false);
        setCreateInitialCase(false);
        setCaseForm(EMPTY_CASE_FORM);
        setParties([]);
        setInitialTasks([]);
        setTagInput("");
        setSubtaskInput({});
        setFieldErrors({});
        setSubClientErrors({});
        setGeneralError(null);
        onClose();
      },
      onError: (err: any) => {
        const msg =
          err?.message ||
          err?.body?.message ||
          "Failed to save client. Please check entered details.";
        setGeneralError(msg);
        toast.error(msg);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 rounded-xl border border-border bg-card shadow-lift">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <UserPlus size={18} strokeWidth={2} />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground leading-tight">
                Add new client
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Client identification, contact details, optional case and initial tasks.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form className="space-y-6 p-6" onSubmit={handleSubmit}>
          {/* General Banner Error */}
          {generalError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 animate-in fade-in-50">
              <AlertCircle size={16} className="shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* ── Type & Tag ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-helper">Client type</Label>
              <div className="flex rounded-md border border-border">
                {(["Individual", "Corporate"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("type", t)}
                    className={`flex-1 px-3 py-2.5 text-helper font-medium transition-colors ${form.type === t
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                      } ${t === "Individual" ? "rounded-l-md border-r" : "rounded-r-md"}`}
                  >
                    {t === "Individual" ? (
                      <span className="flex items-center justify-center gap-2">
                        <UserPlus size={15} /> Individual
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Building2 size={15} /> Corporate
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-helper">Status tag</Label>
              <div className="flex flex-wrap gap-2">
                {(["Active", "VIP", "Corporate", "Individual", "Archived"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("tag", t)}
                    className={`rounded-pill px-3 py-1.5 text-caption font-medium transition-colors ${form.tag === t
                      ? "gradient-primary text-primary-foreground"
                      : "border border-border text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Basic Info ── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client-name" className="text-helper">Full name *</Label>
              <Input
                id="client-name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Adv. Rajesh Sharma"
                className={`h-11 rounded-md ${fieldErrors.name ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.name && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-phone" className="text-helper">Phone (10-digit Mobile) (Optional)</Label>
              <Input
                id="client-phone"
                value={form.phone}
                onChange={(e) => update("phone", sanitizePhone(e.target.value))}
                placeholder="9876543210"
                className={`h-11 rounded-md ${fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.phone && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.phone}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="client-email" className="text-helper">Email address (Optional)</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="client@firm.com"
                className={`h-11 rounded-md ${fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              {fieldErrors.email && (
                <p className="text-caption text-destructive font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="client-address" className="text-helper">Official / Residential Address (Optional)</Label>
              <Input
                id="client-address"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Office #402, Nariman Point, Mumbai"
                className="h-11 rounded-md"
              />
            </div>
          </div>

          {/* ── Identity Verification ── */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-helper font-medium">
              <FileBadge size={16} strokeWidth={1.75} className="text-muted-foreground" />
              Identity Verification Details <span className="text-caption text-muted-foreground">(Optional)</span>
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="client-aadhar" className="text-helper">Aadhaar Number (12 digits) (Optional)</Label>
                <Input
                  id="client-aadhar"
                  value={form.aadhar}
                  onChange={(e) => update("aadhar", sanitizeAadhaar(e.target.value))}
                  placeholder="123456789012"
                  maxLength={12}
                  className={`h-11 rounded-md ${fieldErrors.aadhar ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.aadhar && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.aadhar}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="client-pan" className="text-helper">PAN Number (10 characters) (Optional)</Label>
                <Input
                  id="client-pan"
                  value={form.pan}
                  onChange={(e) => update("pan", sanitizePan(e.target.value))}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className={`h-11 rounded-md uppercase ${fieldErrors.pan ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                {fieldErrors.pan && (
                  <p className="text-caption text-destructive font-medium">{fieldErrors.pan}</p>
                )}
              </div>
            </div>
            {form.aadhar && form.pan && (
              <p className="mt-2 text-caption text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Aadhaar and PAN provided — Identity verification will be auto-completed on creation.
              </p>
            )}
          </div>

          {/* ── Staff Assignment & Promised Delivery ── */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <p className="flex items-center gap-2 text-helper font-medium">
              <UserCheck size={16} strokeWidth={1.75} className="text-primary" />
              Staff Assignment &amp; Promised Delivery
            </p>

            {/* Multi-staff Assignment */}
            <div className="space-y-1.5">
              <Label className="text-helper">Assigned Team Members</Label>
              <p className="text-caption text-muted-foreground">Select one or more staff members responsible for handling this client:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-36 overflow-y-auto pr-1">
                {employees.map((emp) => {
                  const selected = form.assignedTo.includes(emp._id);
                  return (
                    <button
                      key={emp._id}
                      type="button"
                      onClick={() => toggleStaff(emp._id)}
                      className={`flex items-center gap-2 rounded-md border p-2 text-left text-caption transition-colors ${
                        selected
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className={`grid size-4 shrink-0 place-items-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground"}`}>
                        {selected && <Check size={12} strokeWidth={2.5} />}
                      </span>
                      <span className="truncate">{emp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Promised Completion Date & Time and Notes */}
            <div className="grid gap-4 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="client-completion" className="text-helper flex items-center gap-1.5">
                  <Calendar size={14} className="text-muted-foreground" />
                  Promised Completion Date &amp; Time (DD/MM/YYYY) (Optional)
                </Label>
                <Input
                  id="client-completion"
                  type="datetime-local"
                  value={form.promisedCompletionDate}
                  onChange={(e) => update("promisedCompletionDate", e.target.value)}
                  className="h-11 rounded-md"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="client-notes" className="text-helper flex items-center gap-1.5">
                  <FileText size={14} className="text-muted-foreground" />
                  Onboarding &amp; Client Notes (Optional)
                </Label>
                <Input
                  id="client-notes"
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Intake notes, billing preferences, etc."
                  className="h-11 rounded-md"
                />
              </div>
            </div>
          </div>

          {/* ── Property Details (Optional) ── */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowProperty(!showProperty)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <p className="flex items-center gap-2 text-helper font-medium">
                <Home size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Property Details <span className="text-caption text-muted-foreground">(optional)</span>
              </p>
              {showProperty ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {showProperty && (
              <div className="border-t border-border p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="prop-address" className="text-helper">Property address</Label>
                    <Input
                      id="prop-address"
                      value={form.propertyAddress}
                      onChange={(e) => update("propertyAddress", e.target.value)}
                      placeholder="Full property address"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-survey" className="text-helper">Survey No.</Label>
                    <Input
                      id="prop-survey"
                      value={form.surveyNo}
                      onChange={(e) => update("surveyNo", e.target.value)}
                      placeholder="Survey number"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-chs" className="text-helper">CHS / Building name</Label>
                    <Input
                      id="prop-chs"
                      value={form.chsName}
                      onChange={(e) => update("chsName", e.target.value)}
                      placeholder="e.g. Gurusamridhi CHS Ltd"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-sector" className="text-helper">Sector / Area</Label>
                    <Input
                      id="prop-sector"
                      value={form.sector}
                      onChange={(e) => update("sector", e.target.value)}
                      placeholder="e.g. Sector 14, Sanpada"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-plot" className="text-helper">Plot No.</Label>
                    <Input
                      id="prop-plot"
                      value={form.plot}
                      onChange={(e) => update("plot", e.target.value)}
                      placeholder="Plot number"
                      className="h-11 rounded-md"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prop-area" className="text-helper">Area (sq.ft.)</Label>
                    <Input
                      id="prop-area"
                      value={form.area}
                      onChange={(e) => update("area", e.target.value)}
                      placeholder="e.g. 650"
                      className="h-11 rounded-md"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Sub-Clients (Optional) ── */}
          <div className="rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setShowSubClient(!showSubClient)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <p className="flex items-center gap-2 text-helper font-medium">
                <Users size={16} strokeWidth={1.75} className="text-muted-foreground" />
                Sub-clients <span className="text-caption text-muted-foreground">(optional)</span>
              </p>
              {showSubClient ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>
            {showSubClient && (
              <div className="border-t border-border p-4">
                <p className="text-helper text-muted-foreground">
                  Add sub-clients like buyers, sellers, family members, or related parties.
                </p>

                {subClients.map((sc, idx) => (
                  <div key={idx} className="mt-4 rounded-md border border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-helper font-medium">Sub-client #{idx + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeSubClient(idx)}
                        className="grid size-8 place-items-center rounded-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Remove sub-client"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-name-${idx}`} className="text-helper">Name *</Label>
                        <Input
                          id={`sc-name-${idx}`}
                          value={sc.name}
                          onChange={(e) => updateSubClient(idx, "name", e.target.value)}
                          placeholder="Full name"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.name ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.name && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].name}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-rel-${idx}`} className="text-helper">Relationship *</Label>
                        <Input
                          id={`sc-rel-${idx}`}
                          value={sc.relationship}
                          onChange={(e) => updateSubClient(idx, "relationship", e.target.value)}
                          placeholder="Buyer / Seller / Partner"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.relationship ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.relationship && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].relationship}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={`sc-desc-${idx}`} className="text-helper">Description / Notes</Label>
                        <Input
                          id={`sc-desc-${idx}`}
                          value={sc.description}
                          onChange={(e) => updateSubClient(idx, "description", e.target.value)}
                          placeholder="Who is this sub-client and their role in the matter"
                          className="h-10 rounded-md"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-phone-${idx}`} className="text-helper">Phone (Optional)</Label>
                        <Input
                          id={`sc-phone-${idx}`}
                          value={sc.phone}
                          onChange={(e) => updateSubClient(idx, "phone", e.target.value)}
                          placeholder="+91-XXXXXXXXXX"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.phone ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.phone && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].phone}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`sc-email-${idx}`} className="text-helper">Email (Optional)</Label>
                        <Input
                          id={`sc-email-${idx}`}
                          value={sc.email}
                          onChange={(e) => updateSubClient(idx, "email", e.target.value)}
                          placeholder="email@example.com"
                          className={`h-10 rounded-md ${subClientErrors[idx]?.email ? "border-destructive focus-visible:ring-destructive/30 bg-destructive/5" : ""}`}
                        />
                        {subClientErrors[idx]?.email && (
                          <p className="text-caption text-destructive flex items-center gap-1 font-medium">
                            <AlertCircle size={12} /> {subClientErrors[idx].email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSubClient}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-helper text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus size={16} /> Add sub-client
                </button>
              </div>
            )}
          </div>

          {/* ── Optional Initial Matter / Case & Initial Tasks Onboarding ── */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5 space-y-4">
            <div className="flex items-start sm:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-3">
                <div className="pt-0.5 sm:pt-0">
                  <Checkbox
                    id="toggle-initial-case"
                    checked={createInitialCase}
                    onCheckedChange={(checked) => setCreateInitialCase(Boolean(checked))}
                    className="size-5 border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </div>
                <div>
                  <Label
                    htmlFor="toggle-initial-case"
                    className="text-sm font-semibold text-foreground cursor-pointer flex items-center gap-2"
                  >
                    <Briefcase size={16} className="text-primary shrink-0" />
                    Create an initial case for this client (Optional)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Onboard this client directly with a full matter record, practice categories, counsel assignments, and initial tasks.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={createInitialCase ? "default" : "outline"}
                size="sm"
                className="rounded-md text-xs h-8 shrink-0"
                onClick={() => setCreateInitialCase(!createInitialCase)}
              >
                {createInitialCase ? "Enabled" : "+ Enable Case"}
              </Button>
            </div>

            {createInitialCase && (
              <div className="space-y-5 pt-3 border-t border-primary/20 animate-in fade-in-50">
                {/* ── 1. Main Category / Practice Area (First Option) ── */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="case-main-category" className="text-helper font-medium">
                        1. Select Main Category / Practice Area <span className="text-destructive">*</span>
                      </Label>
                      {isCategoriesLoading && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Loader2 size={11} className="animate-spin" /> Loading categories...
                        </span>
                      )}
                      {isCategoriesError && (
                        <span className="text-[11px] text-destructive">Failed to load categories</span>
                      )}
                    </div>
                    {normalizedTree.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {normalizedTree.map((c) => {
                          const isSelected = caseForm.mainCategory === c.name;
                          return (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => handleSelectMainCategory(c.name)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                                  : "border-border/80 bg-background text-foreground/80 hover:border-primary/50 hover:bg-muted/50"
                              }`}
                            >
                              {c.name}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => handleSelectMainCategory("__other__")}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all ${
                            caseForm.mainCategory === "__other__"
                              ? "border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40 font-bold"
                              : "border-dashed border-border/80 bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          + Custom
                        </button>
                      </div>
                    ) : (
                      <select
                        id="case-main-category"
                        value={caseForm.mainCategory}
                        disabled={isCategoriesLoading}
                        onChange={(e) => handleSelectMainCategory(e.target.value)}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs sm:text-sm outline-none transition-colors focus:border-primary disabled:opacity-50"
                      >
                        <option value="">
                          {isCategoriesLoading
                            ? "Loading categories…"
                            : isCategoriesError
                            ? "Error loading categories"
                            : "Select main category…"}
                        </option>
                        <option value="__other__">+ Custom Category...</option>
                      </select>
                    )}
                  </div>

                  {/* Primary Subcategory (Optional) */}
                  {caseForm.mainCategory && caseForm.mainCategory !== "__other__" && availableSubCategories.length > 0 && (
                    <div className="space-y-1.5">
                      <Label htmlFor="case-sub-category" className="text-helper">Primary Case Subcategory (Optional)</Label>
                      <select
                        id="case-sub-category"
                        value={caseForm.subCategory}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCase("subCategory", val);
                          updateCase("categoryPath", val ? [val] : []);
                          if (!isCaseTitleManuallyEdited) {
                            const clientName = form.name.trim();
                            if (clientName && val && val !== "__other__") {
                              updateCase("title", `${clientName} - ${val}`);
                            }
                          }
                        }}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs sm:text-sm outline-none transition-colors focus:border-primary"
                      >
                        <option value="">Select primary subcategory (or configure individual tasks below)…</option>
                        {availableSubCategories.map((sc) => (
                          <option key={sc._id || sc.name} value={sc.name}>
                            {sc.name}
                          </option>
                        ))}
                        <option value="__other__">+ Custom subcategory...</option>
                      </select>
                    </div>
                  )}

                  {/* Nested Subcategory (e.g. under SPECIAL LEGAL WORK) */}
                  {caseForm.subCategory && caseForm.subCategory !== "__other__" && availableNestedSubCategories.length > 0 && (
                    <div className="space-y-1.5 pt-1 animate-in fade-in-50">
                      <Label htmlFor="case-nested-sub-category" className="text-helper">
                        Specific Legal Work / Matter Detail ({caseForm.subCategory})
                      </Label>
                      <select
                        id="case-nested-sub-category"
                        value={caseForm.categoryPath?.[1] || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newPath = val ? [caseForm.subCategory, val] : [caseForm.subCategory];
                          updateCase("categoryPath", newPath);
                          if (!isCaseTitleManuallyEdited && val) {
                            const clientName = form.name.trim();
                            if (clientName) {
                              updateCase("title", `${clientName} - ${val}`);
                            }
                          }
                        }}
                        className="h-10 w-full rounded-md border border-border bg-card px-3 text-xs sm:text-sm outline-none transition-colors focus:border-primary"
                      >
                        <option value="">Select specific legal work detail…</option>
                        {availableNestedSubCategories.map((nsc) => (
                          <option key={nsc._id || nsc.name} value={nsc.name}>
                            {nsc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(caseForm.mainCategory === "__other__" || caseForm.subCategory === "__other__") && (
                    <div className="space-y-1.5">
                      <Label htmlFor="case-custom-category" className="text-helper">
                        Custom Category / Work Type <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="case-custom-category"
                        value={caseForm.customCategory}
                        onChange={(e) => {
                          const val = e.target.value;
                          updateCase("customCategory", val);
                          if (!isCaseTitleManuallyEdited) {
                            const clientName = form.name.trim();
                            if (clientName && val.trim()) {
                              updateCase("title", `${clientName} - ${val.trim()}`);
                            }
                          }
                        }}
                        placeholder="Enter manual category name (e.g. Real Estate Joint Venture)..."
                        className="h-10 rounded-md bg-card text-xs sm:text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* ── 2. Matter / Case Title (Auto-filled like Client Name - Main Category) ── */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="case-title" className="text-helper font-medium">
                      2. Case Title / Matter Subject <span className="text-destructive">*</span>
                    </Label>
                    {form.name.trim() && caseForm.mainCategory && (
                      <span className="text-[11px] text-muted-foreground">
                        Auto-filled from Client Name &amp; Category
                      </span>
                    )}
                  </div>
                  <Input
                    id="case-title"
                    value={caseForm.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.trim() === "") {
                        setIsCaseTitleManuallyEdited(false);
                      } else {
                        setIsCaseTitleManuallyEdited(true);
                      }
                      updateCase("title", val);
                    }}
                    placeholder={
                      form.name.trim()
                        ? `${form.name.trim()} - ${caseForm.mainCategory || "Main Category"}`
                        : "Client Name - Main Category"
                    }
                    className={`h-10 rounded-md bg-card text-xs sm:text-sm ${
                      fieldErrors.caseTitle ? "border-destructive focus-visible:ring-destructive" : ""
                    }`}
                    required={createInitialCase}
                  />
                  {fieldErrors.caseTitle && (
                    <p className="text-caption text-destructive font-medium">{fieldErrors.caseTitle}</p>
                  )}
                </div>

                {/* ── Case Number Identifiers ── */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="case-court-id" className="text-helper">
                      Court Case / CNR / Filing Number (Optional)
                    </Label>
                    <Input
                      id="case-court-id"
                      value={caseForm.courtCaseId}
                      onChange={(e) => updateCase("courtCaseId", e.target.value)}
                      placeholder="e.g. CNR: MHCC01-123456-2026 or Suit 45/2026"
                      className="h-10 rounded-md font-mono text-xs bg-card"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="case-count-number" className="text-helper">
                      Count Case Number / Internal Index (Optional)
                    </Label>
                    <Input
                      id="case-count-number"
                      value={caseForm.countCaseNumber}
                      onChange={(e) => updateCase("countCaseNumber", e.target.value)}
                      placeholder="e.g. Case Count #042 or CR-2026-99"
                      className="h-10 rounded-md font-mono text-xs bg-card"
                    />
                  </div>
                </div>

                {/* ── Hearing Date (Only visible for Heirship & Court Matters) & Local Folder Path ── */}
                <div className={`grid gap-3 ${isHeirshipCategory(caseForm.mainCategory) ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                  {isHeirshipCategory(caseForm.mainCategory) && (
                    <div className="space-y-1.5 animate-in fade-in-50">
                      <Label htmlFor="case-next-hearing" className="text-helper flex items-center gap-1.5 font-medium">
                        <Calendar size={14} className="text-primary" />
                        Initial / Next Hearing Date (DD/MM/YYYY) (Optional)
                      </Label>
                      <Input
                        id="case-next-hearing"
                        type="date"
                        value={caseForm.nextHearing}
                        onChange={(e) => updateCase("nextHearing", e.target.value)}
                        className="h-10 rounded-md bg-card text-xs sm:text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label htmlFor="case-localpath" className="text-helper flex items-center gap-1.5">
                      <FolderOpen size={14} className="text-muted-foreground" />
                      Local Folder Path (Desktop) (Optional)
                    </Label>
                    <Input
                      id="case-localpath"
                      value={caseForm.localPath}
                      onChange={(e) => updateCase("localPath", e.target.value)}
                      placeholder="e.g. C:\LegalFiles\Cases\Matter-2026"
                      className="h-10 rounded-md bg-card text-xs sm:text-sm"
                    />
                  </div>
                </div>

                {/* ── Description ── */}
                <div className="space-y-1.5">
                  <Label htmlFor="case-desc" className="text-helper">Case Description &amp; Details</Label>
                  <textarea
                    id="case-desc"
                    value={caseForm.description}
                    onChange={(e) => updateCase("description", e.target.value)}
                    placeholder="Brief summary of facts, dispute background, key dates, or instructions…"
                    rows={2}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs sm:text-sm outline-none transition-colors focus:border-primary resize-none"
                  />
                </div>

                {/* ── Status & Priority ── */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Case Status</Label>
                    <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
                      {(["Active", "Urgent", "On Hold", "Closed"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateCase("status", s)}
                          className={`flex-1 px-2 py-2 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${
                            caseForm.status === s
                              ? s === "Urgent"
                                ? "bg-destructive/15 text-destructive font-bold"
                                : s === "On Hold"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                                : s === "Closed"
                                ? "bg-muted text-muted-foreground font-bold"
                                : "bg-primary/15 text-primary font-bold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Priority</Label>
                    <div className="flex rounded-lg border border-border overflow-hidden bg-muted/30">
                      {(["High", "Medium", "Low"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => updateCase("priority", p)}
                          className={`flex-1 px-2.5 py-2 text-[11px] font-semibold transition-all border-r border-border last:border-r-0 ${
                            caseForm.priority === p
                              ? p === "High"
                                ? "bg-destructive/15 text-destructive font-bold"
                                : p === "Medium"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                                : "bg-muted text-foreground font-bold"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Responsible Staff / Counsel Assignment ── */}
                <div className="space-y-1.5">
                  <Label className="text-helper">Assigned To</Label>
                  <AssigneeMultiSelect
                    value={caseForm.assignedTo}
                    onChange={(val) => updateCase("assignedTo", val)}
                    placeholder="Assign advocates or staff to this case..."
                  />
                </div>

                {/* ── Case Tags / File No ── */}
                <div className="space-y-1.5">
                  <Label htmlFor="case-tags" className="text-helper">File No</Label>
                  <div className="flex gap-2">
                    <Input
                      id="case-tags"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Type File No and press Enter (e.g. FN-2026/01)"
                      className="h-9 flex-1 rounded-md bg-card text-xs"
                    />
                    <Button type="button" variant="outline" className="rounded-md h-9 px-3 text-xs" onClick={addTag}>
                      <Plus size={14} className="mr-1" /> Add File No
                    </Button>
                  </div>
                  {caseForm.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {caseForm.tags.map((t) => (
                        <span
                          key={t}
                          className="flex items-center gap-1 rounded-pill bg-muted px-2.5 py-0.5 text-caption font-medium text-foreground"
                        >
                          File No: {t}
                          <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="ml-0.5 grid size-3.5 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                            aria-label={`Remove file no ${t}`}
                          >
                            <X size={10} strokeWidth={2.5} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Additional Parties ── */}
                <div className="rounded-lg border border-border bg-card">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <p className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <Users size={15} strokeWidth={1.75} className="text-primary" />
                      Related Parties &amp; Opposing Counsel ({parties.length})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-md text-xs h-7 px-2"
                      onClick={addParty}
                    >
                      <Plus size={12} className="mr-1" /> Add Party
                    </Button>
                  </div>
                  {parties.length > 0 && (
                    <div className="border-t border-border p-3 space-y-2.5">
                      {parties.map((p, idx) => (
                        <div key={idx} className="grid gap-2 sm:grid-cols-3 rounded-md border border-border/70 p-2.5 bg-muted/20">
                          <Input
                            placeholder="Party name *"
                            value={p.name}
                            onChange={(e) => updateParty(idx, "name", e.target.value)}
                            className="h-8 text-xs rounded-md bg-card"
                          />
                          <Input
                            placeholder="Role (e.g. Respondent, Opposing Counsel)"
                            value={p.role}
                            onChange={(e) => updateParty(idx, "role", e.target.value)}
                            className="h-8 text-xs rounded-md bg-card"
                          />
                          <div className="flex gap-1.5">
                            <select
                              value={p.type}
                              onChange={(e) => updateParty(idx, "type", e.target.value as any)}
                              className="h-8 flex-1 rounded-md border border-border bg-card px-2 text-[11px] outline-none focus:border-primary"
                            >
                              <option value="opposing_party">Opposing Party</option>
                              <option value="counsel">Counsel</option>
                              <option value="sub_client">Sub-Client</option>
                              <option value="client">Client</option>
                              <option value="other">Other</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeParty(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive rounded"
                              aria-label="Remove party"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Initial Tasks Section ── */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  {/* Top Info Banner */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/40 p-3.5 flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-900 dark:text-blue-200 space-y-0.5">
                      <p className="font-semibold text-blue-950 dark:text-blue-100">
                        Create Independent Tasks from Subcategories
                      </p>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        Select subcategories to create separate tasks for this client. Each selected subcategory will be added as an independent task with its own assigned members, deadline, instructions, and checklist steps.
                      </p>
                    </div>
                  </div>

                  {/* Selected Main Category Badge */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Selected Main Category:</span>
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                        {caseForm.mainCategory || "None selected (choose in Case Details above)"}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs text-primary border-primary/30 h-8 px-3 hover:bg-primary/10 font-semibold rounded-lg"
                      onClick={addTask}
                    >
                      <Plus size={13} className="mr-1.5" /> Add Custom Task
                    </Button>
                  </div>

                  {/* Available Subcategories Selector */}
                  {caseForm.mainCategory && availableSubCategories.length > 0 && (
                    <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <CheckSquare size={14} className="text-primary" />
                            Available Subcategories
                          </Label>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Check subcategories below to create independent tasks
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allNames: string[] = [];
                              for (const s of availableSubCategories) {
                                allNames.push(s.name);
                                if (s.children && s.children.length > 0) {
                                  for (const c of s.children) {
                                    if (c.name) allNames.push(c.name);
                                  }
                                }
                              }
                              setCheckedSubCategoriesForTasks(allNames);
                            }}
                            className="text-[11px] text-primary hover:underline font-medium"
                          >
                            Select all
                          </button>
                          <span className="text-muted-foreground text-xs">|</span>
                          <button
                            type="button"
                            onClick={() => setCheckedSubCategoriesForTasks([])}
                            className="text-[11px] text-muted-foreground hover:underline"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {availableSubCategories
                            .filter((sc) => !sc.children || sc.children.length === 0)
                            .map((sc) => {
                              const isChecked = checkedSubCategoriesForTasks.includes(sc.name);
                              const isAlreadyCreated = initialTasks.some(
                                (t) => t.title.toLowerCase() === sc.name.toLowerCase()
                              );
                              return (
                                <label
                                  key={sc._id || sc.name}
                                  className={`flex items-start gap-2.5 rounded-lg border p-2 text-xs cursor-pointer transition-all ${
                                    isAlreadyCreated
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 opacity-80"
                                      : isChecked
                                      ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs"
                                      : "border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked || isAlreadyCreated}
                                    disabled={isAlreadyCreated}
                                    onChange={(e) => {
                                      if (isAlreadyCreated) return;
                                      const c = e.target.checked;
                                      setCheckedSubCategoriesForTasks((prev) =>
                                        c ? [...prev, sc.name] : prev.filter((name) => name !== sc.name)
                                      );
                                    }}
                                    className="mt-0.5 size-3.5 rounded border-border text-primary focus:ring-primary shrink-0"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <span className="leading-tight block truncate select-none">
                                      {sc.name}
                                    </span>
                                    {isAlreadyCreated && (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal block mt-0.5">
                                        ✓ Added as task
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                        </div>

                        {/* Subcategories with Nested Children (e.g. SPECIAL LEGAL WORK) */}
                        {availableSubCategories
                          .filter((sc) => sc.children && sc.children.length > 0)
                          .map((sc) => {
                            const isExpanded = expandedSubCategoryGroups[sc.name] ?? true;
                            const isChecked = checkedSubCategoriesForTasks.includes(sc.name);
                            const isAlreadyCreated = initialTasks.some(
                              (t) => t.title.toLowerCase() === sc.name.toLowerCase()
                            );
                            return (
                              <div
                                key={sc._id || sc.name}
                                className="rounded-lg border border-primary/20 bg-card p-2.5 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                                    <input
                                      type="checkbox"
                                      checked={isChecked || isAlreadyCreated}
                                      disabled={isAlreadyCreated}
                                      onChange={(e) => {
                                        if (isAlreadyCreated) return;
                                        const c = e.target.checked;
                                        setCheckedSubCategoriesForTasks((prev) =>
                                          c ? [...prev, sc.name] : prev.filter((name) => name !== sc.name)
                                        );
                                      }}
                                      className="size-3.5 rounded border-border text-primary focus:ring-primary"
                                    />
                                    <span>{sc.name}</span>
                                    {isAlreadyCreated && (
                                      <span className="text-[10px] text-emerald-600 font-normal">
                                        ✓ Added
                                      </span>
                                    )}
                                  </label>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedSubCategoryGroups((prev) => ({
                                        ...prev,
                                        [sc.name]: !isExpanded,
                                      }))
                                    }
                                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                                  >
                                    <span>
                                      {isExpanded ? "Hide" : "Show"} ({sc.children!.length} nested subcategories)
                                    </span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                </div>

                                {isExpanded && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 pt-1 border-t border-border/40">
                                    {sc.children!.map((nsc) => {
                                      const isChildChecked = checkedSubCategoriesForTasks.includes(nsc.name);
                                      const isChildCreated = initialTasks.some(
                                        (t) => t.title.toLowerCase() === nsc.name.toLowerCase()
                                      );
                                      return (
                                        <label
                                          key={nsc._id || nsc.name}
                                          className={`flex items-start gap-2 rounded-md border p-1.5 text-[11px] cursor-pointer transition-all ${
                                            isChildCreated
                                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 opacity-80"
                                              : isChildChecked
                                              ? "border-primary bg-primary/10 text-foreground font-semibold shadow-xs"
                                              : "border-border/60 bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                          }`}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChildChecked || isChildCreated}
                                            disabled={isChildCreated}
                                            onChange={(e) => {
                                              if (isChildCreated) return;
                                              const c = e.target.checked;
                                              setCheckedSubCategoriesForTasks((prev) =>
                                                c ? [...prev, nsc.name] : prev.filter((name) => name !== nsc.name)
                                              );
                                            }}
                                            className="mt-0.5 size-3 rounded border-border text-primary focus:ring-primary shrink-0"
                                          />
                                          <div className="min-w-0 flex-1">
                                            <span className="leading-tight block truncate select-none">
                                              {nsc.name}
                                            </span>
                                            {isChildCreated && (
                                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-normal block">
                                                ✓ Added
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      <div className="flex items-center justify-end pt-1">
                        <Button
                          type="button"
                          size="sm"
                          disabled={checkedSubCategoriesForTasks.length === 0}
                          onClick={handleAddSelectedSubCategoriesAsTasks}
                          className="h-8 text-xs font-semibold px-4 bg-primary text-primary-foreground rounded-lg shadow-xs hover:bg-primary/95"
                        >
                          <Plus size={13} className="mr-1.5" />
                          Add Selected as Tasks ({checkedSubCategoriesForTasks.length})
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Created Tasks List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        Created Tasks ({initialTasks.length})
                      </Label>
                      {initialTasks.length > 0 && (
                        <span className="text-[11px] text-muted-foreground">
                          Click any task card to expand and edit full details
                        </span>
                      )}
                    </div>

                    {initialTasks.length === 0 ? (
                      <div className="text-xs text-muted-foreground italic bg-muted/20 rounded-xl p-5 border border-dashed border-border text-center space-y-1">
                        <p className="font-medium text-foreground/80">No initial tasks created yet</p>
                        <p className="text-[11px]">
                          Select subcategories above or click &quot;+ Add Custom Task&quot; to assign tasks to your team.
                        </p>
                      </div>
                    ) : (
                      initialTasks.map((t, tIdx) => {
                        const isExpanded = expandedTaskIndexes[tIdx] ?? true;
                        return (
                          <div
                            key={tIdx}
                            className={`rounded-xl border bg-card shadow-xs transition-all border-l-4 ${
                              t.priority === "High"
                                ? "border-l-destructive border-border"
                                : t.priority === "Medium"
                                ? "border-l-amber-500 border-border"
                                : "border-l-emerald-500 border-border"
                            }`}
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between p-3.5 bg-muted/10 rounded-t-xl gap-2">
                              <div
                                onClick={() => toggleTaskExpand(tIdx)}
                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronUp size={16} className="text-muted-foreground shrink-0" />
                                ) : (
                                  <ChevronDown size={16} className="text-muted-foreground shrink-0" />
                                )}
                                <span className="font-semibold text-xs text-foreground truncate">
                                  {t.title || `Task #${tIdx + 1}`}
                                </span>
                                {t.subCategory && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium truncate hidden sm:inline-block">
                                    {t.subCategory}
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    t.priority === "High"
                                      ? "bg-destructive/15 text-destructive"
                                      : t.priority === "Medium"
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                  }`}
                                >
                                  {t.priority}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {t.checklist.length > 0 && (
                                  <span className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                                    {t.checklist.length} step{t.checklist.length !== 1 ? "s" : ""}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeTask(tIdx)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-destructive/10"
                                  title="Remove task"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Card Body (Expanded) */}
                            {isExpanded && (
                              <div className="p-4 space-y-4 border-t border-border/50">
                                {/* Task Title */}
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-semibold text-foreground">
                                    Task Title <span className="text-destructive">*</span>
                                  </Label>
                                  <Input
                                    value={t.title}
                                    onChange={(e) => updateTask(tIdx, "title", e.target.value)}
                                    placeholder="Task title (e.g. CIDCO FINAL NOC) *"
                                    className="h-9 text-xs rounded-lg font-medium bg-background"
                                    required
                                  />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-[11px] text-muted-foreground font-medium">Priority</Label>
                                    <select
                                      value={t.priority}
                                      onChange={(e) => updateTask(tIdx, "priority", e.target.value as any)}
                                      className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs font-medium"
                                    >
                                      <option value="High">High Priority</option>
                                      <option value="Medium">Medium Priority</option>
                                      <option value="Low">Low Priority</option>
                                    </select>
                                  </div>

                                  <div>
                                    <Label className="text-[11px] text-muted-foreground font-medium">Deadline (DD/MM/YYYY)</Label>
                                    <Input
                                      type="datetime-local"
                                      value={t.deadline}
                                      onChange={(e) => updateTask(tIdx, "deadline", e.target.value)}
                                      className="h-9 text-xs rounded-lg bg-background"
                                    />
                                  </div>
                                </div>

                                {/* Assignee Selector */}
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-semibold text-foreground">
                                    Assigned To
                                  </Label>
                                  <AssigneeMultiSelect
                                    value={t.assignedTo}
                                    onChange={(val) => updateTask(tIdx, "assignedTo", val)}
                                    placeholder="Select one or more members..."
                                  />
                                </div>

                                {/* Task Description */}
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-semibold text-foreground">
                                    Task Description &amp; Instructions
                                  </Label>
                                  <Input
                                    value={t.description || ""}
                                    onChange={(e) => updateTask(tIdx, "description", e.target.value)}
                                    placeholder="Provide detailed instructions for this task..."
                                    className="h-9 text-xs rounded-lg bg-background"
                                  />
                                </div>

                                {/* Internal Notes */}
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-semibold text-foreground">
                                    Additional Internal Notes
                                  </Label>
                                  <Input
                                    value={t.notes || ""}
                                    onChange={(e) => updateTask(tIdx, "notes", e.target.value)}
                                    placeholder="Notes visible only to internal team members..."
                                    className="h-9 text-xs rounded-lg bg-background"
                                  />
                                </div>

                                {/* Subtasks / Checklist Items */}
                                <div className="space-y-2.5 pt-2 border-t border-border/50">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                      <CheckSquare size={13} className="text-primary" />
                                      Sub-tasks &amp; Checklist Steps ({t.checklist.length})
                                    </Label>
                                  </div>

                                  <div className="flex gap-2">
                                    <Input
                                      value={subtaskInput[tIdx] || ""}
                                      onChange={(e) => setSubtaskInput((prev) => ({ ...prev, [tIdx]: e.target.value }))}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          addChecklistItemToTask(tIdx);
                                        }
                                      }}
                                      placeholder="Add custom checklist step and press Enter..."
                                      className="h-8 text-xs rounded-lg bg-background"
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-3 text-xs rounded-lg font-medium"
                                      onClick={() => addChecklistItemToTask(tIdx)}
                                    >
                                      <Plus size={12} className="mr-1" /> Add Step
                                    </Button>
                                  </div>

                                  {t.checklist.length > 0 && (
                                    <div className="space-y-1.5 mt-2">
                                      {t.checklist.map((item, cIdx) => (
                                        <div
                                          key={item.id || cIdx}
                                          className="space-y-1.5 rounded-lg border border-border/70 bg-muted/10 p-2.5 text-xs"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Input
                                              value={item.text}
                                              onChange={(e) => updateChecklistItemText(tIdx, cIdx, e.target.value)}
                                              placeholder="Step description..."
                                              className="h-7 flex-1 text-xs font-medium rounded-md bg-background"
                                            />
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => addSubItemToTaskChecklist(tIdx, cIdx)}
                                              className="h-7 text-xs text-primary hover:bg-primary/10 px-2"
                                            >
                                              <Plus size={11} className="mr-1" /> Sub-item
                                            </Button>
                                            <button
                                              type="button"
                                              onClick={() => removeChecklistItemFromTask(tIdx, cIdx)}
                                              className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                              aria-label="Remove checklist item"
                                            >
                                              <Trash2 size={13} />
                                            </button>
                                          </div>

                                          {/* Nested sub-items */}
                                          {Array.isArray(item.subItems) && item.subItems.length > 0 && (
                                            <div className="pl-3 space-y-1 border-l-2 border-primary/20 ml-2 mt-1">
                                              {item.subItems.map((sub, sIdx) => (
                                                <div key={sub.id || sIdx} className="flex items-center gap-1.5">
                                                  <CornerDownRight size={11} className="text-muted-foreground shrink-0" />
                                                  <Input
                                                    value={sub.text}
                                                    onChange={(e) => updateSubItemText(tIdx, cIdx, sIdx, e.target.value)}
                                                    placeholder="Sub-step detail…"
                                                    className="h-6 text-[11px] rounded-md bg-background"
                                                  />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeSubItemFromTaskChecklist(tIdx, cIdx, sIdx)}
                                                    className="grid size-5 shrink-0 place-items-center text-muted-foreground hover:text-destructive"
                                                    aria-label="Remove sub-item"
                                                  >
                                                    <Trash2 size={11} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !form.name.trim()}
              className="gradient-primary rounded-md text-primary-foreground shadow-soft"
            >
              {isPending ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} strokeWidth={2} />}
              {isPending ? "Saving…" : "Save client"}
            </Button>
          </DialogFooter>

          {isError && (
            <p className="text-caption text-destructive">Failed to create client. Please try again.</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}