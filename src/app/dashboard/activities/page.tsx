"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DashboardNavbar from "@/components/DashboardNavbar";
import { Spinner } from "@/components/ui/spinner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  ChevronRight,
  Edit2,
  Trash2,
  Search,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

type ClassRow = {
  id: string;
  class_name: string;
  class_code?: string;
};

type ActivityRow = {
  submission_link: string;
  id: string;
  class_id: string | null;
  title: string;
  description: string;
  created_at?: string;
};

export default function ActivitiesPage() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<any>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [filtered, setFiltered] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState<string | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formClassId, setFormClassId] = useState<string | "">("");
  const [formDeadline, setFormDeadline] = useState<string>(""); // ISO date-time local
  const [formSubmissionLink, setFormSubmissionLink] = useState<string>("");
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchAll();
    const channel = supabase
      .channel("activities-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activities" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classes" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [activities, searchTerm, classFilter]);

  async function fetchAll() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.replace("/auth/login");
        return;
      }
      const user = authData.user;
      setTeacher(user);

      const { data: classData, error: classErr } = await supabase
        .from("classes")
        .select("id, class_name, class_code")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });
      if (classErr) throw classErr;
      setClasses(classData || []);

      const { data: activityData, error: actErr } = await supabase
        .from("activities")
        .select("*")
        .in(
          "class_id",
          (classData || []).map((c: any) => c.id)
        )
        .order("created_at", { ascending: false });

      if (actErr) throw actErr;

      setActivities(activityData || []);
    } catch (err: any) {
      console.error("fetchAll error", err);
      toast.error("Failed to load activities.");
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    let result = activities.slice();
    if (classFilter !== "all") {
      result = result.filter((a) => a.class_id === classFilter);
    }
    if (searchTerm.trim() !== "") {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          stripHTML(extractDescriptionHtml(a.description)).toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }

  function parseDeadlineFromDescription(desc: string): string | null {
    const match = desc.match(/<!--\s*deadline:([^>]+)\s*-->/);
    if (match) return match[1];
    return null;
  }

  function extractDescriptionHtml(desc: string) {
    return desc.replace(/<!--\s*deadline:[^>]+\s*-->/, "").trim();
  }

  function stripHTML(html: string) {
    const tmp = typeof window !== "undefined" ? document.createElement("div") : null;
    if (!tmp) return html;
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  async function handleSaveActivity(e?: React.FormEvent) {
    e?.preventDefault();
    if (!formTitle || !formClassId) {
      toast.error("Please choose a class and a title.");
      return;
    }
    const descriptionHtml = editorRef.current?.innerHTML || "";
    const deadlineISO = formDeadline ? new Date(formDeadline).toISOString() : null;
    const storedDescription = (deadlineISO ? `<!--deadline:${deadlineISO}-->` : "") + descriptionHtml;

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.replace("/auth/login");
        return;
      }

      if (editing) {
        const { data, error } = await supabase
          .from("activities")
          .update({
            title: formTitle,
            description: storedDescription,
            deadline: formDeadline,
            submission_link: formSubmissionLink,
          })
          .eq("id", editing.id)
          .select()
          .single();

        if (error) throw error;
        toast.success("Activity updated");

        await supabase
          .from("student_activities")
          .update({
            activity_title: formTitle,
            activity_description: storedDescription,
            deadline: formDeadline,
            activity_submission_link: formSubmissionLink,
          })
          .eq("activity_id", editing.id);
      } else {
        const { data, error } = await supabase
          .from("activities")
          .insert([
            {
              class_id: formClassId,
              title: formTitle,
              description: storedDescription,
              deadline: formDeadline,
              submission_link: formSubmissionLink,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        toast.success("Activity created");

        const { data: students } = await supabase
          .from("students")
          .select("id")
          .eq("class_id", formClassId);

        if (students && students.length > 0) {
          const inserts = students.map((s: any) => ({
            student_id: s.id,
            activity_id: data.id,
            status: "missing",
            activity_title: formTitle,
            activity_description: storedDescription,
            activity_submission_link: formSubmissionLink,
            deadline: formDeadline,
          }));
          await supabase.from("student_activities").insert(inserts);
        }
      }

      setIsCreateModalOpen(false);
      setEditing(null);
      setFormTitle("");
      setFormClassId("");
      setFormDeadline("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save activity");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditing(null);
    setFormTitle("");
    setFormClassId(classes?.[0]?.id || "");
    setFormDeadline("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setIsCreateModalOpen(true);
  }

  function openEditModal(a: ActivityRow) {
    setEditing(a);
    setFormTitle(a.title);
    setFormClassId(a.class_id || "");
    const dl = parseDeadlineFromDescription(a.description);
    setFormDeadline(dl ? new Date(dl).toISOString().slice(0, 16) : "");
    if (editorRef.current) editorRef.current.innerHTML = extractDescriptionHtml(a.description);
    setIsCreateModalOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this activity? This will also delete student activity records.")) return;
    setLoading(true);
    try {
      await supabase.from("student_activities").delete().eq("activity_id", id);
      const { error } = await supabase.from("activities").delete().eq("id", id);
      if (error) throw error;
      toast.success("Activity deleted");
      fetchAll();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete activity");
    } finally {
      setLoading(false);
    }
  }

  function execCommand(cmd: string) {
    document.execCommand(cmd);
    editorRef.current?.focus();
  }

  const classOptions = useMemo(() => [{ id: "all", class_name: "All classes" }, ...classes], [classes]);

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar user={teacher} onLogout={async () => { await supabase.auth.signOut(); router.replace("/auth/login"); }} currentPage="Activities" />

      <div className="relative z-10 mt-3 sm:mt-18 max-w-6xl mx-auto pt-24 p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              Activities
            </h1>
            <p className="text-gray-600 mt-1">Create and manage class activities</p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <div className="relative flex items-center bg-white/70 backdrop-blur-md rounded-xl px-3 py-2 border border-[#f5576c]/10 w-full sm:w-64">
              <Search className="w-4 h-4 text-gray-400 mr-2" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search activities..."
                className="bg-transparent outline-none w-full text-sm"
              />
            </div>

            <select
              className="rounded-xl border border-gray-200 px-3 py-2 bg-white/70 backdrop-blur-md"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value as any)}
            >
              <option value="all">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.class_code ? `${c.class_code} - ${c.class_name}` : c.class_name}
                </option>
              ))}
            </select>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-xl shadow-lg hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {filtered.length === 0 ? (
            <div className="text-center rounded-2xl p-8 bg-white/70 border border-[#f5576c]/10">
              <BookOpen className="w-12 h-12 text-[#f5576c] mx-auto mb-3" />
              <p className="text-gray-600">No activities found. Create one to get started.</p>
            </div>
          ) : (
            filtered.map((a, idx) => {
              const dl = parseDeadlineFromDescription(a.description);
              const descHtml = extractDescriptionHtml(a.description);
              const cls = classes.find((c) => c.id === a.class_id);
              return (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="group bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-4 border border-[#f5576c]/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0" onClick={() => router.push(`/dashboard/activities/${a.id}`)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-[#f5576c] inline-block px-2 py-1 rounded-full bg-[#f5576c]/10">
                            {cls?.class_code || "No class"}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-800 mt-2 truncate">{a.title}</h3>
                        </div>
                        <div className="text-sm text-red-600 ml-3">
                          Deadline: {dl ? new Date(dl).toLocaleString() : "No deadline"}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-2 ml-3">
                      <button
                        onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                        aria-expanded={expandedId === a.id}
                        className="p-2 rounded-md hover:bg-gray-100"
                      >
                        <ChevronRight
                          className={`w-5 h-5 text-gray-500 transform transition ${expandedId === a.id ? "rotate-90" : ""}`}
                        />
                      </button>

                      <div className="flex gap-1">
                        <button onClick={() => openEditModal(a)} className="p-2 rounded-md hover:bg-gray-100" title="Edit">
                          <Edit2 className="w-4 h-4 text-gray-600" />
                        </button>
                        <button onClick={() => handleDelete(a.id)} className="p-2 rounded-md hover:bg-gray-100" title="Delete">
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === a.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 border-t pt-3 text-sm text-gray-700"
                      >
                        <div dangerouslySetInnerHTML={{ __html: descHtml }} />
                        {a.submission_link ? (
                        <p className="text-gray-700 font-normal mt-2">
                            Submission Link:{" "}
                            <a 
                            href={a.submission_link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[#f5576c] hover:underline"
                            >
                            Click here to submit
                            </a>
                        </p>
                        ) : (<p className="text-gray-700 font-normal mt-2">
                            Submission Link: <i>No submission link provided.</i>
                        </p>)}
                        <div className="mt-3 text-xs text-gray-500">Created: {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}</div>
                        <div className="mt-2">
                          <button onClick={() => router.push(`/dashboard/activities/${a.id}`)} className="text-sm text-[#f5576c] hover:underline">Open details</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setIsCreateModalOpen(false); setEditing(null); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-5  max-h-[90vh] overflow-y-scroll"
            >
              <div className="flex items-center justify-between mb-4 ">
                <h2 className="text-xl font-semibold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
                  {editing ? "Edit Activity" : "Create Activity"}
                </h2>
                <button onClick={() => { setIsCreateModalOpen(false); setEditing(null); }} className="text-gray-400 hover:text-[#f5576c]">✕</button>
              </div>

              <form onSubmit={(e) => handleSaveActivity(e)} className="flex flex-col gap-3">
                <div>
                  <label className="text-sm text-gray-600">Title</label>
                  <input
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 mt-1"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editing ? (
                        <></>
                    ) : (
                    <div>
                        <label className="text-sm text-gray-600">Assign to class</label>
                        <select
                        value={formClassId}
                        onChange={(e) => setFormClassId(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2 mt-1"
                        required
                        >
                        <option value="">Select class</option>
                        {classes.map((c) => (
                            <option value={c.id} key={c.id}>
                            {c.class_code ? `${c.class_code} — ${c.class_name}` : c.class_name}
                            </option>
                        ))}
                        </select>
                    </div>
                  )}
                    
                  <div>
                    <label className="text-sm text-gray-600">Deadline (optional)</label>
                    <input
                      type="datetime-local"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600">Description</label>

                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => execCommand("bold")} className="px-3 py-1 rounded border">B</button>
                    <button type="button" onClick={() => execCommand("italic")} className="px-3 py-1 rounded border">I</button>
                    <button type="button" onClick={() => execCommand("insertUnorderedList")} className="px-3 py-1 rounded border">• List</button>
                    <button type="button" onClick={() => execCommand("insertOrderedList")} className="px-3 py-1 rounded border">1. List</button>
                    <button type="button" onClick={() => { if (editorRef.current) { editorRef.current.innerHTML = ""; } }} className="px-3 py-1 rounded border text-red-500">Clear</button>
                  </div>

                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[120px] mt-2 p-3 rounded-xl border bg-white/90 prose max-w-full"
                    dangerouslySetInnerHTML={{ __html: editing ? extractDescriptionHtml(editing.description) : "" }}
                  />
                  <p className="text-xs text-gray-400 mt-1">Use the toolbar to format text. This stores HTML.</p>
                </div>

                <div>
                  <label className="text-sm text-gray-600">Submission Link (Optional)</label>
                  <input
                    value={formSubmissionLink}
                    onChange={(e) => setFormSubmissionLink(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 mt-1"
                  />
                </div>

                <div className="flex gap-2 justify-end mt-3">
                  <button type="button" onClick={() => { setIsCreateModalOpen(false); setEditing(null); }} className="px-4 py-2 rounded-xl border">Cancel</button>
                  <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white">
                    {loading ? "Saving..." : editing ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
