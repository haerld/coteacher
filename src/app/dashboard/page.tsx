"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [teacher, setTeacher] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const getSession = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/auth");
      } else {
        setTeacher(data.session.user);
      }
    };

    getSession();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/");
  };

  if (!teacher) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-4 text-blue-700">
        Welcome, {teacher.email}
      </h1>

      <p className="text-gray-600 mb-8">
        This is your teacher dashboard. You’ll soon be able to manage classes,
        check attendance, and track activities here.
      </p>

      <button
        onClick={handleLogout}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
      >
        Logout
      </button>
    </div>
  );
}
