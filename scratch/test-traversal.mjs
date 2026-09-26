import path from "node:path";

const STORAGE_ROOT = "C:\\Users\\Amal Varghese\\Desktop\\New folder\\legal-clarity-suite\\server\\uploads";

function getLocalPath(logicalPath) {
  const safeRel = logicalPath.replace(/^[\/\\]+/, "").replace(/\.\.[\/\\]/g, "");
  return path.join(STORAGE_ROOT, safeRel);
}

const payload = "....//....//windows/win.ini";
const resolved = getLocalPath(payload);
console.log("Input payload:", payload);
console.log("Resolved path:", resolved);
console.log("Escaped STORAGE_ROOT?:", !resolved.startsWith(STORAGE_ROOT));
