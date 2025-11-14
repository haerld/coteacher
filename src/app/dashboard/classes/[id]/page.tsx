"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  QrCode,
  UserPlus,
  Search,
  RotateCcw,
  Download,
  Calendar,
  CalendarCheck,
  Trash2,
  Edit3,
  ClipboardX,
} from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";
import { Html5QrcodeScanner } from "html5-qrcode";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { encrypt } from "@/lib/crypto";

export default function ClassDetailsPage() {
  const params = useParams() as { id?: string };
  const classId = params?.id ?? "";
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [teacher, setTeacher] = useState<any | null>(null);
  const [classRow, setClassRow] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterClassCode, setFilterClassCode] = useState("All");
  const [sortType, setSortType] = useState("none");

  const [showAddModal, setShowAddModal] = useState(false);
  const [newStudent, setNewStudent] = useState({ name: "", class_id: classId || "" });

  const lastScannedRef = useRef<Record<string, number>>({});

  const SUBS_CHANNEL = `class-${classId}-live`;

  const handleRowClick = (studentId: string) => {
      const encryptedId = encrypt(studentId);
      router.push(`/dashboard/students/${encryptedId}`);
  };

  const fetchAll = async () => {
    try {
      setLoading(true);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr || !authData?.user) {
        router.replace("/auth/login");
        return;
      }
      const user = authData.user;

      const { data: tData, error: tErr } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", user.id)
        .single();
      if (tErr || !tData) {
        toast.error("Unable to fetch teacher");
        router.replace("/auth/login");
        return;
      }
      setTeacher(tData);

      const { data: cData, error: cErr } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .eq("teacher_id", tData.id)
        .single();

      if (cErr || !cData) {
        toast.error("Class not found or you are not authorized");
        router.replace("/dashboard/classes");
        return;
      }
      setClassRow(cData);

      const { data: sData, error: sErr } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("created_at", { ascending: false });

      setStudents(sErr ? [] : sData || []);

      await fetchAttendanceForDate(attendanceDate);
    } catch (err: any) {
      console.error("fetchAll err", err);
      toast.error("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!classId) {
      router.replace("/dashboard/classes");
      return;
    }
    fetchAll();

    const channel = supabase
      .channel(SUBS_CHANNEL)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students", filter: `class_id=eq.${classId}` },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `class_id=eq.${classId}` },
        () => fetchAttendanceForDate(attendanceDate).catch(() => {})
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_activities" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function fetchAttendanceForDate(dateISO: string) {
    try {
      const dateOnly = dateISO; // YYYY-MM-DD
      const { data, error } = await supabase
        .from("attendance")
        .select("*, students(name, qr_token, class_id), marked_by")
        .eq("class_id", classId)
        .eq("date", dateOnly)
        .order("time", { ascending: true });

      if (error) {
        console.error("fetch attendance error", error);
        setAttendanceRows([]);
        return;
      }

      const rows = data || [];

      const markedIds = Array.from(new Set(rows.map((r: any) => r.marked_by).filter(Boolean)));
      let teacherMap: Record<string, string> = {};
      if (markedIds.length > 0) {
        const { data: tRows } = await supabase
          .from("teachers")
          .select("id, firstname, lastname")
          .in("id", markedIds);

        if (tRows && Array.isArray(tRows)) {
          tRows.forEach((t: any) => {
            teacherMap[t.id] = `${t.firstname ?? ""} ${t.lastname ?? ""}`.trim() || t.id;
          });
        }
      }

      const enriched = rows.map((r: any) => ({
        ...r,
        marked_by_name: r.marked_by ? teacherMap[r.marked_by] ?? r.marked_by : "—",
      }));

      setAttendanceRows(enriched);
    } catch (err) {
      console.error(err);
      setAttendanceRows([]);
    }
  }

  const onScanSuccess = async (decodedText: string) => {
    const token = decodedText;
    const now = Date.now();
    if (lastScannedRef.current[token] && now - lastScannedRef.current[token] < 3000) {
      return;
    }
    lastScannedRef.current[token] = now;

    try {
      const { data: studentMatch, error: studentErr } = await supabase
        .from("students")
        .select("*")
        .match({ qr_token: token })
        .limit(1)
        .single();

      let studentFound = studentMatch;

      if (!studentFound && token.includes("STUDENT:") && token.includes("CLASS:")) {
        const parsed = parseLegacyQrFormat(token);
        if (parsed) {
          const { name, classCode } = parsed;
          const { data: classByCode } = await supabase
            .from("classes")
            .select("id")
            .eq("class_code", classCode)
            .eq("teacher_id", teacher.id)
            .limit(1)
            .single();

          if (classByCode?.id) {
            const { data: studentByName } = await supabase
              .from("students")
              .select("*")
              .eq("name", name)
              .eq("class_id", classByCode.id)
              .limit(1)
              .single();
            studentFound = studentByName;
          }
        }
      }

      if (!studentFound) {
        toast.error("Student not found for scanned QR");
        return;
      }

      const nowDate = new Date();
      const dateOnly = nowDate.toISOString().slice(0, 10);
      const timeOnly = nowDate.toTimeString().slice(0, 8); // HH:MM:SS

      const { data: existing } = await supabase
        .from("attendance")
        .select("id")
        .eq("student_id", studentFound.id)
        .eq("class_id", classId)
        .eq("date", dateOnly)
        .limit(1)
        .single();

      if (existing) {
        playBeep();
        toast("Already marked present for today: " + studentFound.name);

        await fetchAttendanceForDate(attendanceDate);
        return;
      }

      const { data: inserted, error: attErr } = await supabase
        .from("attendance")
        .insert([
          {
            student_id: studentFound.id,
            class_id: classId,
            date: dateOnly,
            time: timeOnly,
            marked_by: teacher?.id || null,
          },
        ])
        .select("*")
        .single();

      if (attErr) {
        console.error("attendance insert err", attErr);
        toast.error("Failed to mark attendance: " + (attErr.message ?? "error"));
        return;
      }

      playBeep();
      toast.success(`Marked attendance: ${studentFound.name}`);

      await fetchAttendanceForDate(attendanceDate);
    } catch (err: any) {
      console.error("scan processing err", err);
      toast.error("Failed to process scanned QR");
    }
  };

  function parseLegacyQrFormat(txt: string) {
    try {
      const parts = txt.split("|").reduce((acc: any, p: string) => {
        const [k, ...rest] = p.split(":");
        const v = rest.join(":");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});
      if (parts.STUDENT && parts.CLASS) return { name: parts.STUDENT, classCode: parts.CLASS };
    } catch (e) {}
    return null;
  }

  useEffect(() => {
    if (!scanModalOpen) {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }
      return;
    }

    try {
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      const elementId = "html5qr-reader";

      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }

      const scanner = new Html5QrcodeScanner(elementId, config, false);
      (scanner as any).render(
        (decodedText: string) => {
          onScanSuccess(decodedText);
        },
        (error: any) => {
          // ignore minor decode errors
        }
      );
      scannerRef.current = scanner;
    } catch (err) {
      console.error("scanner init err", err);
      toast.error("Failed to initialize QR scanner. Make sure your site is served over HTTPS and camera permission is allowed.");
      setScanModalOpen(false);
    }

    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {}
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanModalOpen]);

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.value = 0.05;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        try {
          ctx.close();
        } catch (e) {}
      }, 180);
    } catch (e) {
      // ignore audio errors
    }
  }

  const exportToExcel = () => {
    if (!attendanceRows || attendanceRows.length === 0) {
      toast.error("No attendance to export");
      return;
    }

    const wsData = [
      ["Student Name", "Date", "Time", "Marked By"],
      ...attendanceRows.map((r) => [
        r.students?.name || "",
        r.date,
        r.time,
        r.marked_by_name || "",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 28 },
    ]
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const fileName = `${classRow?.class_code || "class"}_attendance_${attendanceDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
    toast.success("Excel exported");
  };

  const exportToPdf = async () => {
    if (!attendanceRows || attendanceRows.length === 0) {
      toast.error("No attendance to export");
      return;
    }

    // fallback: manual text rendering (safe, no dependency)
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const marginLeft = 40;
      let cursorY = 60;
      const lineHeight = 16;
      const pageHeight = doc.internal.pageSize.height;

      doc.setFontSize(14);
      doc.text(`${classRow?.class_code || "Class"} Attendance — ${attendanceDate}`, marginLeft, cursorY);
      cursorY += 28;

      doc.setFontSize(10);
      doc.setFont("poppins", "bold");

      const colWidths = [150, 80, 80, 150];
      const headers = ["Student Name", "Date", "Time", "Marked By"];

      doc.setFillColor(245, 87, 108);
      doc.rect(marginLeft - 6, cursorY - 12, colWidths.reduce((a, b) => a + b, 0) + headers.length * 6, 20, "F");
      doc.setTextColor(255, 255, 255);

      let x = marginLeft;
      for (let i = 0; i < headers.length; i++) {
        doc.text(String(headers[i]), x + 4, cursorY + 4);
        x += colWidths[i];
      }

      doc.setTextColor(0, 0, 0);
      doc.setFont("poppins", "normal");
      cursorY += 20;

      attendanceRows.forEach((r) => {
        if (cursorY + lineHeight > pageHeight - 40) {
          doc.addPage();
          cursorY = 40;
        }
        x = marginLeft;
        const row = [
          r.students?.name || "",
          r.date || "",
          r.time || "",
          r.marked_by_name || "",
        ];
        for (let i = 0; i < row.length; i++) {
          const text = String(row[i]);
          doc.text(text, x + 4, cursorY + 12, { maxWidth: colWidths[i] - 8 });
          x += colWidths[i];
        }
        cursorY += lineHeight;
      });

      const fallbackName = `${classRow?.class_code || "class"}_attendance_${attendanceDate}.pdf`;
      doc.save(fallbackName);
      toast.success("PDF exported");
    } catch (err) {
      console.error("PDF export failed", err);
      toast.error("Failed to export PDF");
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.class_id) {
      toast.error("Enter student name & class");
      return;
    }
    try {
      setLoading(true);
      const qrToken = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const { data: inserted, error } = await supabase
        .from("students")
        .insert([{ name: newStudent.name, class_id: newStudent.class_id, qr_token: qrToken }])
        .select("*")
        .single();

      if (error) throw error;
      toast.success("Student added");
      setShowAddModal(false);
      setNewStudent({ name: "", class_id: classId || "" });
      await fetchAll();
    } catch (err: any) {
      console.error("add student err", err);
      toast.error("Failed to add student");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAttendanceRow = async (id: string) => {
    if (!confirm("Delete this attendance entry?")) return;
    try {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
      toast.success("Attendance removed");
      await fetchAttendanceForDate(attendanceDate);
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to remove attendance");
    }
  };

  const summary = useMemo(() => {
    const present = attendanceRows.length;
    const totalStudents = students.length;
    const absent = Math.max(0, totalStudents - present);

    return { present, absent, totalStudents, missing: 0 };
  }, [attendanceRows, students]);

  useEffect(() => {
    const fetchMissingCount = async () => {
      try {
        if (students.length === 0) return;
        const studentIds = students.map((s) => s.id);
        const { data: missingRows, error: missingErr } = await supabase
          .from("student_activities")
          .select("id")
          .in("student_id", studentIds)
          .eq("status", "missing");

        if (!missingErr && Array.isArray(missingRows)) {
          setMissingCount(missingRows.length);
        } else {
          setMissingCount(0);
        }
      } catch (e) {
        setMissingCount(0);
      }
    };

    fetchMissingCount();
  }, [students]);

  const [missingCount, setMissingCount] = useState(0);

  const enrichedStudents = useMemo(() => {
    const attendanceMap: Record<string, number> = {};
    attendanceRows.forEach((r) => {
      attendanceMap[r.student_id] = (attendanceMap[r.student_id] || 0) + 1;
    });

    return students.map((s) => ({
      ...s,
      attendance_count: attendanceMap[s.id] || 0,
    }));
  }, [students, attendanceRows]);

  const filteredStudents = useMemo(() => {
    let list = [...enrichedStudents];
    if (searchTerm.trim() !== "") {
      list = list.filter((s) => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (filterClassCode.toLowerCase() !== "all") {
      list = list.filter((s) => (classRow?.class_code || "").toLowerCase() === filterClassCode.toLowerCase());
    }
    switch (sortType) {
      case "mostAbsent":
        list.sort((a, b) => (b.attendance_count || 0) - (a.attendance_count || 0));
        break;
      case "leastAbsent":
        list.sort((a, b) => (a.attendance_count || 0) - (b.attendance_count || 0));
        break;
      default:
        break;
    }
    return list;
  }, [enrichedStudents, searchTerm, filterClassCode, sortType, classRow]);

  const resetFilters = () => {
    setSearchTerm("");
    setFilterClassCode("All");
    setSortType("none");
  };

  if (loading && !classRow) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f57  576c]" />
      </div>
    );
  }

  const container = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar
        user={teacher}
        onLogout={async () => {
          await supabase.auth.signOut();
          router.replace("/auth/login");
        }}
        currentPage="Class Details"
      />

      <div className="relative z-10 sm:mt-18 max-w-6xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start gap-4 mb-6">
          <motion.button whileHover={{ scale: 1.05 }} onClick={() => router.back()} className="p-2 cursor-pointer rounded-lg bg-white/60 backdrop-blur-md border border-[#f5576c]/10 shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </motion.button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              {classRow?.class_code || classRow?.class_name}
            </h1>
            <p className="text-sm text-gray-600">
              {classRow?.class_grade} • {classRow?.class_section} • Room {classRow?.room_number}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <motion.button whileHover={{ scale: 1.05 }} onClick={() => setScanModalOpen(true)} className="shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all cursor-pointer px-3 py-2 rounded-xl bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white font-medium flex items-center gap-2">
              <QrCode className="w-4 h-4" /> Scan QR
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={() => {
                setShowAddModal(true);
                setNewStudent({ name: "", class_id: classId });
              }}
              className="shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all cursor-pointer px-3 py-2 rounded-xl bg-white/70 backdrop-blur-md border border-[#f5576c]/20 text-[#f5576c] font-medium"
            >
              <UserPlus className="w-4 h-4 inline-block mr-1" /> Add Student
            </motion.button>
          </div>
        </div>

        <motion.div initial="hidden" animate="show" variants={container} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatCard title="Present" value={summary.present} subtitle="students" icon={CalendarCheck} color="from-green-400 to-green-600" />
          <StatCard title="Total Absences" value={summary.absent} subtitle="students" icon={CalendarCheck} color="from-orange-400 to-orange-600"/>
          <StatCard title="Missing Activities" value={missingCount} subtitle="pending submissions" icon={ClipboardX} color="from-red-400 to-red-600" />
        </motion.div>

        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Attendance — {attendanceDate}</h2>
          {attendanceRows.length === 0 ? (
            <div className="py-8 text-center text-gray-500">No attendance recorded for this date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-700">
                <thead className="bg-gradient-to-r from-[#f5576c]/10 to-[#F7BB97]/10 font-semibold">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Time</th>
                    <th className="p-3">Marked By</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRows.map((r) => (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-amber-50/40 transition">
                      <td className="p-3 font-medium">{r.students?.name || "-"}</td>
                      <td className="p-3">{r.time}</td>
                      <td className="p-3">{r.marked_by_name || "-"}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleDeleteAttendanceRow(r.id)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#f5576c]" />
            <input
              value={attendanceDate}
              onChange={(e) => {
                setAttendanceDate(e.target.value);
                fetchAttendanceForDate(e.target.value);
              }}
              type="date"
              className="outline-none cursor-pointer"
            />
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg flex items-center gap-3 justify-center">
            <p>
              Export list:
            </p>
            <motion.button whileHover={{ scale: 1.05 }} onClick={exportToExcel} className="shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all cursor-pointer px-3 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white font-medium text-sm flex items-center gap-2">
              Export XLSX
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} onClick={exportToPdf} className="shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all cursor-pointer px-3 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white font-medium text-sm flex items-center gap-2">
              Export PDF
            </motion.button>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg flex items-center gap-3 justify-end">
            <div className="text-sm text-gray-600">
              Total students: <span className="font-semibold text-gray-800">{students.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/70 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Students</h3>
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search student..." className="outline-none text-sm" />
              <motion.button whileHover={{ scale: 1.05 }} onClick={resetFilters} className="ml-3 px-3 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white text-sm cursor-pointer">
                <RotateCcw className="w-4 h-4 inline-block" />
              </motion.button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-700">
              <thead className="bg-gradient-to-r from-[#f5576c]/10 to-[#F7BB97]/10 font-semibold">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Attend.</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <motion.tr
                    whileTap={{ scale: 0.97 }}
                    key={s.id}
                    className="border-b border-gray-100 hover:bg-amber-50/40 transition cursor-pointer"
                    onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest("button")) return;
                    handleRowClick(s.id);}}
                  >
                    <td className="p-3 font-medium">{s.name}</td>
                    <td className="p-3">{s.attendance_count ?? 0}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNewStudent({ name: s.name, class_id: s.class_id });
                          setShowAddModal(true);
                        }}
                        className="text-[#f5576c] hover:underline"
                      >
                        <Edit3 className="w-4 h-4 inline-block" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-4 text-gray-500">
                      No students
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {scanModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-4 w-full max-w-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Scan QR for Attendance</h3>
                <button onClick={() => setScanModalOpen(false)} className="cursor-pointer text-gray-400 hover:text-[#f5576c]">Close</button>
              </div>
              <div id="html5qr-reader" className="w-full" />
              <p className="text-xs text-gray-500 mt-3">Point the camera to the student's QR. Make sure camera permission is allowed.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center">
            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add Student</h3>
              </div>

              <div className="flex flex-col gap-3">
                <input value={newStudent.name} onChange={(e) => setNewStudent((p) => ({ ...p, name: e.target.value }))} placeholder="Full Name" className="border rounded-lg px-3 py-2" />
                <select value={newStudent.class_id} onChange={(e) => setNewStudent((p) => ({ ...p, class_id: e.target.value }))} className="border rounded-lg px-3 py-2">
                  <option value="">Select Class</option>
                  <option value={classRow?.id}>{classRow?.class_code || classRow?.class_name}</option>
                </select>

                <div className="flex justify-end gap-2 pt-2">
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg border cursor-pointer hover:text-red-600 transition-all">Cancel</motion.button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={handleAddStudent} className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white cursor-pointer">Save</motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
      </div>
    </div>
  );
}