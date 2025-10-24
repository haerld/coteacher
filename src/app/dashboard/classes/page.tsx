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
  MoreVertical,
  Edit,
  Trash2,
  X
} from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";

// Import your Supabase client
// import { supabase } from "@/lib/supabaseClient";

export default function ClassesPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>({ email: "teacher@school.com" });
  const [classes, setClasses] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    classCode: "",
    className: "",
    scheduleDate: "",
    scheduleTime: "",
  });

  // Fetch classes on mount
  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      // Replace with actual Supabase query
      // const { data, error } = await supabase
      //   .from('classes')
      //   .select('*')
      //   .eq('teacher_id', user.id)
      //   .order('created_at', { ascending: false });
      
      // if (error) throw error;
      // setClasses(data || []);

      // Mock data for demo
      setTimeout(() => {
        setClasses([
          {
            id: 1,
            class_code: "CS101",
            class_name: "Introduction to Computer Science",
            schedule_date: "2024-10-25",
            schedule_time: "09:00",
            student_count: 28
          },
          {
            id: 2,
            class_code: "MATH201",
            class_name: "Calculus II",
            schedule_date: "2024-10-26",
            schedule_time: "14:00",
            student_count: 32
          },
        ]);
        setIsLoading(false);
      }, 500);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Validate form
      if (!formData.classCode || !formData.className || !formData.scheduleDate || !formData.scheduleTime) {
        throw new Error("Please fill in all fields");
      }

      // Replace with actual Supabase insert
      // const { data, error } = await supabase
      //   .from('classes')
      //   .insert([
      //     {
      //       class_code: formData.classCode,
      //       class_name: formData.className,
      //       schedule_date: formData.scheduleDate,
      //       schedule_time: formData.scheduleTime,
      //       teacher_id: user.id,
      //     }
      //   ])
      //   .select();

      // if (error) throw error;

      // Mock success
      setTimeout(() => {
        const newClass = {
          id: classes.length + 1,
          class_code: formData.classCode,
          class_name: formData.className,
          schedule_date: formData.scheduleDate,
          schedule_time: formData.scheduleTime,
          student_count: 0
        };
        
        setClasses([newClass, ...classes]);
        setIsCreateModalOpen(false);
        setFormData({
          classCode: "",
          className: "",
          scheduleDate: "",
          scheduleTime: "",
        });
        setIsLoading(false);
      }, 500);

    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleDeleteClass = async (id: number) => {
    if (!confirm("Are you sure you want to delete this class?")) return;

    try {
      // Replace with actual Supabase delete
      // const { error } = await supabase
      //   .from('classes')
      //   .delete()
      //   .eq('id', id);

      // if (error) throw error;

      setClasses(classes.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
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
    
  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar 
              user={user}
              onLogout={handleLogout}
              currentPage="Classes"
            />

      {/* Main Content */}
      <div className="relative mt-3 sm:mt-18 z-10 max-w-7xl mx-auto pt-24 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
              My Classes
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your classes and schedules
            </p>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-xl shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition"
          >
            <Plus className="w-5 h-5" />
            Create Class
          </motion.button>
        </motion.div>

        {/* Classes Grid */}
        {isLoading && classes.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]"></div>
          </div>
        ) : classes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-12 border border-[#f5576c]/20 text-center"
          >
            <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No classes yet</h3>
            <p className="text-gray-500 mb-6">Create your first class to get started</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-lg hover:opacity-90 transition"
            >
              Create Class
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {classes.map((classItem, index) => (
              <motion.div
                key={classItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition cursor-pointer"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f5576c] to-[#F7BB97] flex items-center justify-center">
                      <BookOpen className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#f5576c] bg-[#f5576c]/10 px-2 py-1 rounded-full inline-block">
                        {classItem.class_code}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteClass(classItem.id)}
                    className="opacity-0 group-hover:opacity-100 transition text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Class Name */}
                <h3 className="text-lg font-semibold text-gray-800 mb-4 line-clamp-2">
                  {classItem.class_name}
                </h3>

                {/* Schedule Info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-[#f5576c]" />
                    {formatDate(classItem.schedule_date)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-4 h-4 text-[#f5576c]" />
                    {formatTime(classItem.schedule_time)}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{classItem.student_count || 0} students</span>
                  </div>
                  <button className="text-sm text-[#f5576c] hover:underline font-medium">
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
                  Create New Class
                </h2>
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateClass} className="space-y-4">
                {/* Class Code */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Code
                  </label>
                  <input
                    type="text"
                    value={formData.classCode}
                    onChange={(e) => setFormData({ ...formData, classCode: e.target.value })}
                    placeholder="e.g., CS101"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#f5576c] focus:ring-2 focus:ring-[#f5576c]/20 outline-none transition"
                    required
                  />
                </div>

                {/* Class Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Class Name
                  </label>
                  <input
                    type="text"
                    value={formData.className}
                    onChange={(e) => setFormData({ ...formData, className: e.target.value })}
                    placeholder="e.g., Introduction to Computer Science"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#f5576c] focus:ring-2 focus:ring-[#f5576c]/20 outline-none transition"
                    required
                  />
                </div>

                {/* Schedule Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Date
                  </label>
                  <input
                    type="date"
                    value={formData.scheduleDate}
                    onChange={(e) => setFormData({ ...formData, scheduleDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#f5576c] focus:ring-2 focus:ring-[#f5576c]/20 outline-none transition"
                    required
                  />
                </div>

                {/* Schedule Time */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schedule Time
                  </label>
                  <input
                    type="time"
                    value={formData.scheduleTime}
                    onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-[#f5576c] focus:ring-2 focus:ring-[#f5576c]/20 outline-none transition"
                    required
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white rounded-lg hover:opacity-90 transition font-medium disabled:opacity-50"
                  >
                    {isLoading ? "Creating..." : "Create Class"}
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