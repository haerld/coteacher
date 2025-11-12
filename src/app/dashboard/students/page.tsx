"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  UserPlus,
  Trash2,
  Edit3,
  Filter,
  RotateCcw,
} from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { QRCodeCanvas } from "qrcode.react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { encrypt } from "@/lib/crypto";

/**
 * StudentsPage
 *
 * Features:
 * - Fetch classes for the logged-in teacher and show them in Add Student dropdown
 * - Fetch students (with class) for that teacher
 * - Compute attendance_count (count rows in `attendance` for student)
 * - Compute missing_activities (count rows in `student_activities` with status='missing')
 * - Search, filter by class code, sort by missing/absences, add/delete students
 * - Clicking a row navigates to /dashboard/students/[id]
 *
 * NOTE about "absences":
 * - The schema does not include a present/absent flag or a canonical "total sessions".
 * - We compute attendance_count exactly; for "absences" sorting, we infer a relative absences
 *   as: absences_score = maxAttendanceAcrossStudents - attendance_count.
 *   This produces a relative ordering for "most absent" vs "least absent".
 * - Replace with a stricter calculation when you record present/absent status or total sessions.
 */

export default function StudentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Data
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<
    {
      id: string;
      name: string;
      qr_token?: string | null;
      class_id?: string | null;
      class_code?: string | null;
      class_name?: string | null;
      grade?: string | null;
      section?: string | null;
      attendance_count?: number;
      missing_count?: number;
    }[]
  >([]);

  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClassCode, setFilterClassCode] = useState("All");
  const [sortType, setSortType] = useState("none");
  const [showModal, setShowModal] = useState(false);
  const [newStudent, setNewStudent] = useState({
    name: "",
    class_id: "",
  });

  // Fetch initial user, teacher, classes, students + counts
  const fetchAll = async () => {
    try {
      setLoading(true);

      // 1) get auth user
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        router.replace("/auth/login");
        return;
      }
      const user = authData.user;
      setUser(user);

      // 2) get teacher record
      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", user.id)
        .single();

      if (teacherError || !teacherData) {
        console.error("Error fetching teacher:", teacherError);
        router.replace("/auth/login");
        return;
      }
      setTeacher(teacherData);

      // 3) fetch classes for this teacher
      const { data: classesData, error: classesError } = await supabase
        .from("classes")
        .select("*")
        .eq("teacher_id", teacherData.id)
        .order("created_at", { ascending: false });

      if (classesError) {
        console.error("Error fetching classes:", classesError);
        // don't return — we can still show students if any
      } else {
        setClasses(classesData || []);
      }

      // 4) fetch students for this teacher's classes
      // We assume students.class_id points to classes.id
      const classIds = (classesData || []).map((c: any) => c.id);
      let studentsData: any[] = [];

      if (classIds.length > 0) {
        const { data: sData, error: sError } = await supabase
          .from("students")
          .select("*, classes:class_id (id, class_name, class_code, class_grade, class_section)")
          .in("class_id", classIds);

        if (sError) {
          console.error("Error fetching students:", sError);
        } else {
          studentsData = sData || [];
        }
      } else {
        // no classes yet -> no students
        studentsData = [];
      }

      // 5) For each student compute attendance_count and missing_count
      // Optimize by querying attendance and student_activities counts in bulk
      const studentIds = studentsData.map((s) => s.id);
      const attendanceCounts: Record<string, number> = {};
      const missingCounts: Record<string, number> = {};

      if (studentIds.length > 0) {
        // attendance counts
        const { data: attData, error: attError } = await supabase
          .from("attendance")
          .select("student_id", { count: "exact" })
          .in("student_id", studentIds);

        // Supabase with .select("student_id, count:exact") doesn't return grouped count;
        // so we fetch all attendance rows for these students and count locally:
        const { data: attRows, error: attRowsError } = await supabase
          .from("attendance")
          .select("student_id")
          .in("student_id", studentIds);

        if (!attRowsError && Array.isArray(attRows)) {
          attRows.forEach((r: any) => {
            attendanceCounts[r.student_id] = (attendanceCounts[r.student_id] || 0) + 1;
          });
        }

        // missing activity counts
        const { data: missingRows, error: missingRowsError } = await supabase
          .from("student_activities")
          .select("student_id")
          .in("student_id", studentIds)
          .eq("status", "missing");

        if (!missingRowsError && Array.isArray(missingRows)) {
          missingRows.forEach((r: any) => {
            missingCounts[r.student_id] = (missingCounts[r.student_id] || 0) + 1;
          });
        }
      }

      // Format student rows
      const formatted = studentsData.map((s: any) => ({
        id: s.id,
        name: s.name,
        qr_token: s.qr_token ?? null,
        class_id: s.class_id,
        class_code: s.classes?.class_code ?? "",
        class_name: s.classes?.class_name ?? "",
        grade: s.classes?.class_grade ?? "",
        section: s.classes?.class_section ?? "",
        attendance_count: attendanceCounts[s.id] || 0,
        missing_count: missingCounts[s.id] || 0,
      }));

      setStudents(formatted);
    } catch (err: any) {
      console.error("fetchAll error:", err);
      toast.error("Failed to fetch students.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    // Realtime subscriptions: refresh on changes to relevant tables
    const channel = supabase
      .channel("students-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "students" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "student_activities" },
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived: find max attendance to infer "absences score" (relative)

  const handleRowClick = (studentId: string) => {
    const encryptedId = encrypt(studentId);
    router.push(`/dashboard/students/${encryptedId}`);
  };

  const maxAttendance = useMemo(() => {
    if (students.length === 0) return 0;
    return Math.max(...students.map((s) => s.attendance_count || 0));
  }, [students]);

  // Filtered + Sorted students
  const filteredStudents = useMemo(() => {
    let list = [...students];

    if (searchTerm.trim() !== "") {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterClassCode.toLowerCase() !== "all") {
      list = list.filter(
        (s) => (s.class_code || "").toLowerCase() === filterClassCode.toLowerCase()
      );
    }

    switch (sortType) {
      case "mostMissing":
        list.sort((a, b) => (b.missing_count || 0) - (a.missing_count || 0));
        break;
      case "leastMissing":
        list.sort((a, b) => (a.missing_count || 0) - (b.missing_count || 0));
        break;
      // For absences we use a relative "absences score" = maxAttendance - attendance_count
      case "mostAbsent":
        list.sort(
          (a, b) =>
            (maxAttendance - (b.attendance_count || 0)) -
            (maxAttendance - (a.attendance_count || 0))
        );
        break;
      case "leastAbsent":
        list.sort(
          (a, b) =>
            (maxAttendance - (a.attendance_count || 0)) -
            (maxAttendance - (b.attendance_count || 0))
        );
        break;
      default:
        break;
    }

    return list;
  }, [students, searchTerm, filterClassCode, sortType, maxAttendance]);

  // Add student
  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.class_id) {
      toast.error("Please provide student name and class.");
      return;
    }

    try {
      setLoading(true);

      // generate a qr token for the student (simple random string)
      const qrToken = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

      const { data, error } = await supabase
        .from("students")
        .insert([
          {
            name: newStudent.name,
            class_id: newStudent.class_id,
            qr_token: qrToken,
          },
        ])
        .select("*")
        .single();

      if (error || !data) throw error || new Error("Failed to add student");

      toast.success("Student added successfully!");
      // reset form & close
      setNewStudent({ name: "", class_id: "" });
      setShowModal(false);
      // refresh list
      fetchAll();
    } catch (err: any) {
      console.error("add student error:", err);
      toast.error("Failed to add student", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  // Delete student
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this student?")) return;

    try {
      setLoading(true);
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
      toast.success("Student deleted");
      setStudents((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error("delete student error:", err);
      toast.error("Failed to delete student", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setFilterClassCode("All");
    setSortType("none");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar user={teacher || user} onLogout={handleLogout} currentPage="Students" />

      <div className="relative sm:mt-18 z-10 max-w-7xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl pb-1 sm:text-4xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              Student Management
            </h1>
            <p className="text-gray-600 mt-1">Manage, filter, and track your students</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowModal(true)}
            className="hover:opacity-90 transition bg-white/70 backdrop-blur-md p-4 shadow-lg bg-gradient-to-r cursor-pointer from-[#f5576c] to-[#F7BB97] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" /> Add Student
          </motion.button>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-white/70 backdrop-blur-md rounded-2xl p-4 shadow-lg border border-[#f5576c]/20 mb-4 flex flex-wrap gap-3 items-center"
        >
          <div className="flex items-center bg-white rounded-lg shadow px-3 py-2 flex-1 min-w-[250px]">
            <Search className="w-5 h-5 text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search student..."
              className="flex-1 bg-transparent outline-none text-gray-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-5 h-5 text-[#f5576c]" />
            <select
              className="border rounded-lg px-3 py-2 text-gray-700 cursor-pointer"
              value={filterClassCode}
              onChange={(e) => setFilterClassCode(e.target.value)}
            >
              <option value="All">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.class_code ?? c.id}>
                  {c.class_code ?? c.class_name}
                </option>
              ))}
            </select>

            <select
              className="border rounded-lg px-3 py-2 text-gray-700 cursor-pointer"
              value={sortType}
              onChange={(e) => setSortType(e.target.value)}
            >
              <option value="none">Sort by</option>
              <option value="mostMissing">Most Missing</option>
              <option value="leastMissing">Least Missing</option>
              <option value="mostAbsent">Most Absences</option>
              <option value="leastAbsent">Least Absences</option>
            </select>

            <motion.button
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleResetFilters}
              className="flex cursor-pointer items-center gap-1 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white px-4 py-2 rounded-xl font-medium shadow hover:opacity-90 transition"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </motion.button>
          </div>
        </motion.div>

        {/* Student Table */}
        <motion.div className="overflow-x-auto rounded-2xl shadow-lg border border-[#f5576c]/20 bg-white/70 backdrop-blur-md">
          <table className="w-full text-left text-sm text-gray-700">
            <thead className="bg-gradient-to-r from-[#f5576c]/10 to-[#F7BB97]/10 font-semibold">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Class</th>
                <th className="p-3">Grade</th>
                <th className="p-3">Section</th>
                <th className="p-3 text-center">Attend.</th>
                <th className="p-3 text-center">Missing</th>
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
                    handleRowClick(s.id);
                  }}
                >
                  <td className="p-3 font-medium">{s.name}</td>
                  <td className="p-3">{s.class_code ?? s.class_name}</td>
                  <td className="p-3">{s.grade ?? "-"}</td>
                  <td className="p-3">{s.section ?? "-"}</td>
                  <td className="p-3 text-center">{s.attendance_count ?? 0}</td>
                  <td className="p-3 text-center">{s.missing_count ?? 0}</td>
                  <td className="p-3 text-center flex justify-center gap-2">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      className="text-blue-500 hover:text-blue- cursor-pointer"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toast("Edit student page coming soon");
                      }}
                    >
                      <Edit3 className="w-5 h-5" />
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        handleDelete(s.id);
                      }}
                      className="text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {filteredStudents.length === 0 && (
          <p className="text-center text-gray-500 mt-6">
            No students found matching your filters.
          </p>
        )}
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 px-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md sm:max-w-lg relative"
          >
            <h2 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#f5576c]" /> Add New Student
            </h2>

            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Full Name"
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                className="border rounded-lg px-3 py-2 outline-none"
              />

              <select
                value={newStudent.class_id}
                onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })}
                className="border rounded-lg px-3 py-2 outline-none"
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_code ?? c.class_name}
                  </option>
                ))}
              </select>

              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-500 hover:text-red-600 cursor-pointer"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleAddStudent}
                  className="bg-white/70 backdrop-blur-md p-4 border shadow-lg bg-gradient-to-r cursor-pointer from-[#f5576c] to-[#F7BB97] text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2"
                >
                  Save
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
