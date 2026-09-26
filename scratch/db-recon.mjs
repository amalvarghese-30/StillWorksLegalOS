import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../server/.env") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/stillworks";

async function checkDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB successfully");

    const users = await mongoose.connection.db.collection("users").find({}, { projection: { name: 1, email: 1, role: 1, phone: 1, permissions: 1 } }).toArray();
    console.log("Users in DB:", users);

    const counts = {
      users: await mongoose.connection.db.collection("users").countDocuments(),
      clients: await mongoose.connection.db.collection("clients").countDocuments(),
      cases: await mongoose.connection.db.collection("cases").countDocuments(),
      tasks: await mongoose.connection.db.collection("tasks").countDocuments(),
      documents: await mongoose.connection.db.collection("documents").countDocuments(),
      calendarEvents: await mongoose.connection.db.collection("calendarevents").countDocuments(),
      chatGroups: await mongoose.connection.db.collection("chatgroups").countDocuments(),
      chatMessages: await mongoose.connection.db.collection("chatmessages").countDocuments(),
      notifications: await mongoose.connection.db.collection("notifications").countDocuments(),
      auditLogs: await mongoose.connection.db.collection("auditlogs").countDocuments(),
      sessions: await mongoose.connection.db.collection("sessions").countDocuments(),
    };
    console.log("Collection counts:", counts);

    await mongoose.disconnect();
  } catch (err) {
    console.error("DB check error:", err);
  }
}

checkDatabase();
