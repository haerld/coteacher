"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import DashboardNavbar from "@/components/DashboardNavbar";
import { Spinner } from "@/components/ui/spinner";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

type StudentRow = {
  id: string;
  name: string;
  qr_token?: string;
};

export default function ActivityDetailPage() {
  const router = useRouter();
  const params = useParams();
  const activityId = params?.id as string;

  const [teacher, setTeacher] = useState<any>(null);
  const [activity, setActivity] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
  fetchData();

  const channel = supabase
    .channel(`activity-detail-${activityId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "student_activities",
        filter: `activity_id=eq.${activityId}`
      },
      () => {
        fetchStudents();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [activityId]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData?.user) {
        router.replace("/auth/login");
        return;
      }
      setTeacher(authData.user);

      const { data: act } = await supabase.from("activities").select("*").eq("id", activityId).single();
      if (!act) {
        toast.error("Activity not found");
        router.push("/dashboard/activities");
        return;
      }
      setActivity(act);
      await fetchStudents();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  async function fetchStudents() {
    const { data } = await supabase
      .from("student_activities")
      .select("id, student_id, status, students(id, name)")
      .eq("activity_id", activityId);

    if (data) {
      const rows = data.map((r: any) => ({
        rowId: r.id,
        studentId: r.student_id,
        status: r.status,
        name: r.students?.name || "Unknown",
        student: r.students,
      }));
      setStudents(rows);
    }
  }

  function parseDeadlineFromDescription(desc: string): string | null {
    const match = desc.match(/<!--\s*deadline:([^>]+)\s*-->/);
    if (match) return match[1];
    return null;
  }
  function extractDescriptionHtml(desc: string) {
    return desc.replace(/<!--\s*deadline:[^>]+\s*-->/, "").trim();
  }

  async function toggleStatus(rowId: string, newStatus: "done" | "missing") {
    setUpdating(true);
    try {
      const { error } = await supabase.from("student_activities").update({ status: newStatus }).eq("id", rowId);
      if (error) throw error;
      await fetchStudents();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  if (loading || !activity) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]" />
      </div>
    );
  }

  const dl = parseDeadlineFromDescription(activity.description);
  const desc = extractDescriptionHtml(activity.description);

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar user={teacher} onLogout={async () => { await supabase.auth.signOut(); router.replace("/auth/login"); }} currentPage="Activities" />

      <div className="relative z-10 mt-3 sm:mt-18 max-w-4xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        <div className="bg-white/80 rounded-2xl p-6 border border-[#f5576c]/10 shadow">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{activity.title}</h1>
              <p className="text-sm text-gray-500 mt-1">Activity for class</p>
            </div>
            <div className="text-sm text-gray-500">{dl ? new Date(dl).toLocaleString() : "No deadline"}</div>
          </div>

          <div className="mt-4 prose max-w-full" dangerouslySetInnerHTML={{ __html: desc }} />

          <hr className="my-4" />

          <div>
            <h3 className="text-lg font-semibold">Student Submissions</h3>
            <p className="text-sm text-gray-500 mb-3">Toggle to mark who completed the activity</p>

            <div className="space-y-3">
              {students.length === 0 ? (
                <div className="text-gray-500">No students found for this class.</div>
              ) : (
                students.map((s) => (
                  <div key={s.rowId} className="flex items-center justify-between bg-white/70 p-3 rounded-lg border border-gray-100">
                    <div>
                      <div className="font-medium text-gray-800">{s.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={updating}
                        onClick={() => toggleStatus(s.rowId, s.status === "done" ? "missing" : "done")}
                        className={`px-3 py-1 rounded-full font-medium text-sm transition ${
                          s.status === "done" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {s.status === "done" ? (
                          <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Passed</span>
                        ) : (
                          <span className="flex items-center gap-2"><X className="w-4 h-4" /> Missing</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => router.push("/dashboard/activities")} className="px-4 py-2 rounded-xl border">Back</button>
          </div>
        </div>
      </div>
    </div>
  );
}
