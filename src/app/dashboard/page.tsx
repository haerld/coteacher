"use client";

import { useState } from "react";
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
  LogOut, 
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

export default function DashboardPage() {
  const [user, setUser] = useState({ email: "teacher@school.com" });
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut(); 
    router.replace("/auth/login");
  };

  const [data, setData] = useState([
    { day: "Mon", attendance: 28, absents: 2 },
    { day: "Tue", attendance: 32, absents: 3 },
    { day: "Wed", attendance: 26, absents: 1 },
    { day: "Thu", attendance: 34, absents: 0 },
    { day: "Fri", attendance: 30, absents: 4 },
  ]);
  const [totalMissingActivities, setTotalMissingActivities] = useState(7);

  const totalAbsences = data.reduce((acc, day) => acc + day.absents, 0);
  const avgAttendance = Math.round(
    data.reduce((acc, day) => acc + day.attendance, 0) / data.length
  );

  const navLinks = [
    { label: "Dashboard", active: true },
    { label: "Classes" },
    { label: "Students" },
    { label: "Reports" },
  ];

  const quickActions = [
    {
      icon: BookOpen,
      label: "View Classes",
      description: "Manage your class schedule",
      color: "from-[#f5576c] to-[#F7BB97]",
      action: () => console.log("Navigate to classes")
    },
    {
      icon: QrCode,
      label: "Scan QR Code",
      description: "Quick attendance check",
      color: "from-purple-500 to-pink-500",
      action: () => console.log("Open QR scanner")
    },
    {
      icon: Users,
      label: "Student List",
      description: "View all students",
      color: "from-blue-500 to-cyan-500",
      action: () => console.log("Navigate to students")
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
        user={user}
        onLogout={handleLogout}
        currentPage="Dashboard"
      />

      {/* Main Content - Added padding top for fixed navbar */}
      <div className="relative mt-3 sm:mt-18 z-10 max-w-7xl mx-auto pt-24 p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col gap-2"
        >
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
            Welcome back, {user?.email?.split("@")[0]}! 👋
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Avg Attendance</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{avgAttendance}</p>
                <p className="text-xs text-gray-500 mt-1">students/day</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <CalendarCheck className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Absences</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{totalAbsences}</p>
                <p className="text-xs text-gray-500 mt-1">this week</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <CalendarCheck className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>

          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Missing Activities</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{totalMissingActivities}</p>
                <p className="text-xs text-gray-500 mt-1">pending submissions</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
                <ClipboardX className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Chart Section */}
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
              <Line
                type="monotone"
                dataKey="attendance"
                stroke="#f5576c"
                strokeWidth={3}
                dot={{ fill: "#F7BB97", strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="absents"
                stroke="#454545"
                strokeWidth={3}
                dot={{ fill: "#F7BB97", strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" stroke="#666" />
              <YAxis stroke="#666" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                  borderRadius: '12px',
                  border: '1px solid #f5576c33'
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.action}
                className="group bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 border border-[#f5576c]/20 hover:shadow-xl transition text-left"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#f5576c] transition" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  {action.label}
                </h3>
                <p className="text-sm text-gray-500">
                  {action.description}
                </p>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}