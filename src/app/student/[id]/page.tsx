"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion } from "framer-motion";
import { UserPlus, Clipboard, CalendarCheck, BookOpen, QrCode } from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";
import { decrypt } from "@/lib/crypto";
import { toast } from "sonner";

export default function StudentSummaryPage() {
  const params = useParams() as { id?: string };
  const encryptedId = params?.id ?? "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [studentSummary, setStudentSummary] = useState<any | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        if (!encryptedId) {
          setError("Missing student id.");
          setLoading(false);
          return;
        }

        // decrypt id
        let studentId = "";
        try {
          studentId = decrypt(decodeURIComponent(encryptedId));
        } catch (e) {
          console.error("decrypt error", e);
          setError("Invalid or corrupted student link.");
          setLoading(false);
          return;
        }

        // Try student_summary view first
        const { data: summary, error: sumErr } = await supabase
          .from("student_summary")
          .select("*")
          .eq("student_id", studentId)
          .limit(1)
          .single();

        if (sumErr && sumErr.code !== "PGRST116") {
          // PGRST116 sometimes means no rows; we handle below
          console.error("student_summary fetch error", sumErr);
        }

        if (summary) {
          setStudentSummary(summary);
        } else {
          // fallback: assemble from tables
          const { data: sRow } = await supabase
            .from("students")
            .select("id, name, student_link, qr_token, class_id")
            .eq("id", studentId)
            .limit(1)
            .single();

          if (!sRow) {
            setError("Student not found.");
            setLoading(false);
            return;
          }

          const { data: cRow } = await supabase
            .from("classes")
            .select("id, class_name, class_code, class_section, class_grade")
            .eq("id", sRow.class_id)
            .limit(1)
            .single();

          const { data: attended } = await supabase
            .from("attendance")
            .select("date")
            .eq("student_id", studentId);

          const attendedDays = Array.isArray(attended) ? new Set(attended.map((a: any) => a.date)).size : 0;

          const { data: totalDays } = await supabase
            .from("attendance")
            .select("date")
            .eq("class_id", sRow.class_id);

          const totalClassDays = Array.isArray(totalDays) ? new Set(totalDays.map((a: any) => a.date)).size : 0;

          const totalAbsences = Math.max(0, (totalClassDays || 0) - attendedDays);

          const { data: totalActs } = await supabase
            .from("activities")
            .select("id")
            .eq("class_id", sRow.class_id);

          const { data: doneActs } = await supabase
            .from("student_activities")
            .select("id")
            .eq("student_id", studentId)
            .eq("status", "done");

          const { data: missingActs } = await supabase
            .from("student_activities")
            .select("id")
            .eq("student_id", studentId)
            .eq("status", "missing");

          setStudentSummary({
            student_id: sRow.id,
            student_name: sRow.name,
            student_link: sRow.student_link,
            qr_token: sRow.qr_token,
            class_id: cRow?.id,
            class_name: cRow?.class_name,
            class_code: cRow?.class_code,
            class_section: cRow?.class_section,
            class_grade: cRow?.class_grade,
            attended_days: attendedDays,
            total_class_days: totalClassDays,
            total_absences: totalAbsences,
            total_activities: (totalActs || []).length,
            completed_activities: (doneActs || []).length,
            missing_activities: (missingActs || []).length,
          });
        }

        // Activities list (student_activities joined with activities)
        const { data: actRows } = await supabase
          .from("student_activities")
          .select("id, status, activity_title, activity_description, deadline, activity_submission_link, activity_id")
          .eq("student_id", studentId)
          .order("deadline", { ascending: true });

        setActivities(actRows || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load student summary");
        setError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptedId]);

  const summary = useMemo(() => studentSummary, [studentSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center p-6">
        <div className="bg-white/80 p-6 rounded-2xl border border-[#f5576c]/20 shadow-lg max-w-md text-center">
          <h2 className="text-lg font-semibold">Unable to show student summary</h2>
          <p className="text-sm text-gray-600 mt-2">{error ?? "No summary available."}</p>
          <div className="mt-4">
            <button onClick={() => router.push("/student/scan")} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white">
              Back to Scan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
            {summary.student_name}
          </h1>
          <p className="text-sm text-gray-600">
            {summary.class_code ? `${summary.class_code} • ${summary.class_name}` : summary.class_name}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Attended" value={summary.attended_days ?? 0} subtitle="days" icon={CalendarCheck} color="from-green-400 to-green-600" />
          <StatCard title="Absences" value={summary.total_absences ?? 0} subtitle="total absences" icon={Clipboard} color="from-orange-400 to-orange-600" />
          <StatCard title="Activities" value={`${summary.completed_activities ?? 0}/${summary.total_activities ?? 0}`} subtitle="completed / total" icon={BookOpen} color="from-purple-400 to-pink-500" />
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg mb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#f5576c] to-[#F7BB97] flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">Student Details</h3>
              <p className="text-sm text-gray-600 mt-1">Name: <span className="font-medium text-gray-800">{summary.student_name}</span></p>
              <p className="text-sm text-gray-600">Class: <span className="font-medium text-gray-800">{summary.class_name} ({summary.class_code})</span></p>
              {summary.student_link && (
                <p className="text-sm text-gray-600">Profile: <a className="text-[#f5576c] underline" href={summary.student_link} target="_blank" rel="noreferrer">Open</a></p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Assigned Activities</h3>
            <p className="text-xs text-gray-500">{activities.length} items</p>
          </div>

          {activities.length === 0 ? (
            <div className="py-6 text-center text-gray-500">No assigned activities.</div>
          ) : (
            <div className="space-y-3">
              {activities.map((a) => (
                <div key={a.id} className="p-3 rounded-lg border border-[#f5576c]/10 hover:shadow-md transition bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-gray-800">{a.activity_title || a.activity_title || "Untitled"}</h4>
                      <div className="text-sm" dangerouslySetInnerHTML={{ __html: a.activity_description }} />
                      <p className="text-xs text-gray-500 mt-2">Status: <span className="font-medium">{a.status}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-red-600">Deadline: {a.deadline ? new Date(a.deadline).toLocaleDateString() : "-"}</p>
                      {a.activity_submission_link && (
                        <a className="text-xs text-[#f5576c] underline block mt-2" href={a.activity_submission_link} target="_blank" rel="noreferrer">
                          Submission Here
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => router.push("/student/scan")} className="px-4 py-2 rounded-lg bg-white/80 border border-[#f5576c]/20">Back to Scan</button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white">Print</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-lg p-4 border border-[#f5576c]/20">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
}
