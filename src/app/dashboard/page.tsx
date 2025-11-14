"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  CalendarCheck,
  ClipboardX,
  BookOpen,
  Users,
  QrCode,
  ChevronRight,
} from "lucide-react";
import DashboardNavbar from "@/components/DashboardNavbar";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export default function DashboardPage() {
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any[]>([]);
  const [totalMissingActivities, setTotalMissingActivities] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const fetchTeacherData = async () => {
      setLoading(true);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) {
        router.replace("/auth/login");
        return;
      }

      const user = authData.user;

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

      const { data: classes, error: classError } = await supabase
        .from("classes")
        .select("id, class_name")
        .eq("teacher_id", teacherData.id);

      if (classError) {
        console.error("Error fetching classes:", classError);
      }

      const { data: attendance, error: attendanceError } = await supabase
        .from("attendance")
        .select("date, class_id");

      let attendanceSummary = [];
      if (attendance && attendance.length > 0) {
        const grouped = attendance.reduce((acc: any, row: any) => {
          const day = new Date(row.date).toLocaleDateString("en-US", {
            weekday: "short",
          });
          acc[day] = (acc[day] || 0) + 1;
          return acc;
        }, {});
        attendanceSummary = Object.keys(grouped).map((day) => ({
          day,
          attendance: grouped[day],
          absents: Math.floor(Math.random() * 5),
        }));
      } else {
        // Default static fallback
        attendanceSummary = [
          { day: "Mon", attendance: 0, absents: 0 },
          { day: "Tue", attendance: 0, absents: 0 },
          { day: "Wed", attendance: 0, absents: 0 },
          { day: "Thu", attendance: 0, absents: 0 },
          { day: "Fri", attendance: 0, absents: 0 },
        ];
      }

      setData(attendanceSummary);

      const { data: missing, error: missingError } = await supabase
        .from("student_activities")
        .select("id", { count: "exact" })
        .eq("status", "missing");

      if (!missingError) {
        setTotalMissingActivities(missing?.length || 0);
      }

      setLoading(false);
    };

    fetchTeacherData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f5576c]"></div>
          </div>
    );
  }

  const totalAbsences = data.reduce((acc, day) => acc + day.absents, 0);
  const avgAttendance = data.length
    ? Math.round(data.reduce((acc, day) => acc + day.attendance, 0) / data.length)
    : 0;

  const quickActions = [
    {
      icon: BookOpen,
      label: "View Classes",
      description: "Manage your class schedule",
      color: "from-[#f5576c] to-[#F7BB97]",
      action: () => router.push("/dashboard/classes"),
    },
    {
      icon: QrCode,
      label: "Scan QR Code",
      description: "Quick attendance check",
      color: "from-purple-500 to-pink-500",
      action: () => router.push("/dashboard/scan"),
    },
    {
      icon: Users,
      label: "Student List",
      description: "View all students",
      color: "from-blue-500 to-cyan-500",
      action: () => router.push("/dashboard/students"),
    },
  ];

  return (
    <div className="relative min-h-screen bg-amber-50 overflow-hidden font-sans">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <DashboardNavbar
        user={teacher}
        onLogout={handleLogout}
        currentPage="Dashboard"
      />

      <div className="relative z-10 mt-3 sm:mt-18 max-w-7xl mx-auto pt-24 p-4 sm:p-6 lg:p-8 flex flex-col gap-6">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
            Welcome back, {teacher.firstname || teacher.email.split("@")[0]}!
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <StatCard title="Avg Attendance" value={avgAttendance} subtitle="students/day" icon={CalendarCheck} color="from-green-400 to-green-600" />
          <StatCard title="Total Absences" value={totalAbsences} subtitle="this week" icon={CalendarCheck} color="from-orange-400 to-orange-600" />
          <StatCard title="Missing Activities" value={totalMissingActivities} subtitle="pending submissions" icon={ClipboardX} color="from-red-400 to-red-600" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-6 h-6 text-[#f5576c]" />
            <h2 className="text-xl font-semibold text-gray-800">
              Weekly Attendance Trends
            </h2>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <Line type="monotone" dataKey="attendance" stroke="#f5576c" strokeWidth={3} />
              <Line type="monotone" dataKey="absents" stroke="#454545" strokeWidth={3} />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: '12px', border: '1px solid #f5576c33' }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, i) => (
              <ActionCard key={i} {...action} />
            ))}
          </div>
        </motion.div>
      </div>
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

function ActionCard({ icon: Icon, label, description, color, action }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={action}
      className="group bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition text-left"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#f5576c] transition" />
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{label}</h3>
      <p className="text-sm text-gray-500">{description}</p>
    </motion.button>
  );
}
