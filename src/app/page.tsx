"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { Spinner } from "@/components/ui/spinner";

export default function HomePage() {
  const router = useRouter();
  const loadingRedirect = useAuthRedirect({ redirectIfFound: "/dashboard" });

  if (loadingRedirect) return <div><Spinner /></div>;


  return (
    <div className="font-sans relative flex flex-col items-center justify-center min-h-screen bg-amber-50 px-4 sm:px-6 md:px-10 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#f5576c]/30 rounded-full blur-3xl animate-blob1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[450px] h-[450px] bg-[#F7BB97]/25 rounded-full blur-3xl animate-blob2"></div>
        <div className="absolute top-[30%] left-[40%] w-[350px] h-[350px] bg-pink-400/20 rounded-full blur-3xl animate-blob3"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="p-1 px-5 sm:px-6 bg-[#f5576c] rounded-full mb-5 sm:mb-10 relative z-10"
      >
        <p className="text-sm sm:text-md font-semibold text-amber-50 text-center whitespace-nowrap">
          Class Tracking Portal
        </p>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="font-poppins text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold
                   bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent
                   mb-3 text-center leading-tight relative z-10"
      >
        Your classroom co-pilot
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-base sm:text-lg text-gray-600 mb-8 sm:mb-10 text-center max-w-xs sm:max-w-md md:max-w-lg relative z-10"
      >
        A smart companion for Hollie Marie — manage classes, track attendance
        using QR codes, and monitor student activities effortlessly ehe.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-xs sm:text-sm text-gray-600 mb-3 text-center relative z-10"
      >
        Join the conversation as
      </motion.p>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto justify-center items-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="w-full sm:w-auto"
        >
          <button
            //onClick={() => router.push("/auth?mode=login")}
            className="w-full sm:w-auto px-6 py-3 bg-[#f5576c] text-white font-semibold rounded-lg
                       hover:bg-[#f7797d] active:scale-95 transition"
          >
            Student
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="w-full sm:w-auto"
        >
          <button
            onClick={() => router.push("/auth/login")}
            className=" w-full sm:w-auto px-6 py-3 bg-white border border-[#f5576c] text-[#f5576c]
                       font-semibold rounded-lg hover:bg-[#fff5f5] active:scale-95 transition"
          >
            Teacher
          </button>
        </motion.div>
      </div>
    </div>
  );
}
