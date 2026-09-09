import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth.js";
import { Types } from "mongoose";
import { Case } from "../models/Case.js";
import { Client } from "../models/Client.js";
import { DocumentModel } from "../models/Document.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import { canAccessCase, getAccessibleCaseIds, getAccessibleClientIds } from "../middleware/authorization.js";

const router = Router();

router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/search — global search across multiple entities
// ---------------------------------------------------------------------------

router.get("/", async (req: Request, res: Response) => {
  try {
    const { q, limit = "10" } = req.query;
    const searchQuery = q as string;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 10));

    if (!searchQuery || !searchQuery.trim()) {
      res.json({
        cases: [],
        clients: [],
        documents: [],
        tasks: [],
        users: [],
      });
      return;
    }

    const queryRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    // We'll search in parallel for each entity type
    const [cases, clients, documents, tasks, users] = await Promise.all([
      // Search cases
      (async () => {
        // Build filter for cases user can access
        let caseFilter: any = {
          $or: [
            { title: queryRegex },
            { number: queryRegex }, // Case number might be numeric, but we'll try regex anyway
          ],
        };

        // Non-admins only see cases they have access to
        if (req.user!.role !== "admin") {
          const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
          caseFilter = {
            $and: [
              caseFilter,
              {
                $or: [
                  { _id: { $in: accessibleCaseIds } },
                  // Also include cases where the user is a party? We don't have a direct party field in Case model.
                  // We'll rely on the accessibleCaseIds from the middleware which should already consider parties.
                ],
              },
            ],
          };
        }

        return await Case.find(caseFilter)
          .limit(limitNum)
          .select("title number _id")
          .lean();
      })(),

      // Search clients
      (async () => {
        let clientFilter: any = {
          $or: [
            { name: queryRegex },
            { email: queryRegex },
            { phone: queryRegex },
          ],
        };

        if (req.user!.role !== "admin") {
          const accessibleClientIds = await getAccessibleClientIds(req.userId!, req.user!.role);
          if (accessibleClientIds.length === 0) {
            return [];
          }
          clientFilter = {
            $and: [
              clientFilter,
              { _id: { $in: accessibleClientIds } },
            ],
          };
        }

        return await Client.find(clientFilter)
          .limit(limitNum)
          .select("name _id kycStatus type")
          .lean();
      })(),

      // Search documents
      (async () => {
        let docFilter: any = {
          name: queryRegex,
        };

        // Non-admins only see documents they have access to
        if (req.user!.role !== "admin") {
          const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
          docFilter = {
            $or: [
              { uploadedBy: req.userId }, // Documents they uploaded
              { caseId: { $in: accessibleCaseIds } }, // Documents in their accessible cases
            ],
          };
        }

        return await DocumentModel.find(docFilter)
          .limit(limitNum)
          .select("name _id")
          .lean();
      })(),

      // Search tasks
      (async () => {
        let taskFilter: any = {
          $or: [
            { title: queryRegex },
          ],
        };

        // Non-admins only see tasks they have access to
        if (req.user!.role !== "admin") {
          const accessibleCaseIds = await getAccessibleCaseIds(req.userId!, req.user!.role);
          taskFilter = {
            $or: [
              { assignedTo: req.userId }, // Tasks assigned to them
              { createdBy: req.userId }, // Tasks they created
              { caseId: { $in: accessibleCaseIds } }, // Tasks in their accessible cases
            ],
          };
        }

        return await Task.find(taskFilter)
          .limit(limitNum)
          .select("title _id")
          .lean();
      })(),

      // Search users (maybe we don't want to expose all users, but for now, let's allow searching for users to mention or assign)
      (async () => {
        // Only allow admins to search users? Or allow everyone to search for their own name?
        // We'll allow everyone to search for users, but only return limited fields.
        let userFilter: any = {
          $or: [
            { name: queryRegex },
            { email: queryRegex },
          ],
        };

        // Non-admins can only see themselves? Or we can let them see all users?
        // We'll return limited fields for non-admins: only their own user record.
        if (req.user!.role !== "admin") {
          userFilter._id = req.userId; // Only return the current user
        }

        return await User.find(userFilter)
          .limit(limitNum)
          .select("name email _id role")
          .lean();
      })(),
    ]);

    res.json({
      cases,
      clients,
      documents,
      tasks,
      users,
    });
  } catch (err) {
    console.error("[search] Error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;