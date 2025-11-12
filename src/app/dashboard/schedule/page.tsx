"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";
import { CalendarDays, Clock, Download } from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { Spinner } from "@/components/ui/spinner";

/**
 * Notes:
 * - Grid granularity: 5 minutes
 * - 1 session = 55 minutes. DB durations snap to 1..3 sessions (55/110/165).
 * - schedule_days expected as ARRAY of strings like ['Mon','Tue'] or ['Monday'].
 * - PDF renders a timetable: columns per day, blocks positioned by start time and height by duration.
 */

export default function SchedulePage() {
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [teacher, setTeacher] = useState<any>(null);

  // schedule window (7:00 - 21:59)
  const startHour = 7;
  const endHour = 21;
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const blocksPerDay = (endHour - startHour + 1) * 12; // 5-min rows
  const BLOCK_HEIGHT_PX = 14; // height per 5-min block in px (adjust for density)

  // parse time string -> minutes since midnight
  const parseTimeToMinutes = (t: string | null) => {
    if (!t) return null;
    const parts = String(t).split(":").map((p) => parseInt(p, 10));
    if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  };

  const minutesToSessions = (minutes: number) => {
    if (!minutes || minutes <= 0) return 1;
    const sessions = Math.max(1, Math.min(3, Math.round(minutes / 55)));
    return sessions;
  };

  // load current user and classes
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      
      const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) {
              router.replace("/auth/login");
              return;
            }
      const user = authData.user;
      setUser(user);
      console.log(user);

      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", user.id)
        .single();

      if (teacherError) {
        console.error("Error fetching teacher:", teacherError);
        router.replace("/auth/login");
        return;
      }

      setTeacher(teacherData);

      const { data, error } = await supabase.from("classes").select("*").eq("teacher_id", user.id);

      if (error) {
        console.error("Error fetching schedule:", error);
        setLoading(false);
        return;
      }

      // map DB rows into a consistent shape
      const mapped = (data || []).map((r: any) => {
        const title = r.class_name || r.subject || r.class_code || "Untitled";
        return {
          id: r.id,
          title,
          schedule_days: r.schedule_days || r.schedule_days_text || [],
          time_start: r.time_start ? String(r.time_start) : null,
          time_end: r.time_end ? String(r.time_end) : null,
          room_number: r.room_number || r.room || r.room_no || "",
          raw: r,
        };
      });

      setSchedule(mapped);
    };

    load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
    setLoading(false);
  }, 2000); 
  return () => {
    clearTimeout(timer);
  };
  },[teacher])

  // build blocks for rendering
  const blocksByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const d of days) map[d] = [];

    schedule.forEach((cls) => {
      const startMin = parseTimeToMinutes(cls.time_start);
      const endMin = parseTimeToMinutes(cls.time_end);
      if (startMin === null || endMin === null) return;

      const displayStartMin = Math.max(startMin, startHour * 60);
      const rawDuration = Math.max(1, endMin - startMin);
      const sessions = minutesToSessions(rawDuration); // 1..3
      const displayDuration = sessions * 55; // minutes

      const offsetFromWindowStart = displayStartMin - startHour * 60;
      const rowStart = Math.floor(offsetFromWindowStart / 5);
      const rowSpan = Math.ceil(displayDuration / 5);

      const clsDays = Array.isArray(cls.schedule_days) ? cls.schedule_days : typeof cls.schedule_days === "string" ? [cls.schedule_days] : [];

      clsDays.forEach((dayRaw: string) => {
        const day = String(dayRaw || "")
          .slice(0, 3)
          .replace(".", "")
          .replace(",", "")
          .replace(/\s/g, "");
        if (!days.includes(day)) return;
        map[day].push({
          id: cls.id + "-" + day,
          title: cls.title,
          rowStart,
          rowSpan,
          startMin: displayStartMin,
          duration: displayDuration,
          room_number: cls.room_number || "",
          raw: cls.raw,
        });
      });
    });

    // Sort blocks per day by startMin for predictable stacking
    for (const d of days) {
      map[d].sort((a, b) => a.startMin - b.startMin);
    }

    return map;
  }, [schedule]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  /* ------------------ PDF export: render timetable blocks per day ------------------ */
  const handleExportPDF = async () => {
    setIsSaving(true);
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const topY = 80;
    const headerHeight = 40;
    const name = teacher.firstname + ' ' + teacher.lastname;

    // header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor("#f5576c");
    doc.text("Weekly Class Schedule", margin, topY);
    doc.setFontSize(11);
    doc.setTextColor("#333333");
    doc.setFont("helvetica", "normal");
    doc.text(`Teacher: ${name || "Unknown"}`, margin, topY + 18);
    doc.text(`Email: ${user?.email || ""}`, margin + 200, topY + 18);

    // compute drawing area for timetable
    const tableY = topY + headerHeight;
    const tableHeight = pageHeight - tableY - 60;
    const tableWidth = pageWidth - margin * 2;

    // columns: time label column small, then days equal width
    const timeColW = 60;
    const dayColW = (tableWidth - timeColW) / days.length;

    // pixels per minute mapping for PDF area
    const totalMinutesDisplayed = (endHour - startHour + 1) * 60;
    // but to avoid super narrow blocks, compute scale
    const pxPerMinute = tableHeight / totalMinutesDisplayed;

    // draw day headers
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    days.forEach((d, i) => {
      const x = margin + timeColW + i * dayColW + 6;
      doc.text(d, x, tableY + 12);
    });

    // draw vertical lines for columns (optional subtle)
    doc.setDrawColor(220);
    // time column vertical line
    doc.setLineWidth(0.5);
    doc.line(margin + timeColW, tableY - 4, margin + timeColW, tableY + tableHeight);
    // day column separators
    for (let i = 0; i <= days.length; i++) {
      const x = margin + timeColW + i * dayColW;
      doc.setDrawColor(240);
      doc.setLineWidth(0.4);
      doc.line(x, tableY - 6, x, tableY + tableHeight);
    }

    // draw horizontal hour separators (darker) and subtle ticks for 30 minutes
    doc.setFontSize(8);
    for (let m = startHour * 60; m <= (endHour + 1) * 60; m += 60) {
      const y = tableY + (m - startHour * 60) * pxPerMinute;
      doc.setDrawColor(200);
      doc.setLineWidth(0.6);
      doc.line(margin, y, margin + tableWidth, y);
      // draw hour label in time column
      const hh = Math.floor(m / 60);
      const label = `${hh % 12 || 12}:00 ${hh < 12 ? "AM" : "PM"}`;
      doc.setTextColor("#f5576c");
      doc.text(label, margin + 4, y - 2);
    }

    // for each day, draw blocks
    days.forEach((day, dayIdx) => {
      const blocks = blocksByDay[day] || [];
      // to visually separate overlapping blocks, we keep track of stacking index for small horizontal offset (max offset)
      blocks.forEach((b: any, idx: number) => {
        const startMin = b.startMin;
        const duration = b.duration;
        const y = tableY + (startMin - startHour * 60) * pxPerMinute;
        const h = Math.max(12, duration * pxPerMinute); // min height for visibility
        const x = margin + timeColW + dayIdx * dayColW + 6 + (idx % 3) * 6; // small offset for overlaps
        const w = dayColW - 12 - (idx % 3) * 6;

        // block background
        doc.setFillColor(245, 87, 108); // base pink
        doc.setDrawColor(240);
        doc.roundedRect(x, y + 2, w, h - 4, 4, 4, "F");

        // text: title (bold), room & time (smaller)
        const padding = 6;
        const maxTextWidth = w - padding * 2;
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);

        // title (truncate if necessary)
        const title = b.title || "Untitled";
        const titleLines = doc.splitTextToSize(title, maxTextWidth);
        const lineLimit = 2;
        const titleToRender = titleLines.slice(0, lineLimit);

        doc.text(titleToRender, x + padding, y + padding + 8, { maxWidth: maxTextWidth });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const hhStart = Math.floor(b.startMin / 60);
        const mmStart = b.startMin % 60;
        const hhEnd = Math.floor((b.startMin + b.duration) / 60);
        const mmEnd = (b.startMin + b.duration) % 60;
        const timeRange = `${hhStart % 12 || 12}:${String(mmStart).padStart(2, "0")} - ${hhEnd % 12 || 12}:${String(mmEnd).padStart(2, "0")}`;
        const room = b.room_number ? `Room ${b.room_number}` : "";

        const info = [room, timeRange].filter(Boolean).join(" • ");
        const infoLines = doc.splitTextToSize(info, maxTextWidth);
        doc.text(infoLines, x + padding, y + padding + 8 + (titleToRender.length * 12));
      });
    });

    // footer
    doc.setFontSize(10);
    doc.setTextColor("#888");
    doc.text("Generated by CoTeacher", margin, pageHeight - 28);

    // finish
    await new Promise((r) => setTimeout(r, 300));
    setIsSaving(false);
    doc.save(`${name}_Weekly_Timetable.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]"></div>
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

      <DashboardNavbar user={teacher || { name: "Teacher", email: "" }} onLogout={handleLogout} currentPage="Schedule" />

      <div className="relative z-10 sm:mt-18 max-w-7xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl pb-1 sm:text-4xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              Weekly Schedule
            </h1>
            <p className="text-gray-600 mt-1">Your class overview for the week</p>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleExportPDF}
              whileHover={{ scale: 1.05 }}
              disabled={isSaving}
              whileTap={!isSaving ? { scale: 0.95 } : {}}
              className="hover:opacity-90 transition-all cursor-pointer bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg"
            >
              {isSaving ? (
                <>
                  <Spinner />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export PDF
                </>
              )}
            </motion.button>

            <div className="flex items-center gap-2 text-gray-600">
              <CalendarDays className="w-5 h-5 text-[#f5576c]" />
              <span className="font-medium">Monday – Saturday</span>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]"></div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl shadow-lg border border-[#f5576c]/20 bg-white/70 backdrop-blur-md overflow-auto"
          >
            <div
              className="min-w-[1000px] relative"
              style={{
                display: "grid",
                gridTemplateColumns: `90px repeat(${days.length}, 1fr)`, // slightly wider time col
                gridTemplateRows: `auto repeat(${blocksPerDay}, ${BLOCK_HEIGHT_PX}px)`,
              }}
            >
              {/* Sticky header row (days) */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 40,
                  display: "contents",
                }}
              >
                <div
                  style={{
                    gridColumn: "1",
                    gridRow: 1,
                    background: "white",
                    borderBottom: "1px solid rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div className="text-sm font-semibold text-center" style={{ color: "#f5576c" }}>
                    Time
                  </div>
                </div>

                {days.map((d, i) => (
                  <div
                    key={`head-${d}`}
                    style={{
                      gridColumn: i + 2,
                      gridRow: 1,
                      background: "#fff",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div className="text-sm font-semibold text-center text-gray-700">{d}</div>
                  </div>
                ))}
              </div>

              {/* Time label column and row backgrounds */}
              {Array.from({ length: blocksPerDay }).map((_, idx) => {
                const absoluteMin = startHour * 60 + idx * 5;
                const hh = Math.floor(absoluteMin / 60);
                const mm = absoluteMin % 60;
                let bg = idx % 2 === 0 ? "#ffffff" : "#ffffff";
                if (mm === 0) bg = "#ffffff";

                // Time label cell
                return (
                  <div
                    key={`time-${idx}`}
                    style={{
                      gridColumn: 1,
                      gridRow: idx + 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: bg,
                      borderRight: "1px solid rgba(0,0,0,0.04)",
                      borderBottom: "1px solid rgba(0,0,0,0.04)",
                      color: "#f5576c",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {mm === 0 ? `${hh % 12 || 12}:00 ${hh < 12 ? "AM" : "PM"}` : ""}
                  </div>
                );
              })}

              {/* Day columns base cells (for grid visuals) */}
              {days.map((day, colIdx) =>
                Array.from({ length: blocksPerDay }).map((_, rowIdx) => {
                  const absoluteMin = startHour * 60 + rowIdx * 5;
                  const mm = absoluteMin % 60;
                  const bg = mm === 0 ? "#ffffff" : rowIdx % 2 === 0 ? "#ffffff" : "#ffffff";
                  return (
                    <div
                      key={`cell-${day}-${rowIdx}`}
                      style={{
                        gridColumn: colIdx + 2,
                        gridRow: rowIdx + 2,
                        background: bg,
                        borderRight: "1px solid rgba(0,0,0,0.04)",
                        borderBottom: "1px solid rgba(0,0,0,0.04)",
                      }}
                    />
                  );
                })
              )}

              {/* Render blocks per day */}
              {days.map((day, colIdx) =>
                (blocksByDay[day] || []).map((b: any, i: number) => {
                  const gridRowStart = b.rowStart + 2; // +2 because header occupies row 1
                  const gridRowEnd = b.rowStart + b.rowSpan + 2;
                  const overlapOffset = i * 6;
                  const zIndex = 40 + i;
                  return (
                    <div
                      key={`${b.id}-${i}`}
                      style={{
                        gridColumn: colIdx + 2,
                        gridRow: `${gridRowStart} / ${gridRowEnd}`,
                        padding: 6,
                        position: "relative",
                        zIndex,
                      }}
                    >
                      <div
                        className="rounded-lg text-white font-semibold flex flex-col justify-center items-start"
                        style={{
                          position: "absolute",
                          top: 2,
                          left: `${overlapOffset}px`,
                          right: `${overlapOffset}px`,
                          bottom: 2,
                          background: "linear-gradient(90deg,#f5576c,#F7BB97)",
                          boxShadow: "0 6px 14px rgba(245,87,108,0.12)",
                          padding: "6px 8px",
                          fontSize: 12,
                          lineHeight: 1.05,
                          overflow: "hidden",
                        }}
                        title={`${b.title} • ${b.room_number} • ${Math.floor(b.startMin / 60)}:${String(b.startMin % 60).padStart(2, "0")}`}
                      >
                        <div className="truncate" style={{ fontWeight: 700 }}>
                          {b.title}
                        </div>
                        <div className="text-xs font-normal opacity-90 mt-1">
                          {`${b.room_number ? `Room ${b.room_number} • ` : ""}${Math.floor(b.startMin / 60)}:${String(
                            b.startMin % 60
                          ).padStart(2, "0")} - ${Math.floor((b.startMin + b.duration) / 60)}:${String((b.startMin + b.duration) % 60).padStart(2, "0")}`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}

        <div className="mt-4 text-center text-gray-500 text-sm sm:hidden">
          <p>Swipe left/right to view full schedule →</p>
        </div>
      </div>
    </div>
  );
}
