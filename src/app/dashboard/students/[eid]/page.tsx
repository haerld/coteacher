"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Edit3,
  Download,
  Plus,
  Trash2,
  X,
  CalendarCheck,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { decrypt } from "@/lib/crypto";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

/**
 * Student Details Page
 *
 * - Expects route param `eid` (encrypted student id)
 * - Decrypts using NEXT_PUBLIC_CRYPTO_KEY
 * - Fetches student, student's class, missing activities (status = 'missing')
 * - Edit student name & class via modal (Sonner toasts)
 * - Add missing activity (activity_title, activity_description)
 * - QR code generated from student.qr_token with download option
 *
 * Note: For production security, decrypt IDs on server-side.
 */

export default function StudentDetailsPage() {
  const params = useParams() as { eid?: string };
  const router = useRouter();
  const eid = params?.eid ?? "";
  const CRYPTO_KEY = process.env.NEXT_PUBLIC_CRYPTO_KEY || "change-me"; // replace in env
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [missingActivities, setMissingActivities] = useState<any[]>([]);

  // UI
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", class_id: "" });

  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [newActivity, setNewActivity] = useState({ title: "", description: "" });

  useEffect(() => {
 
    const load = async () => {
      setLoading(true);

      try {
        // 1. Auth user
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
          router.replace("/auth/login");
          return;
        }
        const user = authData.user;

        // 2. teacher record
        const { data: tData, error: tErr } = await supabase
          .from("teachers")
          .select("*")
          .eq("id", user.id)
          .single();

        if (tErr || !tData) {
          console.error("Teacher fetch error", tErr);
          router.replace("/auth/login");
          return;
        }
        setTeacher(tData);

        // 3. decrypt eid
        if (!eid) {
          toast.error("No student specified");
          router.push("/dashboard/students");
          return;
        }

        const decryptedId = decrypt(eid);
        console.log(decryptedId);
        if (!decryptedId) {
          toast.error("Invalid or corrupted student id");
          router.push("/dashboard/students");
          return;
        }

        const { data: clsData, error: clsErr } = await supabase
          .from("classes")
          .select("*")
          .eq("teacher_id", tData.id)
          .order("created_at", { ascending: false });

        if (!clsErr && Array.isArray(clsData)) setClasses(clsData || []);

        const { data: sData, error: sErr } = await supabase
          .from("students")
          .select("*, classes:class_id (id, class_name, class_code, class_grade, class_section)")
          .eq("id", decryptedId)
          .single();

        if (sErr || !sData) {
          console.error("Student fetch error", sErr);
          toast.error("Student not found");
          router.push("/dashboard/students");
          return;
        }

        setStudent(sData);
        setEditForm({ name: sData.name || "", class_id: sData.class_id || "" });

        // 6. fetch missing activities
        const { data: mData, error: mErr } = await supabase
          .from("student_activities")
          .select("*")
          .eq("student_id", decryptedId)
          .eq("status", "missing")
          .order("id", { ascending: false });

        if (!mErr && Array.isArray(mData)) setMissingActivities(mData || []);
      } catch (err: any) {
        console.error(err);
        toast.error("Failed to load student details");
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eid]);

  // helper: refresh missing activities and student
  const refreshData = async () => {
    if (!student?.id) return;
    setLoading(true);
    try {
      const { data: sData, error: sErr } = await supabase
        .from("students")
        .select("*, classes:class_id (id, class_name, class_code, class_grade, class_section)")
        .eq("id", student.id)
        .single();
      if (!sErr && sData) {
        setStudent(sData);
        setEditForm({ name: sData.name || "", class_id: sData.class_id || "" });
      }

      const { data: mData, error: mErr } = await supabase
        .from("student_activities")
        .select("*")
        .eq("student_id", student.id)
        .eq("status", "missing")
        .order("id", { ascending: false });

      if (!mErr && Array.isArray(mData)) setMissingActivities(mData || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // Edit student (name + class)
  const handleSaveEdit = async () => {
    if (!editForm.name || !editForm.class_id) {
      toast.error("Please provide name and class");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          name: editForm.name,
          class_id: editForm.class_id,
        })
        .eq("id", student.id);

      if (error) throw error;
      toast.success("Student updated");
      setIsEditOpen(false);
      await refreshData();
    } catch (err: any) {
      console.error("update student err", err);
      toast.error("Failed to update student", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  // Add missing activity
  const handleAddMissingActivity = async () => {
    if (!newActivity.title) {
      toast.error("Please provide activity title");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("student_activities")
        .insert([
          {
            student_id: student.id,
            activity_id: null,
            activity_title: newActivity.title,
            activity_description: newActivity.description,
            status: "missing",
          },
        ])
        .select("*");

      if (error) throw error;
      toast.success("Missing activity added");
      setNewActivity({ title: "", description: "" });
      setIsAddActivityOpen(false);
      await refreshData();
    } catch (err: any) {
      console.error("add missing err", err);
      toast.error("Failed to add activity", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete missing activity
  const handleDeleteMissing = async (id: string) => {
    if (!confirm("Delete this missing activity?")) return;
    try {
      setLoading(true);
      const { error } = await supabase.from("student_activities").delete().eq("id", id);
      if (error) throw error;
      toast.success("Missing activity removed");
      setMissingActivities((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete activity", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  // Download QR as PNG using QRCodeCanvas
  const downloadQr = () => {
    try {
      // The qr renders in canvas; qrcode.react renders a canvas element
      // We find the canvas in the DOM
      const canvas = document.querySelector<HTMLCanvasElement>("#student-qr canvas");
      if (!canvas) {
        toast.error("QR not ready");
        return;
      }
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeName = (student?.name || "student").replace(/\s+/g, "_");
      const safeCode = (student?.classes?.class_code || "class").replace(/\s+/g, "_");
      link.download = `${safeName}_${safeCode}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("QR downloaded");
    } catch (err) {
      console.error("download qr", err);
      toast.error("Failed to download QR");
    }
  };

  // UX guards
  if (loading && !student) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar user={teacher} onLogout={async () => { await supabase.auth.signOut(); router.replace("/auth/login"); }} currentPage="Students" />

      <div className="relative sm:mt-18 z-10 max-w-5xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <motion.button whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }} onClick={() => router.back()} className="cursor-pointer p-2 rounded-lg bg-white/60 backdrop-blur-md border border-[#f5576c]/10 hover:shadow transition">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </motion.button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              {student?.name}
            </h1>
            <p className="text-sm text-gray-600">{student?.classes?.class_name ?? student?.classes?.class_code ?? "-"}</p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setIsEditOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white font-medium shadow"
            >
              <Edit3 className="w-4 h-4 inline-block mr-2" /> Edit
            </motion.button>
          </div>
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: QR & basic info */}
          <div className="col-span-1 bg-white/70 backdrop-blur-md rounded-2xl p-6 border border-[#f5576c]/20 shadow-lg">
            <div className="flex flex-col items-center">
              <div id="student-qr" className="mb-4">
                <QRCodeCanvas
                  id="qr-canvas"
                  value={student?.qr_token || student?.id}
                  size={180}
                  level="Q"
                  includeMargin={true}
                  bgColor="#ffffff"
                  fgColor="#000000"
                  ref={(el: any) => { qrCanvasRef.current = el; }}
                />
              </div>

              <div className="flex gap-3 w-full">
                <button onClick={downloadQr} className="cursor-pointer flex-1 px-3 py-2 rounded-lg text-sm bg-white border border-[#f5576c]/20 hover:bg-[#fff7f6] transition">
                  <Download className="inline w-4 h-4 mr-2 text-[#f5576c]" /> Download QR
                </button>
              </div>

              <div className="w-full mt-4 text-sm text-gray-600">
                <p><span className="font-medium text-gray-800">Name:</span> {student?.name}</p>
                <p><span className="font-medium text-gray-800">Class:</span> {student?.classes?.class_code ?? "-"}</p>
                <p><span className="font-medium text-gray-800">Created:</span> {new Date(student?.created_at || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Middle column: Missing activities */}
          <div className="col-span-1 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Missing Activities</h2>
              <motion.button whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }} onClick={() => setIsAddActivityOpen(true)} className="cursor-pointer px-3 py-2 rounded-xl bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white font-medium shadow flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Missing Act
              </motion.button>
            </div>

            <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg">
              {missingActivities.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No missing activities</div>
              ) : (
                <ul className="space-y-3">
                  {missingActivities.map((a) => (
                    <li key={a.id} className="p-4 rounded-lg border border-gray-100 hover:shadow transition flex flex-col sm:flex-row sm:items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-4">
                          <h3 className="font-semibold text-gray-800">{a.activity_title || "Untitled Activity"}</h3>
                          <div className="text-sm text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleDateString() : ""}</div>
                        </div>
                        {a.activity_description && <p className="text-sm text-gray-600 mt-2">{a.activity_description}</p>}
                      </div>

                      <div className="mt-3 sm:mt-0 sm:ml-4 flex items-center gap-2">
                        <button onClick={() => handleDeleteMissing(a.id)} className="px-3 py-2 rounded-lg bg-white border border-red-100 text-red-600 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => toast("done feature coming soon")} className="px-3 py-2 rounded-lg bg-white border border-[#f5576c]/10">
                          <CalendarCheck className="w-4 h-4 text-[#f5576c]" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Student</h3>
                <button onClick={() => setIsEditOpen(false)} className="text-gray-400 hover:text-[#f5576c]">
                  <X />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-700">Full Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none" />

                <label className="text-sm text-gray-700">Class</label>
                <select value={editForm.class_id || ""} onChange={(e) => setEditForm((p) => ({ ...p, class_id: e.target.value }))} className="border rounded-lg px-3 py-2">
                  <option value="">Select Class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.class_code ?? c.class_name}</option>
                  ))}
                </select>

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setIsEditOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                  <button onClick={handleSaveEdit} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white">Save</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Missing Activity Modal */}
      <AnimatePresence>
        {isAddActivityOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add Missing Activity</h3>
                <button onClick={() => setIsAddActivityOpen(false)} className="text-gray-400 hover:text-[#f5576c]">
                  <X />
                </button>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm text-gray-700">Title</label>
                <input value={newActivity.title} onChange={(e) => setNewActivity((p) => ({ ...p, title: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none" />

                <label className="text-sm text-gray-700">Description (optional)</label>
                <textarea value={newActivity.description} onChange={(e) => setNewActivity((p) => ({ ...p, description: e.target.value }))} className="border rounded-lg px-3 py-2 outline-none" rows={4} />

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setIsAddActivityOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button>
                  <button onClick={handleAddMissingActivity} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white">Add</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
