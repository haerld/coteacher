"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  BookOpen, 
  Calendar,
  Clock,
  Users,
  Trash2,
  X,
  DoorOpen
} from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export default function ClassesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>({ email: "teacher@school.com" });
  const [classes, setClasses] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Updated form state
  const [formData, setFormData] = useState({
    classCode: "",
    className: "",
    classGrade: "",
    classSection: "",
    roomNumber: "",
    frequencyDays: [] as string[],
    timeStart: "",
    timeEnd: "",
  });

  const fetchClasses = async () => {
  setIsLoading(true);
  setError("");

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unable to fetch user. Please log in again.");
    setUser(user);

    // ✅ Fetch all classes by teacher
    const { data: classesData, error: fetchError } = await supabase
      .from("classes")
      .select("*, students(count)")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) throw fetchError;

    // ✅ Format result
    const formatted = classesData.map((c: any) => ({
        id: c.id,
        class_code: c.class_code,
        class_name: c.class_name,
        class_grade: c.class_grade,
        class_section: c.class_section,
        room_number: c.room_number,
        frequency_days: Array.isArray(c.schedule_days)
          ? c.schedule_days
          : typeof c.schedule_days === "string" && c.schedule_days.trim() !== ""
          ? [c.schedule_days]
          : [],
        time_start: c.time_start,
        time_end: c.time_end,
        student_count: c.students?.[0]?.count || 0,
      }));

    setClasses(formatted);
  } catch (err: any) {
    console.error(err);
    setError(err.message || "Failed to fetch classes.");
  } finally {
    setIsLoading(false);
  }
};


  useEffect(() => {
  fetchClasses();

  const subscription = supabase
    .channel("classes-changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "classes" }, () => {
      fetchClasses();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "students" }, () => {
      fetchClasses();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(subscription);
  };
}, []);

  
  const handleCreateClass = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError("");

  try {
    const { classCode, className, classGrade, classSection, roomNumber, frequencyDays, timeStart, timeEnd } = formData;

    if (
      !classCode ||
      !className ||
      !classGrade ||
      !classSection ||
      !roomNumber ||
      frequencyDays.length === 0 ||
      !timeStart ||
      !timeEnd
    ) {
      throw new Error("Please fill in all fields");
    }

    // ✅ Get current logged-in teacher
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unable to retrieve user. Please log in again.");
    }

    // ✅ Convert time to a format Supabase accepts ("HH:MM:SS")
    const formattedTimeStart = `${timeStart}:00`;
    const formattedTimeEnd = `${timeEnd}:00`;

    // ✅ Insert into Supabase
    const { data, error: insertError } = await supabase
      .from("classes")
      .insert([
        {
          teacher_id: user.id,
          class_name: className,
          class_code: classCode,
          class_grade: classGrade,
          class_section: classSection,
          room_number: roomNumber,
          schedule_days: frequencyDays,
          time_start: formattedTimeStart,
          time_end: formattedTimeEnd,
        },
      ])
      .select("*")
      .single();

    if (insertError) throw insertError;

    // ✅ Update local state
    setClasses((prev) => [data, ...prev]);
    setIsCreateModalOpen(false);
    setFormData({
      classCode: "",
      className: "",
      classGrade: "",
      classSection: "",
      roomNumber: "",
      frequencyDays: [],
      timeStart: "",
      timeEnd: ""
    });

    toast.success("Class created successfully!");
  } catch (err: any) {
    console.error(err);
    setError(err.message || "Failed to create class");
  } finally {
    setIsLoading(false);
  }
};


  const handleDeleteClass = async (id: number) => {
  if (!confirm("Are you sure you want to delete this class?")) return;

  try {
    setIsLoading(true);

    // ✅ Get the current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unable to fetch user. Please log in again.");
    }

    // ✅ Delete the class only if it belongs to this teacher
    const { error: deleteError } = await supabase
      .from("classes")
      .delete()
      .eq("id", id)
      .eq("teacher_id", user.id);

    if (deleteError) throw deleteError;

    // ✅ Update UI after successful deletion
    setClasses((prev) => prev.filter((c) => c.id !== id));

    toast.success("Class deleted successfully!");
  } catch (err: any) {
    console.error(err);
    toast.error("Failed to delete class", {
      description: err.message,
    });
  } finally {
    setIsLoading(false);
  }
};


  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    router.replace("/auth/login");
  };

  const toggleDaySelection = (day: string) => {
    setFormData(prev => ({
      ...prev,
      frequencyDays: prev.frequencyDays.includes(day)
        ? prev.frequencyDays.filter(d => d !== day)
        : [...prev.frequencyDays, day],
    }));
  };

  const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar user={user} onLogout={handleLogout} currentPage="Classes" />

      {/* Main content */}
      <div className="relative mt-3 sm:mt-18 z-10 max-w-7xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl pb-1 sm:text-4xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              My Classes
            </h1>
            <p className="text-gray-600 mt-1">Manage your classes and schedules</p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-xl shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition"
          >
            <Plus className="w-5 h-5" /> Create Class
          </motion.button>
        </motion.div>

        {/* Class Cards */}
        {isLoading && classes.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]"></div>
          </div>
        ) : classes.length === 0 ? (
          <div className="text-center rounded-2xl p-10">
            <BookOpen className="w-14 h-14 text-[#f5576c] mx-auto mb-4" />
            <p className="text-gray-600 mb-15">No classes yet. Create one to get started!</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-lg hover:opacity-90 transition"
            >
              Create Class
            </button>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {classes.map((c, index) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs font-semibold text-[#f5576c] bg-[#f5576c]/10 px-2 py-1 rounded-full inline-block">
                      {c.class_code}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mt-2">{c.class_name}</h3>
                    <p className="text-sm text-gray-600">{c.class_grade} - {c.class_section}</p>
                  </div>
                  <button onClick={() => handleDeleteClass(c.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <Calendar className="inline w-4 h-4 text-[#f5576c] mr-1" />
                    {Array.isArray(c.frequency_days) && c.frequency_days.length > 0
                      ? c.frequency_days.join(", ")
                      : "No days set"}
                  </p>
                  <p><Clock className="inline w-4 h-4 text-[#f5576c] mr-1" />{formatTime(c.time_start) + " - " + formatTime(c.time_end)}</p>
                  <p><DoorOpen className="inline w-4 h-4 text-[#f5576c] mr-1" />{c.room_number}</p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" /> {c.student_count} students
                  </div>
                  <button onClick={() => router.push(`/dashboard/classes/${c.id}`)} className="cursor-pointer text-sm text-[#f5576c] hover:underline font-medium">
                    View Details
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Create Class Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative bg-white backdrop-blur-xl border border-[#f5576c]/20 rounded-2xl shadow-2xl 
                        w-full max-w-md md:max-w-lg p-6 sm:p-8 overflow-y-auto max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
                  Create New Class
                </h2>
                <motion.button
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-[#f5576c] transition"
                >
                  <X className="w-6 h-6" />
                </motion.button>
              </div>

              {/* Form */}
              <motion.form
                onSubmit={handleCreateClass}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex flex-col gap-4"
              >
                {/* Class Code */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Class Code</label>
                  <input
                    type="text"
                    value={formData.classCode}
                    onChange={(e) => setFormData({ ...formData, classCode: e.target.value })}
                    placeholder="e.g., CS101"
                    className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                    required
                  />
                </div>

                {/* Class Name */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Class Name</label>
                  <input
                    type="text"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    placeholder="e.g., Introduction to Computer Science"
                    className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                    required
                  />
                </div>

                {/* Grade & Room No. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Grade</label>
                    <input
                      type="text"
                      value={formData.classGrade}
                      onChange={(e) => setFormData({ ...formData, classGrade: e.target.value })}
                      placeholder="e.g., Grade 10"
                      className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                      required
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">Room No.</label>
                    <input
                      type="text"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      placeholder="e.g., 201"
                      className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                      required
                    />
                  </div>
                </div>

                {/* Class Name */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={formData.classSection}
                    onChange={(e) => setFormData({ ...formData, classSection: e.target.value })}
                    placeholder="Input Section"
                    className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                    required
                  />
                </div>

                {/* Frequency Days */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-2">Days per Week</label>
                  <div className="flex flex-wrap gap-2">
                    {dayOptions.map(day => (
                      <motion.button
                        key={day}
                        type="button"
                        onClick={() => toggleDaySelection(day)}
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          formData.frequencyDays.includes(day)
                            ? "bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white border-transparent"
                            : "border-gray-300 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {day}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Schedule Time */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Schedule Time</label>
                  <input
                    type="time"
                    value={formData.timeStart}
                    onChange={(e) => setFormData({ ...formData, timeStart: e.target.value })}
                    className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Schedule Time</label>
                  <input
                    type="time"
                    value={formData.timeEnd}
                    onChange={(e) => setFormData({ ...formData, timeEnd: e.target.value })}
                    className="rounded-xl border border-gray-300 px-4 py-3 focus:ring-2 focus:ring-[#f5576c]/30 focus:border-[#f5576c] outline-none transition"
                    required
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition"
                  >
                    Cancel
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-xl py-3 font-medium hover:opacity-90 transition disabled:opacity-50"
                  >
                    {isLoading ? "Creating..." : "Create Class"}
                  </motion.button>
                </div>
              </motion.form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
    </div>
  );
}
