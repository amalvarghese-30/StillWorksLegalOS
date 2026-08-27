import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Briefcase, CheckSquare, Loader2, AlertTriangle, MessageSquare, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusPill, toneForStatus } from "@/components/common/StatusPill";
import { Button } from "@/components/ui/button";
import { useEmployees, type EmployeeRecord } from "@/services/admin";
import { useEmployeeWorkload } from "@/services/reports";
import { useCreateDirectChat } from "@/services/chat";
import { useNavigate } from "@tanstack/react-router";
import { AddEmployeeDialog } from "@/components/admin/AddEmployeeDialog";
import { EditEmployeeDialog } from "@/components/admin/EditEmployeeDialog";

export const Route = createFileRoute("/_admin/admin/employees")({
  head: () => ({
    meta: [
      { title: "Employees · StillWorks LegalOS" },
      {
        name: "description",
        content: "Team management for the firm — roles, workload, hearings and permissions.",
      },
      { property: "og:title", content: "Employees · StillWorks LegalOS" },
      { property: "og:description", content: "Roles, workload, hearings and permissions for your team." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const navigate = useNavigate();
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRecord | null>(null);
  const { data, isLoading, isError } = useEmployees();
  const { data: workloadData } = useEmployeeWorkload();
  const employees = data?.employees ?? [];
  const workloadById = new Map((workloadData?.workloads ?? []).map((w) => [w._id, w]));
  const createDirectChat = useCreateDirectChat();

  const handleMessage = (userId: string) => {
    createDirectChat.mutate(
      { userId },
      {
        onSuccess: (result) => {
          navigate({ to: "/chat", search: { groupId: result.group._id } });
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        breadcrumb={[{ label: "StillWorks", to: "/" }, { label: "Employees" }]}
        title="Employees"
        subtitle={`${employees.length} people on the team.`}
        actions={
          <Button
            className="gradient-primary rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5"
            onClick={() => setShowAddEmployee(true)}
          >
            <Plus size={17} strokeWidth={2} />
            Add employee
          </Button>
        }
      />

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-6 shadow-soft animate-pulse">
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <div className="h-1.5 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-12 text-center">
          <AlertTriangle size={28} className="text-destructive" />
          <p className="font-medium">Failed to load employees</p>
          <p className="text-helper text-muted-foreground">Check that the server is running and try again.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {employees.map((e) => (
            <article key={e._id} className="lift rounded-lg border border-border bg-card p-6 shadow-soft">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                <span className="gradient-primary grid size-12 shrink-0 place-items-center rounded-full font-display font-semibold text-primary-foreground">
                  {(e.name ?? "")
                    .replace("Adv. ", "")
                    .split(" ")
                    .map((n: string) => n[0] ?? "")
                    .join("")}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{e.name}</h2>
                  <p className="truncate text-caption text-muted-foreground">{e.role}</p>
                </div>
                <StatusPill tone={toneForStatus(e.status)}>{e.status}</StatusPill>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-md bg-muted/60 p-3">
                  <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                    <Briefcase size={14} strokeWidth={1.75} /> Active cases
                  </dt>
                  <dd className="num mt-1 text-title font-semibold">{workloadById.get(e._id)?.activeCases ?? 0}</dd>
                </div>
                <div className="rounded-md bg-muted/60 p-3">
                  <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                    <CheckSquare size={14} strokeWidth={1.75} /> Pending tasks
                  </dt>
                  <dd className="num mt-1 text-title font-semibold">{workloadById.get(e._id)?.pendingTasks ?? 0}</dd>
                </div>
              </dl>

              <p className="mt-4 truncate text-caption text-muted-foreground">{e.email}</p>

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  onClick={() => setEditingEmployee(e)}
                >
                  <Pencil size={14} strokeWidth={1.75} className="mr-1" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-md"
                  onClick={() => handleMessage(e._id)}
                  disabled={createDirectChat.isPending}
                >
                  <MessageSquare size={14} strokeWidth={1.75} className="mr-1" />
                  Message
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showAddEmployee && (
        <AddEmployeeDialog open={showAddEmployee} onClose={() => setShowAddEmployee(false)} />
      )}

      <EditEmployeeDialog employee={editingEmployee} onClose={() => setEditingEmployee(null)} />
    </div>
  );
}
