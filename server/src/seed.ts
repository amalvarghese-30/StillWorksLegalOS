/**
 * StillWorks LegalOS — Database Seed Script
 *
 * Populates MongoDB with realistic sample data for development and demos.
 * Run:  npx tsx src/seed.ts
 *
 * Passwords: all test users use "password123"
 */

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { User } from "./models/User.js";
import { Client } from "./models/Client.js";
import { Case } from "./models/Case.js";
import { Task } from "./models/Task.js";
import { DocumentModel } from "./models/Document.js";
import { CalendarEvent } from "./models/CalendarEvent.js";
import { ChatGroup, ChatMessage } from "./models/Chat.js";
import { AuditLog } from "./models/AuditLog.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

dotenv.config({ path: new URL("../.env", import.meta.url) });

const MONGO_URI = process.env["MONGODB_URI"] ?? "mongodb://localhost:27017/stillworks";
const PASSWORD = "password123";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

function minsAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 1000);
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log("[seed] Connecting to MongoDB...");
  await connectDB(MONGO_URI);

  console.log("[seed] Dropping existing collections...");
  const collections = await mongoose.connection.db!.listCollections().toArray();
  for (const col of collections) {
    if (col.name !== "system.indexes") {
      await mongoose.connection.db!.dropCollection(col.name);
    }
  }

  // -------------------------------------------------------------------------
  // 1. Users
  // -------------------------------------------------------------------------

  console.log("[seed] Creating users...");
  const hash = await bcrypt.hash(PASSWORD, 10);

  const [admin, meera, kabir, priya, imran, kiran, rashmi, komal, omkar, anurag, pooja] = await User.create([
    {
      name: "Adv. Rohan Desai",
      email: "rohan@stillworks.legal",
      passwordHash: hash,
      role: "admin",
      title: "Senior Advocate · Managing Partner",
      status: "online",
      phone: "+91 98200 41123",
      permissions: {
        dashboard: true, clients: true, cases: true, tasks: true,
        documents: true, calendar: true, chat: true, reports: true,
        employees: true, approvals: true, auditLogs: true, settings: true,
      },
    },
    {
      name: "Adv. Meera Iyer",
      email: "meera@stillworks.legal",
      passwordHash: hash,
      role: "senior_advocate",
      title: "Senior Advocate — Corporate & NCLT",
      status: "online",
      phone: "+91 99870 22332",
    },
    {
      name: "Adv. Kabir Shah",
      email: "kabir@stillworks.legal",
      passwordHash: hash,
      role: "junior_advocate",
      title: "Junior Advocate",
      status: "online",
      phone: "+91 90040 55668",
    },
    {
      name: "Priya Nair",
      email: "priya@stillworks.legal",
      passwordHash: hash,
      role: "legal_assistant",
      title: "Legal Assistant",
      status: "online",
      phone: "+91 97680 33445",
    },
    {
      name: "Imran Qureshi",
      email: "imran@stillworks.legal",
      passwordHash: hash,
      role: "office_staff",
      title: "Office Administrator",
      status: "offline",
      phone: "+91 88990 77889",
    },
    {
      name: "Adv. Kiran",
      email: "kiran@stillworks.legal",
      passwordHash: hash,
      role: "senior_advocate",
      title: "Senior Advocate",
      status: "online",
      phone: "+91 98200 41124",
    },
    {
      name: "Rashmi",
      email: "rashmi@stillworks.legal",
      passwordHash: hash,
      role: "junior_advocate",
      title: "Junior Advocate",
      status: "online",
      phone: "+91 98200 41125",
    },
    {
      name: "Komal",
      email: "komal@stillworks.legal",
      passwordHash: hash,
      role: "junior_advocate",
      title: "Junior Advocate",
      status: "online",
      phone: "+91 98200 41126",
    },
    {
      name: "Omkar",
      email: "omkar@stillworks.legal",
      passwordHash: hash,
      role: "legal_assistant",
      title: "Legal Assistant",
      status: "online",
      phone: "+91 98200 41127",
    },
    {
      name: "Anurag",
      email: "anurag@stillworks.legal",
      passwordHash: hash,
      role: "legal_assistant",
      title: "Legal Assistant",
      status: "offline",
      phone: "+91 98200 41128",
    },
    {
      name: "Pooja",
      email: "pooja@stillworks.legal",
      passwordHash: hash,
      role: "office_staff",
      title: "Office Staff",
      status: "online",
      phone: "+91 98200 41129",
    },
  ]);

  const rohan = admin;
  const allUsers = [admin, meera, kabir, priya, imran, kiran, rashmi, komal, omkar, anurag, pooja];
  console.log(`[seed] Created ${allUsers.length} users`);

  // -------------------------------------------------------------------------
  // 2. Clients
  // -------------------------------------------------------------------------

  console.log("[seed] Creating clients...");

  const [clientMehra, clientSterling, clientRao, clientNandi, clientSharma] = await Client.create([
    {
      type: "Individual",
      tag: "VIP",
      name: "Anaya Mehra",
      phone: "+91 98200 41122",
      email: "anaya.mehra@gmail.com",
      address: "402, Sea Crest, Carter Road, Bandra West, Mumbai — 400050",
      aadhar: "9876 5432 1098",
      pan: "ABCDM1234M",
      kyc: "Verified",
      propertyDetails: {
        address: "Plot 42, Sector 15, Kharghar, Navi Mumbai — 410210",
        surveyNo: "KH-42/2023",
        chsName: "Kapoor Estates CHS",
        sector: "15",
        plot: "42",
        area: "1,200 sq. ft.",
      },
      subClients: [
        { name: "Rajesh Mehra", relationship: "Husband — Co-owner", phone: "+91 98190 33441" },
        { name: "Sunita Kapoor", relationship: "Seller", phone: "+91 99201 55662", aadhar: "1234 5678 9012", pan: "XYZPK5678P" },
      ],
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      type: "Corporate",
      tag: "Corporate",
      name: "Sterling Textiles Pvt Ltd",
      phone: "+91 22 4455 1200",
      email: "legal@sterlingtex.in",
      address: "Sterling House, 3rd Floor, Senapati Bapat Marg, Lower Parel, Mumbai — 400013",
      aadhar: "",
      pan: "AACCS1234T",
      kyc: "Verified",
      subClients: [
        { name: "Vikram Sterling", relationship: "Managing Director", phone: "+91 98210 11223", email: "vikram@sterlingtex.in" },
      ],
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      type: "Individual",
      tag: "Active",
      name: "Vikram Rao",
      phone: "+91 99870 22331",
      email: "vikram.rao@outlook.com",
      address: "12/A, Anand Nagar, Juhu, Mumbai — 400049",
      aadhar: "4567 8901 2345",
      pan: "BBVPR6789R",
      kyc: "Pending",
      subClients: [
        { name: "Meena Rao", relationship: "Wife", phone: "+91 99870 22332" },
        { name: "Arjun Rao", relationship: "Son", phone: "+91 99870 22333" },
      ],
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      type: "Corporate",
      tag: "Corporate",
      name: "Nandi Infra Ltd",
      phone: "+91 20 6677 8899",
      email: "compliance@nandiinfra.com",
      address: "Nandi Towers, Wakad, Pune — 411057",
      aadhar: "",
      pan: "AABCN5678I",
      kyc: "Verified",
      propertyDetails: {
        address: "Survey 88, Mauje Wakad, Taluka Mulshi, Pune — 411057",
        surveyNo: "88/1B",
        chsName: "",
        sector: "",
        plot: "88/1B",
        area: "5 acres",
      },
      subClients: [],
      createdBy: admin._id,
      updatedBy: admin._id,
    },
    {
      type: "Individual",
      tag: "Individual",
      name: "Devansh Sharma",
      phone: "+91 90040 55667",
      email: "d.sharma@proton.me",
      address: "7, Gokuldham Society, Goregaon East, Mumbai — 400063",
      aadhar: "7890 1234 5678",
      pan: "CCSPD9012S",
      kyc: "Verified",
      createdBy: admin._id,
      updatedBy: admin._id,
    },
  ]);

  const allClients = [clientMehra, clientSterling, clientRao, clientNandi, clientSharma];
  console.log(`[seed] Created ${allClients.length} clients`);

  // -------------------------------------------------------------------------
  // 3. Cases
  // -------------------------------------------------------------------------

  console.log("[seed] Creating cases...");

  const [caseMehra, caseSterling, caseRao, caseNandi, caseSharma] = await Case.create([
    {
      number: "SW-2026-0148",
      title: "Mehra vs. Kapoor Estates",
      description: "Title dispute over a residential flat in Kharghar. Plaintiff seeks declaration of ownership and permanent injunction against the developer.",
      practice: "Property",
      court: "Bombay High Court",
      judge: "Hon. Justice R. M. Sawant",
      status: "Urgent",
      priority: "High",
      nextHearing: daysFromNow(1),
      parties: [
        { clientId: clientMehra._id, name: "Anaya Mehra", role: "Plaintiff", type: "client" },
        { clientId: clientMehra._id, name: "Rajesh Mehra", role: "Co-Plaintiff", type: "sub_client" },
        { clientId: clientMehra._id, name: "Sunita Kapoor", role: "Defendant (Seller)", type: "sub_client" },
        { name: "Kapoor Estates Pvt Ltd", role: "Defendant (Developer)", type: "opposing_party" },
        { name: "Adv. N. K. Joshi", role: "Opposing Counsel", type: "counsel" },
      ],
      assignedTo: rohan._id,
      createdBy: admin._id,
      nasPath: "/Cases/SW-2026-0148",
      progress: 72,
      tags: ["urgent", "property", "title-dispute"],
      timeline: [
        { event: "Case filed", by: "Adv. Rohan Desai", when: daysAgo(90) },
        { event: "Notice served to defendants", by: "Priya Nair", when: daysAgo(75) },
        { event: "Written statement filed by defendants", by: "Adv. Rohan Desai", when: daysAgo(45) },
        { event: "First hearing held", by: "Adv. Rohan Desai", when: daysAgo(20) },
        { event: "Interim injunction application filed", by: "Adv. Rohan Desai", when: daysAgo(5) },
      ],
    },
    {
      number: "SW-2026-0139",
      title: "Sterling Textiles — Contract Dispute",
      description: "Breach of supply agreement between Sterling Textiles and a fabric wholesaler. Claim value: ₹1.2 Cr.",
      practice: "Corporate",
      court: "NCLT Mumbai",
      judge: "Hon. Member (Judicial) A. K. Sharma",
      status: "Active",
      priority: "High",
      nextHearing: daysFromNow(3),
      parties: [
        { clientId: clientSterling._id, name: "Sterling Textiles Pvt Ltd", role: "Petitioner", type: "client" },
        { clientId: clientSterling._id, name: "Vikram Sterling", role: "Representative", type: "sub_client" },
        { name: "M/s Fine Textiles", role: "Respondent", type: "opposing_party" },
      ],
      assignedTo: meera._id,
      createdBy: admin._id,
      nasPath: "/Cases/SW-2026-0139",
      progress: 54,
      tags: ["corporate", "contract", "nclt"],
      timeline: [
        { event: "Petition filed under Section 7 IBC", by: "Adv. Meera Iyer", when: daysAgo(60) },
        { event: "Counter-affidavit received", by: "Adv. Meera Iyer", when: daysAgo(30) },
      ],
    },
    {
      number: "SW-2026-0121",
      title: "Rao Family Settlement",
      description: "Partition suit among legal heirs for ancestral property in Juhu. Three siblings seeking equitable division.",
      practice: "Family",
      court: "City Civil Court",
      judge: "Hon. Judge Smt. L. Patil",
      status: "Active",
      priority: "Medium",
      nextHearing: daysFromNow(8),
      parties: [
        { clientId: clientRao._id, name: "Vikram Rao", role: "Plaintiff No. 1", type: "client" },
        { clientId: clientRao._id, name: "Meena Rao", role: "Plaintiff No. 2", type: "sub_client" },
        { clientId: clientRao._id, name: "Arjun Rao", role: "Plaintiff No. 3", type: "sub_client" },
        { name: "Deepak Rao", role: "Defendant (Brother)", type: "opposing_party" },
      ],
      assignedTo: kabir._id,
      createdBy: admin._id,
      nasPath: "/Cases/SW-2026-0121",
      progress: 38,
      tags: ["family", "partition"],
      timeline: [
        { event: "Plaint filed", by: "Adv. Kabir Shah", when: daysAgo(50) },
        { event: "Summons issued", by: "Priya Nair", when: daysAgo(45) },
      ],
    },
    {
      number: "SW-2026-0102",
      title: "Nandi Infra — Land Acquisition",
      description: "Compensation dispute under the Right to Fair Compensation Act for 5 acres in Wakad, Pune.",
      practice: "Property",
      court: "District Court, Pune",
      judge: "Hon. District Judge S. K. Deshmukh",
      status: "On Hold",
      priority: "Low",
      nextHearing: null,
      parties: [
        { clientId: clientNandi._id, name: "Nandi Infra Ltd", role: "Claimant", type: "client" },
        { name: "State of Maharashtra (Land Acquisition Officer)", role: "Respondent", type: "opposing_party" },
      ],
      assignedTo: rohan._id,
      createdBy: admin._id,
      nasPath: "/Cases/SW-2026-0102",
      progress: 21,
      tags: ["property", "land-acquisition"],
      timeline: [
        { event: "Reference petition filed", by: "Adv. Rohan Desai", when: daysAgo(120) },
        { event: "Notice to respondents", by: "Priya Nair", when: daysAgo(110) },
        { event: "Matter stayed — pending SC decision", by: "Adv. Rohan Desai", when: daysAgo(60) },
      ],
    },
    {
      number: "SW-2025-0987",
      title: "Sharma vs. State",
      description: "Criminal revision against an order of the Sessions Court in a 498A matter.",
      practice: "Criminal",
      court: "Sessions Court",
      judge: "Hon. Sessions Judge R. P. Kadam",
      status: "Closed",
      priority: "Medium",
      nextHearing: null,
      parties: [
        { clientId: clientSharma._id, name: "Devansh Sharma", role: "Revision Petitioner", type: "client" },
        { name: "State of Maharashtra", role: "Respondent", type: "opposing_party" },
      ],
      assignedTo: meera._id,
      createdBy: admin._id,
      nasPath: "/Cases/SW-2025-0987",
      progress: 100,
      tags: ["criminal", "closed"],
      timeline: [
        { event: "Revision petition filed", by: "Adv. Meera Iyer", when: daysAgo(200) },
        { event: "Arguments concluded", by: "Adv. Meera Iyer", when: daysAgo(90) },
        { event: "Judgment delivered — Acquitted", by: "Adv. Meera Iyer", when: daysAgo(30) },
      ],
    },
  ]);

  const allCases = [caseMehra, caseSterling, caseRao, caseNandi, caseSharma];
  console.log(`[seed] Created ${allCases.length} cases`);

  // -------------------------------------------------------------------------
  // 4. Tasks
  // -------------------------------------------------------------------------

  console.log("[seed] Creating tasks...");

  await Task.create([
    {
      title: "File written statement — Mehra vs. Kapoor",
      description: "Draft and file the reply to the developer's counter-claim. Attach all property documents as exhibits.",
      category: "filing",
      priority: "High",
      status: "overdue",
      deadline: daysAgo(1),
      assignedTo: rohan._id,
      caseId: caseMehra._id,
      clientId: clientMehra._id,
      checklist: [
        { text: "Review developer's counter-claim", done: true },
        { text: "Draft written statement", done: true },
        { text: "Attach exhibit list", done: false },
        { text: "Get client signature on verification", done: false },
        { text: "File at Bombay HC registry", done: false },
      ],
      callReminder: {
        clientName: "Anaya Mehra",
        phone: "+91 98200 41122",
        scheduledAt: daysFromNow(0.5),
        notes: "Confirm hearing date and collect original sale deed",
        completed: false,
      },
      createdBy: admin._id,
    },
    {
      title: "Collect notarised affidavit — Rao Family",
      description: "Get the joint affidavit notarised from the Juhu notary. Required for next hearing.",
      category: "admin",
      priority: "High",
      status: "in_progress",
      deadline: new Date(new Date().setHours(16, 0, 0, 0)), // today 4pm
      assignedTo: priya._id,
      caseId: caseRao._id,
      clientId: clientRao._id,
      checklist: [
        { text: "Print affidavit on stamp paper", done: true },
        { text: "Get notary signature", done: false },
        { text: "Upload to case folder", done: false },
      ],
      createdBy: admin._id,
    },
    {
      title: "Call client on hearing outcome — Sterling Textiles",
      description: "Brief the MD on the NCLT interim order and next steps for the contract dispute.",
      category: "client_meeting",
      priority: "Medium",
      status: "pending",
      deadline: new Date(new Date().setHours(18, 30, 0, 0)), // today 6:30pm
      assignedTo: meera._id,
      caseId: caseSterling._id,
      clientId: clientSterling._id,
      checklist: [
        { text: "Summarise the NCLT order", done: false },
        { text: "Prepare next-steps memo", done: false },
      ],
      createdBy: admin._id,
    },
    {
      title: "Prepare land title summary — Nandi Infra",
      description: "Compile a chain of title for the Wakad plot from 1950 to present. Required for the compensation claim.",
      category: "research",
      priority: "Medium",
      status: "pending",
      deadline: daysFromNow(4),
      assignedTo: kabir._id,
      caseId: caseNandi._id,
      clientId: clientNandi._id,
      checklist: [
        { text: "Collect 7/12 extracts", done: true },
        { text: "Trace ownership chain", done: true },
        { text: "Verify mutation entries", done: true },
        { text: "Draft title summary report", done: false },
        { text: "Attach supporting maps", done: false },
        { text: "Cross-check with revenue records", done: false },
        { text: "Get senior review", done: false },
        { text: "Finalise and file", done: false },
      ],
      createdBy: admin._id,
    },
    {
      title: "Draft settlement terms — Rao Family",
      description: "Work with both parties to draft a consent agreement dividing the Juhu property.",
      category: "drafting",
      priority: "Low",
      status: "pending",
      deadline: daysFromNow(6),
      assignedTo: kabir._id,
      caseId: caseRao._id,
      clientId: clientRao._id,
      checklist: [
        { text: "Meet with all siblings", done: false },
        { text: "Valuation of property", done: false },
        { text: "Draft consent terms", done: false },
        { text: "File before next hearing", done: false },
      ],
      createdBy: admin._id,
    },
    {
      title: "Submit court fee receipt — Sharma Case",
      description: "File the final court fee receipt for the closed criminal revision matter.",
      category: "admin",
      priority: "Low",
      status: "completed",
      deadline: daysAgo(10),
      assignedTo: priya._id,
      caseId: caseSharma._id,
      clientId: clientSharma._id,
      checklist: [
        { text: "Obtain challan copy", done: true },
        { text: "File with registry", done: true },
        { text: "Update case file", done: true },
      ],
      createdBy: admin._id,
    },
  ]);

  console.log("[seed] Created 6 tasks");

  // -------------------------------------------------------------------------
  // 5. Documents
  // -------------------------------------------------------------------------

  console.log("[seed] Creating documents...");

  await DocumentModel.create([
    {
      name: "Sale Deed — Kapoor Estates.pdf",
      originalName: "Sale_Deed_Kapoor_Estates.pdf",
      kind: "PDF",
      mimeType: "application/pdf",
      size: 3355443,
      sizeFormatted: "3.2 MB",
      caseId: caseMehra._id,
      uploadedBy: priya._id,
      state: "Pending",
      nasPath: "/Cases/SW-2026-0148/Sale_Deed_Kapoor_Estates.pdf",
      nasFolder: "/Cases/SW-2026-0148",
      version: 1,
    },
    {
      name: "Supply Agreement 2024.docx",
      originalName: "Supply_Agreement_2024.docx",
      kind: "DOCX",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 839680,
      sizeFormatted: "820 KB",
      caseId: caseSterling._id,
      uploadedBy: meera._id,
      state: "Approved",
      nasPath: "/Cases/SW-2026-0139/Supply_Agreement_2024.docx",
      nasFolder: "/Cases/SW-2026-0139",
      version: 1,
      approvedBy: admin._id,
      approvedAt: daysAgo(1),
    },
    {
      name: "Property Valuation.xlsx",
      originalName: "Property_Valuation_Wakad.xlsx",
      kind: "XLSX",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 1153433,
      sizeFormatted: "1.1 MB",
      caseId: caseNandi._id,
      uploadedBy: kabir._id,
      state: "Approved",
      nasPath: "/Cases/SW-2026-0102/Property_Valuation_Wakad.xlsx",
      nasFolder: "/Cases/SW-2026-0102",
      version: 1,
      approvedBy: admin._id,
      approvedAt: daysAgo(2),
    },
    {
      name: "Site Photographs.zip",
      originalName: "Nandi_Wakad_Site_Photos.zip",
      kind: "ZIP",
      mimeType: "application/zip",
      size: 19293798,
      sizeFormatted: "18.4 MB",
      caseId: caseNandi._id,
      uploadedBy: priya._id,
      state: "Pending",
      nasPath: "/Cases/SW-2026-0102/Site_Photos.zip",
      nasFolder: "/Cases/SW-2026-0102",
      version: 1,
      accessRequests: [
        {
          userId: kabir._id,
          reason: "Need site photos for title summary report",
          status: "pending",
          createdAt: hoursAgo(3),
        },
      ],
    },
    {
      name: "Affidavit Scan.jpg",
      originalName: "Rao_Affidavit_Scan.jpg",
      kind: "JPG",
      mimeType: "image/jpeg",
      size: 655360,
      sizeFormatted: "640 KB",
      caseId: caseRao._id,
      uploadedBy: priya._id,
      state: "Rejected",
      nasPath: "/Cases/SW-2026-0121/Affidavit_Scan.jpg",
      nasFolder: "/Cases/SW-2026-0121",
      version: 1,
      rejectedBy: admin._id,
      rejectedReason: "Image is blurry — please rescan at 300 DPI and re-upload.",
    },
  ]);

  console.log("[seed] Created 5 documents");

  // -------------------------------------------------------------------------
  // 6. Calendar Events
  // -------------------------------------------------------------------------

  console.log("[seed] Creating calendar events...");

  const today = new Date();
  const aug = today.getMonth();

  await CalendarEvent.create([
    {
      title: "Mehra vs. Kapoor — Hearing",
      description: "Arguments on interim injunction application. Court Room 14.",
      type: "hearing",
      start: new Date(today.getFullYear(), aug, today.getDate() + (today.getHours() < 10 ? 0 : 1), 10, 30),
      end: new Date(today.getFullYear(), aug, today.getDate() + (today.getHours() < 10 ? 0 : 1), 13, 0),
      allDay: false,
      caseId: caseMehra._id,
      createdBy: admin._id,
      assignedTo: [rohan._id],
    },
    {
      title: "Call — Anaya Mehra",
      description: "Discuss hearing outcome and next steps. Confirm document requirements.",
      type: "call_reminder",
      start: new Date(today.getFullYear(), aug, today.getDate() + 2, 17, 0),
      allDay: false,
      clientId: clientMehra._id,
      createdBy: admin._id,
      assignedTo: [meera._id],
    },
    {
      title: "Sterling Textiles — NCLT Interim Plea",
      description: "Hearing on interim relief application. Bench II.",
      type: "hearing",
      start: new Date(today.getFullYear(), aug, today.getDate() + 2, 11, 0),
      end: new Date(today.getFullYear(), aug, today.getDate() + 2, 12, 30),
      allDay: false,
      caseId: caseSterling._id,
      createdBy: admin._id,
      assignedTo: [meera._id],
    },
    {
      title: "Draft settlement terms deadline",
      description: "Deadline for the Rao family settlement draft.",
      type: "task",
      start: new Date(today.getFullYear(), aug, today.getDate() + 6),
      allDay: true,
      caseId: caseRao._id,
      createdBy: admin._id,
      assignedTo: [kabir._id],
    },
    {
      title: "Imran Qureshi — Leave",
      description: "Approved annual leave.",
      type: "leave",
      start: new Date(today.getFullYear(), aug, 15),
      end: new Date(today.getFullYear(), aug, 16),
      allDay: true,
      createdBy: admin._id,
      assignedTo: [imran._id],
    },
    {
      title: "Rao Family Settlement — Hearing",
      description: "Next hearing for the partition suit. City Civil Court, Room 6.",
      type: "hearing",
      start: new Date(today.getFullYear(), aug, today.getDate() + 8, 14, 15),
      end: new Date(today.getFullYear(), aug, today.getDate() + 8, 15, 30),
      allDay: false,
      caseId: caseRao._id,
      createdBy: admin._id,
      assignedTo: [kabir._id],
    },
    {
      title: "Firm Town Hall",
      description: "Quarterly all-hands meeting at the conference room.",
      type: "firm_event",
      start: new Date(today.getFullYear(), aug, 22, 16, 0),
      end: new Date(today.getFullYear(), aug, 22, 17, 30),
      allDay: false,
      createdBy: admin._id,
      assignedTo: allUsers.map((u) => u._id),
    },
    {
      title: "Nandi Infra — Mention Hearing",
      description: "Mention before the District Court for listing.",
      type: "hearing",
      start: new Date(today.getFullYear(), aug, 25, 10, 0),
      end: new Date(today.getFullYear(), aug, 25, 10, 30),
      allDay: false,
      caseId: caseNandi._id,
      createdBy: admin._id,
      assignedTo: [rohan._id],
    },
    {
      title: "Call — Nandi Infra MD",
      description: "Discuss compensation strategy and pending documents.",
      type: "call_reminder",
      start: new Date(today.getFullYear(), aug, 28, 15, 30),
      allDay: false,
      clientId: clientNandi._id,
      createdBy: admin._id,
      assignedTo: [rohan._id],
    },
    {
      title: "Filing deadline — Reply affidavit",
      description: "Deadline to file reply affidavit in Nandi matter.",
      type: "task",
      start: new Date(today.getFullYear(), aug, 30),
      allDay: true,
      caseId: caseNandi._id,
      createdBy: admin._id,
      assignedTo: [priya._id],
    },
  ]);

  console.log("[seed] Created 10 calendar events");

  // -------------------------------------------------------------------------
  // 7. Chat Groups & Messages
  // -------------------------------------------------------------------------

  console.log("[seed] Creating chat groups and messages...");

  const [chatMeera, chatKapoor, chatPriya, chatKabir, chatSterling] = await ChatGroup.create([
    {
      name: "Adv. Meera Iyer",
      type: "direct",
      members: [
        { userId: admin._id, name: "Adv. Rohan Desai", role: "admin", joinedAt: daysAgo(60) },
        { userId: meera._id, name: "Adv. Meera Iyer", role: "member", joinedAt: daysAgo(60) },
      ],
      createdBy: admin._id,
      lastMessage: { text: "Noted. I'll prepare the brief tonight.", senderId: admin._id, senderName: "Adv. Rohan Desai", at: hoursAgo(2) },
    },
    {
      name: "Kapoor Matter — Team",
      type: "group",
      members: [
        { userId: admin._id, name: "Adv. Rohan Desai", role: "admin", joinedAt: daysAgo(60) },
        { userId: meera._id, name: "Adv. Meera Iyer", role: "member", joinedAt: daysAgo(60) },
        { userId: priya._id, name: "Priya Nair", role: "member", joinedAt: daysAgo(55) },
      ],
      createdBy: admin._id,
      lastMessage: { text: "Thanks, I'll review it before EOD", senderId: admin._id, senderName: "Adv. Rohan Desai", at: hoursAgo(4) },
    },
    {
      name: "Priya Nair",
      type: "direct",
      members: [
        { userId: admin._id, name: "Adv. Rohan Desai", role: "admin", joinedAt: daysAgo(45) },
        { userId: priya._id, name: "Priya Nair", role: "member", joinedAt: daysAgo(45) },
      ],
      createdBy: admin._id,
      lastMessage: { text: "Affidavit is notarised ✓", senderId: priya._id, senderName: "Priya Nair", at: hoursAgo(5) },
    },
    {
      name: "Adv. Kabir Shah",
      type: "direct",
      members: [
        { userId: admin._id, name: "Adv. Rohan Desai", role: "admin", joinedAt: daysAgo(40) },
        { userId: kabir._id, name: "Adv. Kabir Shah", role: "member", joinedAt: daysAgo(40) },
      ],
      createdBy: admin._id,
      lastMessage: { text: "Court fee receipt attached", senderId: kabir._id, senderName: "Adv. Kabir Shah", at: daysAgo(1) },
    },
    {
      name: "Sterling Textiles — Counsel",
      type: "group",
      members: [
        { userId: admin._id, name: "Adv. Rohan Desai", role: "admin", joinedAt: daysAgo(30) },
        { userId: meera._id, name: "Adv. Meera Iyer", role: "member", joinedAt: daysAgo(30) },
        { userId: kabir._id, name: "Adv. Kabir Shah", role: "member", joinedAt: daysAgo(30) },
        { userId: priya._id, name: "Priya Nair", role: "member", joinedAt: daysAgo(30) },
      ],
      createdBy: admin._id,
      lastMessage: { text: "Contract review meeting at 3 PM tomorrow", senderId: meera._id, senderName: "Adv. Meera Iyer", at: hoursAgo(6) },
    },
  ]);

  // Messages for the Meera direct chat
  await ChatMessage.create([
    {
      groupId: chatMeera._id,
      text: "Good morning — did the deed come through?",
      sender: meera._id,
      senderName: "Adv. Meera Iyer",
      senderInitials: "MI",
      readBy: [meera._id, admin._id],
      createdAt: hoursAgo(3),
    },
    {
      groupId: chatMeera._id,
      text: "Yes, Priya uploaded it. Pending your approval.",
      sender: admin._id,
      senderName: "Adv. Rohan Desai",
      senderInitials: "RD",
      readBy: [admin._id, meera._id],
      createdAt: hoursAgo(2.9),
    },
    {
      groupId: chatMeera._id,
      text: "Reviewing now. Hearing is at 10:30 tomorrow.",
      sender: meera._id,
      senderName: "Adv. Meera Iyer",
      senderInitials: "MI",
      readBy: [meera._id, admin._id],
      createdAt: hoursAgo(2.8),
    },
    {
      groupId: chatMeera._id,
      text: "Noted. I'll prepare the brief tonight.",
      sender: admin._id,
      senderName: "Adv. Rohan Desai",
      senderInitials: "RD",
      readBy: [admin._id],
      createdAt: hoursAgo(2),
    },
  ]);

  // Messages for Kapoor group
  await ChatMessage.create([
    {
      groupId: chatKapoor._id,
      text: "@Priya the sale deed draft is ready for review",
      sender: admin._id,
      senderName: "Adv. Rohan Desai",
      senderInitials: "RD",
      mentions: [priya._id],
      readBy: [admin._id, meera._id, priya._id],
      createdAt: hoursAgo(5),
    },
    {
      groupId: chatKapoor._id,
      text: "Deed uploaded for approval",
      sender: priya._id,
      senderName: "Priya Nair",
      senderInitials: "PN",
      readBy: [priya._id, admin._id, meera._id],
      createdAt: hoursAgo(4.8),
    },
    {
      groupId: chatKapoor._id,
      text: "Thanks, I'll review it before EOD",
      sender: admin._id,
      senderName: "Adv. Rohan Desai",
      senderInitials: "RD",
      readBy: [admin._id, meera._id, priya._id],
      createdAt: hoursAgo(4),
    },
  ]);

  // Messages for Sterling group
  await ChatMessage.create([
    {
      groupId: chatSterling._id,
      text: "Contract review meeting at 3 PM tomorrow — please bring the original documents",
      sender: meera._id,
      senderName: "Adv. Meera Iyer",
      senderInitials: "MI",
      readBy: [meera._id, admin._id, kabir._id],
      createdAt: hoursAgo(6),
    },
  ]);

  // Messages for Kabir direct
  await ChatMessage.create([
    {
      groupId: chatKabir._id,
      text: "How's the Rao settlement draft coming along?",
      sender: admin._id,
      senderName: "Adv. Rohan Desai",
      senderInitials: "RD",
      readBy: [admin._id, kabir._id],
      createdAt: daysAgo(2),
    },
    {
      groupId: chatKabir._id,
      text: "Still waiting on the valuation report. Will have it ready by Thursday.",
      sender: kabir._id,
      senderName: "Adv. Kabir Shah",
      senderInitials: "KS",
      readBy: [kabir._id, admin._id],
      createdAt: daysAgo(2),
    },
  ]);

  console.log("[seed] Created 5 chat groups with messages");

  // -------------------------------------------------------------------------
  // 8. Audit Logs
  // -------------------------------------------------------------------------

  console.log("[seed] Creating audit logs...");

  // Create audit logs one at a time — the pre-validate hook assigns a monotonic
  // `sequence` + `prevHash` chain, and array-form `create()` runs those async
  // hooks concurrently (via insertMany), which would duplicate sequence numbers
  // and break the tamper-evident hash chain.
  const auditLogEntries = [
    { userId: admin._id, userName: "Adv. Rohan Desai", action: "login", resource: "auth", ip: "192.168.1.100", createdAt: minsAgo(10) },
    { userId: priya._id, userName: "Priya Nair", action: "upload", resource: "document", resourceId: caseMehra._id.toString(), resourceName: "Sale Deed — Kapoor Estates.pdf", ip: "192.168.1.104", createdAt: hoursAgo(2) },
    { userId: meera._id, userName: "Adv. Meera Iyer", action: "approve", resource: "document", resourceId: caseSterling._id.toString(), resourceName: "Supply Agreement 2024.docx", ip: "192.168.1.102", createdAt: hoursAgo(4) },
    { userId: kabir._id, userName: "Adv. Kabir Shah", action: "access_request", resource: "document", resourceId: caseNandi._id.toString(), resourceName: "Site Photographs.zip", ip: "192.168.1.103", createdAt: hoursAgo(3) },
    { userId: admin._id, userName: "Adv. Rohan Desai", action: "update", resource: "case", resourceId: caseMehra._id.toString(), resourceName: "Mehra vs. Kapoor Estates", ip: "192.168.1.100", createdAt: hoursAgo(6) },
    { userId: meera._id, userName: "Adv. Meera Iyer", action: "create", resource: "task", resourceId: caseSterling._id.toString(), resourceName: "Call client on hearing outcome", ip: "192.168.1.102", createdAt: hoursAgo(7) },
    { userId: priya._id, userName: "Priya Nair", action: "update", resource: "task", resourceId: caseRao._id.toString(), resourceName: "Collect notarised affidavit", ip: "192.168.1.104", createdAt: hoursAgo(8) },
    { userId: admin._id, userName: "Adv. Rohan Desai", action: "create", resource: "chat", resourceName: "Sterling Textiles — Counsel", ip: "192.168.1.100", createdAt: daysAgo(30) },
    { userId: kabir._id, userName: "Adv. Kabir Shah", action: "update", resource: "case", resourceId: caseNandi._id.toString(), resourceName: "Nandi Infra — Land Acquisition", ip: "192.168.1.103", createdAt: daysAgo(2) },
    { userId: admin._id, userName: "Adv. Rohan Desai", action: "reject", resource: "document", resourceId: caseRao._id.toString(), resourceName: "Affidavit Scan.jpg", details: "Blurry scan — needs re-upload", ip: "192.168.1.100", createdAt: daysAgo(3) },
    { userId: meera._id, userName: "Adv. Meera Iyer", action: "update", resource: "case", resourceId: caseSharma._id.toString(), resourceName: "Sharma vs. State", details: "Status changed to Closed", ip: "192.168.1.102", createdAt: daysAgo(30) },
    { userId: admin._id, userName: "Adv. Rohan Desai", action: "settings_change", resource: "settings", details: "Updated firm storage allocation", ip: "192.168.1.100", createdAt: daysAgo(5) },
    { userId: priya._id, userName: "Priya Nair", action: "logout", resource: "auth", ip: "192.168.1.104", createdAt: daysAgo(1) },
    { userId: admin._id, userName: "Adv. Rohan Desai", action: "seed", resource: "user", details: "Database seeded with sample data", ip: "127.0.0.1", createdAt: new Date() },
  ];
  for (const entry of auditLogEntries) {
    await AuditLog.create(entry);
  }

  console.log("[seed] Created 14 audit log entries");

  // -------------------------------------------------------------------------
  // Done
  // -------------------------------------------------------------------------

  console.log("\n[seed] ✅ Seed complete!");
  console.log("[seed]");
  console.log("[seed] Login credentials (all users):");
  console.log("[seed]   Email:  rohan@stillworks.legal    (Admin)");
  console.log("[seed]   Email:  meera@stillworks.legal    (Senior Advocate)");
  console.log("[seed]   Email:  kabir@stillworks.legal    (Junior Advocate)");
  console.log("[seed]   Email:  priya@stillworks.legal    (Legal Assistant)");
  console.log("[seed]   Email:  imran@stillworks.legal    (Office Admin)");
  console.log("[seed]   Password:  password123");
  console.log("[seed]");
  console.log("[seed] Created:");
  console.log(`[seed]   ${allUsers.length} users`);
  console.log(`[seed]   ${allClients.length} clients`);
  console.log(`[seed]   ${allCases.length} cases`);
  console.log(`[seed]   6 tasks`);
  console.log(`[seed]   5 documents`);
  console.log(`[seed]   10 calendar events`);
  console.log(`[seed]   5 chat groups`);
  console.log(`[seed]   9 messages`);
  console.log(`[seed]   14 audit log entries`);

  await mongoose.disconnect();
  console.log("[seed] Disconnected from MongoDB");
}

seed().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
