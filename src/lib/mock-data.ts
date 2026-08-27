export type Priority = "High" | "Medium" | "Low";
export type CaseStatus = "Active" | "On Hold" | "Closed" | "Urgent";

export interface CaseRecord {
  id: string;
  number: string;
  title: string;
  client: string;
  practice: string;
  court: string;
  status: CaseStatus;
  priority: Priority;
  assigned: string;
  nextHearing: string;
  progress: number;
}

export interface ClientRecord {
  id: string;
  name: string;
  type: "Individual" | "Corporate";
  tag: "Active" | "VIP" | "Corporate" | "Individual";
  email: string;
  phone: string;
  cases: number;
  kyc: "Verified" | "Pending";
  since: string;
}

export interface TaskRecord {
  id: string;
  title: string;
  caseName: string;
  assignee: string;
  due: string;
  bucket: "Overdue" | "Due Today" | "Upcoming" | "Completed";
  priority: Priority;
  checklist: { done: number; total: number };
}

export interface EmployeeRecord {
  id: string;
  name: string;
  role: string;
  status: "Available" | "In Court" | "On Leave" | "Busy";
  workload: number;
  hearings: number;
  tasks: number;
  email: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  kind: "PDF" | "DOCX" | "XLSX" | "JPG" | "ZIP";
  caseName: string;
  size: string;
  uploadedBy: string;
  updated: string;
  state: "Approved" | "Pending" | "Rejected";
}

export const cases: CaseRecord[] = [
  {
    id: "c1",
    number: "SW-2026-0148",
    title: "Mehra vs. Kapoor Estates",
    client: "Anaya Mehra",
    practice: "Property",
    court: "Bombay High Court",
    status: "Urgent",
    priority: "High",
    assigned: "Adv. Rohan Desai",
    nextHearing: "Tomorrow, 10:30 AM",
    progress: 72,
  },
  {
    id: "c2",
    number: "SW-2026-0139",
    title: "Sterling Textiles — Contract Dispute",
    client: "Sterling Textiles Pvt Ltd",
    practice: "Corporate",
    court: "NCLT Mumbai",
    status: "Active",
    priority: "High",
    assigned: "Adv. Meera Iyer",
    nextHearing: "12 Aug, 11:00 AM",
    progress: 54,
  },
  {
    id: "c3",
    number: "SW-2026-0121",
    title: "Rao Family Settlement",
    client: "Vikram Rao",
    practice: "Family",
    court: "City Civil Court",
    status: "Active",
    priority: "Medium",
    assigned: "Adv. Kabir Shah",
    nextHearing: "18 Aug, 02:15 PM",
    progress: 38,
  },
  {
    id: "c4",
    number: "SW-2026-0102",
    title: "Nandi Infra — Land Acquisition",
    client: "Nandi Infra Ltd",
    practice: "Property",
    court: "District Court, Pune",
    status: "On Hold",
    priority: "Low",
    assigned: "Adv. Rohan Desai",
    nextHearing: "Not scheduled",
    progress: 21,
  },
  {
    id: "c5",
    number: "SW-2025-0987",
    title: "Sharma vs. State",
    client: "Devansh Sharma",
    practice: "Criminal",
    court: "Sessions Court",
    status: "Closed",
    priority: "Medium",
    assigned: "Adv. Meera Iyer",
    nextHearing: "Concluded",
    progress: 100,
  },
];

export const clients: ClientRecord[] = [
  {
    id: "cl1",
    name: "Anaya Mehra",
    type: "Individual",
    tag: "VIP",
    email: "anaya.mehra@gmail.com",
    phone: "+91 98200 41122",
    cases: 3,
    kyc: "Verified",
    since: "Mar 2023",
  },
  {
    id: "cl2",
    name: "Sterling Textiles Pvt Ltd",
    type: "Corporate",
    tag: "Corporate",
    email: "legal@sterlingtex.in",
    phone: "+91 22 4455 1200",
    cases: 6,
    kyc: "Verified",
    since: "Jan 2021",
  },
  {
    id: "cl3",
    name: "Vikram Rao",
    type: "Individual",
    tag: "Active",
    email: "vikram.rao@outlook.com",
    phone: "+91 99870 22331",
    cases: 1,
    kyc: "Pending",
    since: "Nov 2025",
  },
  {
    id: "cl4",
    name: "Nandi Infra Ltd",
    type: "Corporate",
    tag: "Corporate",
    email: "compliance@nandiinfra.com",
    phone: "+91 20 6677 8899",
    cases: 4,
    kyc: "Verified",
    since: "Jul 2022",
  },
  {
    id: "cl5",
    name: "Devansh Sharma",
    type: "Individual",
    tag: "Individual",
    email: "d.sharma@proton.me",
    phone: "+91 90040 55667",
    cases: 1,
    kyc: "Verified",
    since: "Feb 2024",
  },
];

export const tasks: TaskRecord[] = [
  {
    id: "t1",
    title: "File written statement",
    caseName: "Mehra vs. Kapoor Estates",
    assignee: "Adv. Rohan Desai",
    due: "Yesterday, 6:00 PM",
    bucket: "Overdue",
    priority: "High",
    checklist: { done: 2, total: 5 },
  },
  {
    id: "t2",
    title: "Collect notarised affidavit",
    caseName: "Rao Family Settlement",
    assignee: "Priya Nair",
    due: "Today, 4:00 PM",
    bucket: "Due Today",
    priority: "High",
    checklist: { done: 1, total: 3 },
  },
  {
    id: "t3",
    title: "Call client on hearing outcome",
    caseName: "Sterling Textiles",
    assignee: "Adv. Meera Iyer",
    due: "Today, 6:30 PM",
    bucket: "Due Today",
    priority: "Medium",
    checklist: { done: 0, total: 2 },
  },
  {
    id: "t4",
    title: "Prepare land title summary",
    caseName: "Nandi Infra — Land Acquisition",
    assignee: "Kabir Shah",
    due: "14 Aug",
    bucket: "Upcoming",
    priority: "Medium",
    checklist: { done: 3, total: 8 },
  },
  {
    id: "t5",
    title: "Draft settlement terms",
    caseName: "Rao Family Settlement",
    assignee: "Adv. Kabir Shah",
    due: "16 Aug",
    bucket: "Upcoming",
    priority: "Low",
    checklist: { done: 0, total: 4 },
  },
  {
    id: "t6",
    title: "Submit court fee receipt",
    caseName: "Sharma vs. State",
    assignee: "Priya Nair",
    due: "1 Aug",
    bucket: "Completed",
    priority: "Low",
    checklist: { done: 3, total: 3 },
  },
];

export const employees: EmployeeRecord[] = [
  {
    id: "e1",
    name: "Adv. Rohan Desai",
    role: "Senior Advocate",
    status: "In Court",
    workload: 82,
    hearings: 2,
    tasks: 7,
    email: "rohan@stillworks.legal",
  },
  {
    id: "e2",
    name: "Adv. Meera Iyer",
    role: "Senior Advocate",
    status: "Available",
    workload: 64,
    hearings: 1,
    tasks: 5,
    email: "meera@stillworks.legal",
  },
  {
    id: "e3",
    name: "Adv. Kabir Shah",
    role: "Junior Advocate",
    status: "Busy",
    workload: 48,
    hearings: 1,
    tasks: 9,
    email: "kabir@stillworks.legal",
  },
  {
    id: "e4",
    name: "Priya Nair",
    role: "Legal Assistant",
    status: "Available",
    workload: 35,
    hearings: 0,
    tasks: 6,
    email: "priya@stillworks.legal",
  },
  {
    id: "e5",
    name: "Imran Qureshi",
    role: "Office Staff",
    status: "On Leave",
    workload: 12,
    hearings: 0,
    tasks: 1,
    email: "imran@stillworks.legal",
  },
];

export const documents: DocumentRecord[] = [
  {
    id: "d1",
    name: "Sale Deed — Kapoor Estates.pdf",
    kind: "PDF",
    caseName: "Mehra vs. Kapoor Estates",
    size: "3.2 MB",
    uploadedBy: "Priya Nair",
    updated: "2 hours ago",
    state: "Pending",
  },
  {
    id: "d2",
    name: "Supply Agreement 2024.docx",
    kind: "DOCX",
    caseName: "Sterling Textiles",
    size: "820 KB",
    uploadedBy: "Adv. Meera Iyer",
    updated: "Yesterday",
    state: "Approved",
  },
  {
    id: "d3",
    name: "Property Valuation.xlsx",
    kind: "XLSX",
    caseName: "Nandi Infra",
    size: "1.1 MB",
    uploadedBy: "Kabir Shah",
    updated: "2 days ago",
    state: "Approved",
  },
  {
    id: "d4",
    name: "Site Photographs.zip",
    kind: "ZIP",
    caseName: "Nandi Infra",
    size: "18.4 MB",
    uploadedBy: "Imran Qureshi",
    updated: "3 days ago",
    state: "Pending",
  },
  {
    id: "d5",
    name: "Affidavit Scan.jpg",
    kind: "JPG",
    caseName: "Rao Family Settlement",
    size: "640 KB",
    uploadedBy: "Priya Nair",
    updated: "4 days ago",
    state: "Rejected",
  },
];

export const hearings = [
  {
    id: "h1",
    time: "10:30 AM",
    title: "Mehra vs. Kapoor Estates",
    court: "Bombay High Court, Court 14",
    advocate: "Adv. Rohan Desai",
    tone: "primary" as const,
  },
  {
    id: "h2",
    time: "12:00 PM",
    title: "Sterling Textiles — Interim Plea",
    court: "NCLT Mumbai, Bench II",
    advocate: "Adv. Meera Iyer",
    tone: "indigo" as const,
  },
  {
    id: "h3",
    time: "03:45 PM",
    title: "Rao Family Settlement",
    court: "City Civil Court, Room 6",
    advocate: "Adv. Kabir Shah",
    tone: "violet" as const,
  },
];

export const approvals = [
  {
    id: "a1",
    kind: "Document Upload",
    title: "Sale Deed — Kapoor Estates.pdf",
    context: "Mehra vs. Kapoor Estates",
    by: "Priya Nair",
    when: "2 hours ago",
  },
  {
    id: "a2",
    kind: "Access Request",
    title: "Access to Sterling Textiles folder",
    context: "Sterling Textiles — Contract Dispute",
    by: "Kabir Shah",
    when: "4 hours ago",
  },
  {
    id: "a3",
    kind: "Client Request",
    title: "New client — Harsh Malhotra",
    context: "Onboarding, Property",
    by: "Adv. Meera Iyer",
    when: "Yesterday",
  },
  {
    id: "a4",
    kind: "Case Request",
    title: "Open case for Nandi Infra Phase II",
    context: "Property acquisition",
    by: "Adv. Rohan Desai",
    when: "Yesterday",
  },
];

export const activity = [
  { id: "ac1", who: "Adv. Meera Iyer", what: "approved 2 documents", when: "8 min ago" },
  { id: "ac2", who: "Priya Nair", what: "uploaded Sale Deed to SW-2026-0148", when: "2 h ago" },
  { id: "ac3", who: "Kabir Shah", what: "completed 3 tasks", when: "3 h ago" },
  { id: "ac4", who: "Adv. Rohan Desai", what: "rescheduled a hearing", when: "5 h ago" },
  { id: "ac5", who: "Imran Qureshi", what: "added a call reminder", when: "Yesterday" },
];

export const auditLogs = [
  {
    id: "l1",
    user: "Adv. Rohan Desai",
    action: "Approved document",
    detail: "Supply Agreement 2024.docx",
    device: "MacBook Pro · Safari",
    when: "Today, 14:02",
  },
  {
    id: "l2",
    user: "Priya Nair",
    action: "Uploaded document",
    detail: "Sale Deed — Kapoor Estates.pdf",
    device: "Windows · Chrome",
    when: "Today, 12:41",
  },
  {
    id: "l3",
    user: "Adv. Meera Iyer",
    action: "Updated case status",
    detail: "SW-2026-0139 → Active",
    device: "iPad · Safari",
    when: "Today, 10:12",
  },
  {
    id: "l4",
    user: "Kabir Shah",
    action: "Requested access",
    detail: "Sterling Textiles folder",
    device: "Windows · Edge",
    when: "Yesterday, 18:30",
  },
  {
    id: "l5",
    user: "System",
    action: "Nightly backup",
    detail: "Completed · 4.2 GB",
    device: "NAS · Automated",
    when: "Yesterday, 02:00",
  },
];

export const conversations = [
  {
    id: "m1",
    name: "Adv. Meera Iyer",
    preview: "Sending the interim plea draft now.",
    when: "2m",
    unread: 2,
    online: true,
  },
  {
    id: "m2",
    name: "Kapoor Matter — Team",
    preview: "Priya: Deed uploaded for approval",
    when: "1h",
    unread: 0,
    online: false,
  },
  {
    id: "m3",
    name: "Priya Nair",
    preview: "Affidavit is notarised ✓",
    when: "3h",
    unread: 0,
    online: true,
  },
  {
    id: "m4",
    name: "Adv. Kabir Shah",
    preview: "Court fee receipt attached",
    when: "Yesterday",
    unread: 0,
    online: false,
  },
];

export const messages = [
  { id: "x1", from: "them", text: "Good morning — did the deed come through?", at: "09:12" },
  { id: "x2", from: "me", text: "Yes, Priya uploaded it. Pending your approval.", at: "09:14" },
  { id: "x3", from: "them", text: "Reviewing now. Hearing is at 10:30 tomorrow.", at: "09:15" },
  { id: "x4", from: "me", text: "Noted. I'll prepare the brief tonight.", at: "09:18" },
] as const;

export const practiceMix = [
  { name: "Property", value: 34 },
  { name: "Corporate", value: 26 },
  { name: "Family", value: 18 },
  { name: "Criminal", value: 12 },
  { name: "Taxation", value: 10 },
];

export const caseGrowth = [
  { month: "Feb", cases: 12, closed: 6 },
  { month: "Mar", cases: 18, closed: 9 },
  { month: "Apr", cases: 15, closed: 11 },
  { month: "May", cases: 22, closed: 13 },
  { month: "Jun", cases: 27, closed: 16 },
  { month: "Jul", cases: 31, closed: 19 },
  { month: "Aug", cases: 36, closed: 22 },
];
