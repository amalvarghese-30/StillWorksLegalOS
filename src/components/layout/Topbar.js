import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from "react";
import { Bell, Dot, Search, Sparkles, Menu, Moon, Plus, X, Briefcase, User, FileText, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";
import { QuickActionsMenu } from "./QuickActionsMenu";
import { AddCaseDialog } from "@/components/cases/AddCaseDialog";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { useSearch } from "@/lib/search";
import { useNavigate } from "@tanstack/react-router";
export function Topbar() {
    const [dark, setDark] = useState(false);
    const [showAddCase, setShowAddCase] = useState(false);
    const [navOpen, setNavOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const { user } = useAuth();
    const { notifications, unreadCount, markAsRead, markAllAsRead, refetch } = useNotifications();
    const { searchResults, isLoading, isError } = useSearch(searchTerm, { limit: 8 });
    const navigate = useNavigate();
    const toggleTheme = () => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
    };
    return (_jsxs("header", { className: "glass sticky top-4 z-30 flex h-18 items-center gap-3 rounded-2xl px-4", children: [_jsxs(Sheet, { open: navOpen, onOpenChange: setNavOpen, children: [_jsx(SheetTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "rounded-md lg:hidden", "aria-label": "Open navigation", children: _jsx(Menu, { size: 20, strokeWidth: 1.75 }) }) }), _jsxs(SheetContent, { side: "left", className: "w-[320px] border-none bg-transparent p-3", children: [_jsx(SheetTitle, { className: "sr-only", children: "Navigation" }), _jsx(Sidebar, { onNavigate: () => setNavOpen(false) })] })] }), _jsxs("div", { className: "relative min-w-0 flex-1", children: [_jsx(Search, { size: 18, strokeWidth: 1.75, className: "pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" }), _jsx("input", { type: "search", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), placeholder: "Search cases, clients, documents\u2026", "aria-label": "Search", className: "h-10 w-full rounded-md border border-border/70 bg-card/70 pr-3 pl-10 text-helper outline-none transition-colors focus:border-primary/50" }), !isLoading && !isError && searchTerm.trim() !== "" && (_jsxs("div", { className: "absolute left-0 right-0 mt-2 w-full max-h-96 overflow-auto bg-card border border-border rounded-md shadow-lg z-20", children: [searchResults.cases.length === 0 &&
                                searchResults.clients.length === 0 &&
                                searchResults.documents.length === 0 &&
                                searchResults.tasks.length === 0 &&
                                searchResults.users.length === 0 ? (_jsx("div", { className: "px-4 py-2 text-sm text-muted-foreground", children: "No results found" })) : (_jsxs(_Fragment, { children: [searchResults.cases.map((caseItem) => (_jsx(Button, { variant: "ghost", size: "xs", className: "w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted", onClick: () => navigate(`/cases/${caseItem._id}`), children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex-shrink-0", children: _jsx(Briefcase, { size: 16, strokeWidth: 1.75, className: "text-primary" }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium", children: caseItem.title }), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Case #", caseItem.number] })] })] }) }, `case-${caseItem._id}`))), searchResults.clients.map((clientItem) => (_jsxs(Button, { variant: "ghost", size: "xs", className: "w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted", onClick: () => navigate(`/clients/${clientItem._id}`), children: [_jsxs("div", { className: "flex items-center gap-3>\n                        {div className=", "flex-shrink-0": true, children: [User, " size=", 16, " strokeWidth=", 1.75, " className=\"text-primary\" />"] }), div, " className=\"min-w-0>", p, " className=\"font-medium>", clientItem.name] }, `client-${clientItem._id}`)), { p, className = "text-xs text-muted-foreground>,
                                        Client })] })), "p>"] }))] })] }));
}
{ /* Documents */ }
{
    searchResults.documents.map((docItem) => (_jsxs(Button, { variant: "ghost", size: "xs", className: "w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted", onClick: () => navigate(`/documents/${docItem._id}`), children: [_jsxs("div", { className: "flex items-center gap-3>\n                        {div className=", "flex-shrink-0": true, children: [FileText, " size=", 16, " strokeWidth=", 1.75, " className=\"text-primary\" />"] }), div, " className=\"min-w-0>", p, " className=\"font-medium>", docItem.name] }, `doc-${docItem._id}`)), { p, className = "text-xs text-muted-foreground>,
        Document,
        p } >
    , div >
    , div >
    , Button);
}
{ /* Tasks */ }
{
    searchResults.tasks.map((taskItem) => (_jsxs(Button, { variant: "ghost", size: "xs", className: "w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted", onClick: () => navigate(`/tasks/${taskItem._id}`), children: [_jsxs("div", { className: "flex items-center gap-3>\n                        {div className=", "flex-shrink-0": true, children: [CheckSquare, " size=", 16, " strokeWidth=", 1.75, " className=\"text-primary\" />"] }), div, " className=\"min-w-0>", p, " className=\"font-medium>", taskItem.title] }, `task-${taskItem._id}`)), { p, className = "text-xs text-muted-foreground>,
        Task,
        p } >
    , div >
    , div >
    , Button);
}
{ /* Users (placeholder) */ }
{
    searchResults.users.map((userItem) => (_jsxs(Button, { variant: "ghost", size: "xs", className: "w-full text-left px-3 py-2 border-b border-border/50 hover:bg-muted", onClick: () => {
            // No user profile page yet, just log
            console.log("User click:", userItem._id);
        }, children: [_jsxs("div", { className: "flex items-center gap-3>\n                        {div className=", "flex-shrink-0": true, children: [User, " size=", 16, " strokeWidth=", 1.75, " className=\"text-primary\" />"] }), div, " className=\"min-w-0>", p, " className=\"font-medium>", userItem.name] }, `user-${userItem._id}`)), { p, className = "text-xs text-muted-foreground> }, { userItem, : .role }, p >
    , div >
    , div >
    , Button);
}
 >
;
div >
;
div >
    { /* Right Side Controls */}
    < div;
className = "flex shrink-0 items-center gap-1.5" >
    _jsx(QuickActionsMenu, { renderTrigger: (toggle) => (_jsx(Button, { variant: "ghost", size: "icon", className: "rounded-md", "aria-label": "Quick actions", onClick: toggle, children: _jsx(Sparkles, { size: 19, strokeWidth: 1.75 }) })) });
{ /* Notifications Sheet */ }
_jsxs(Sheet, { open: notificationsOpen, onOpenChange: setNotificationsOpen, children: [_jsx(SheetTrigger, { asChild: true, children: _jsxs(Button, { variant: "ghost", size: "icon", className: "relative rounded-md", "aria-label": "Notifications", children: [_jsx(Bell, { size: 19, strokeWidth: 1.75 }), unreadCount > 0 && (_jsx("span", { className: "absolute top-0 right-0 size-2.5 rounded-full bg-destructive text-xs font-medium text-destructive-foreground flex items-center justify-center", children: unreadCount > 99 ? "99+" : unreadCount }))] }) }), _jsx(SheetContent, { side: "right", className: "w-[360px] border-none bg-transparent p-4>\n            <SheetTitle className=", "text-lg": true, "font-semibold": true, "mb-4": true, children: "Notifications" }), _jsx("div", { className: "space-y-3>\n              {notifications.length === 0 ? (\n                <p className=", "text-center": true, "text-muted-foreground": true, "py-8": true, children: "No notifications" }), ") : (", _jsx(_Fragment, { children: notifications.map((notification) => (_jsxs("div", { className: `flex flex-col gap-2 p-4 rounded-lg border border-border bg-card ${!notification.read ? "bg-primary/5" : ""}`, children: [_jsx("div", { className: "flex items-start gap-3>\n                        <div className=", "flex-shrink-0": true, children: _jsx(Bell, { size: 18, strokeWidth: 1.75, className: "text-primary" }) }), div, " className=\"min-w-0 flex-1>", p, " className=\"font-medium>", notification.title] }, notification._id)), { p, className = "text-sm text-muted-foreground line-clamp-2> }, { notification, : .message }) }), "p>", p, " className=\"text-xs text-muted-foreground mt-1>", new Date(notification.createdAt).toLocaleString(undefined, {
            timeStyle: "short",
            dateStyle: "short",
        })] });
div >
;
div >
    { div, className = "flex items-end gap-2> };
{
    !notification.read && (_jsxs(Button, { variant: "ghost", size: "icon", onClick: () => markAsRead(notification._id), "aria-label": "Mark as read", children: [Dot, " size=", 12, " />"] }));
}
_jsxs(Button, { variant: "ghost", size: "icon", onClick: () => {
        // For now, we just mark as read on close
        markAsRead(notification._id);
    }, "aria-label": "Close", children: [X, " size=", 16, " strokeWidth=", 1.75, " />"] });
div >
;
div >
;
_jsx("div", { className: "pt-4 border-t border-border>\n                    <Button\n                      variant=", outline: true });
";
size = "sm";
onClick = { markAllAsRead };
className = "w-full"
    >
        Mark;
all;
Button;
div >
;
 >
;
div >
;
SheetContent >
;
Sheet >
    { /* Theme Toggle */}
    < Button;
variant = "ghost";
size = "icon";
className = "rounded-md";
onClick = { toggleTheme };
aria - label;
"Toggle theme"
    >
        {} /  > ;
_jsx(Moon, { size: 19, strokeWidth: 1.75 });
Button >
    { /* New Case Button */}
    < Button;
className = "gradient-primary hidden rounded-md text-primary-foreground shadow-soft transition-transform duration-200 hover:-translate-y-0.5 sm:inline-flex";
onClick = {}();
setShowAddCase(true);
    >
        _jsx(Plus, { size: 17, strokeWidth: 2 });
New;
Case;
Button >
    { /* User Avatar */}
    < span;
className = "grid size-10 place-items-center rounded-full bg-primary/12 font-display text-helper font-semibold text-primary" >
    { user, initials } ?? "SW";
span >
;
div >
    { /* Add Case Dialog */};
{
    showAddCase && _jsx(AddCaseDialog, { open: showAddCase, onClose: () => setShowAddCase(false) });
}
header >
;
;
