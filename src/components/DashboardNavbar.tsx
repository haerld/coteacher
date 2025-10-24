"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface DashboardNavbarProps {
  user?: { email: string } | null;
  onLogout?: () => void;
  currentPage?: string;
}

export default function DashboardNavbar({ 
  user, 
  onLogout,
  currentPage = "Dashboard"
}: DashboardNavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Classes", href: "/dashboard/classes" },
    { label: "Students", href: "/dashboard/students" },
    { label: "Reports", href: "/dashboard/reports" },
  ];

  const handleNavigation = (href: string) => {
    setIsMobileMenuOpen(false);
    // In your actual app, use router.push(href)
    console.log(`Navigate to ${href}`);
    router.push(href);
  };

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-[#fff5f5]/70 to-transparent backdrop-blur-md border-b border-[#fbc2a9]/20"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        {/* Logo/Brand */}
        <button 
          onClick={() => handleNavigation("/dashboard")}
          className="flex items-center gap-2"
        >
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="cursor-pointer p-2 rounded-full bg-gradient-to-r from-[#f5576c] to-[#F7BB97] shadow-lg shadow-[#f5576c]/30"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <span className="text-[#f5576c] text-lg font-semibold tracking-wide">
            CoTeacher
          </span>
        </button>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <motion.div
              key={link.label}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <button
                onClick={() => handleNavigation(link.href)}
                className={`text-sm cursor-pointer font-medium transition-colors ${
                  currentPage === link.label
                    ? "text-[#f5576c]"
                    : "text-gray-700 hover:text-[#f5576c]"
                }`}
              >
                {link.label}
              </button>
            </motion.div>
          ))}

          {/* User Avatar & Logout */}
          {user && (
            <div className="flex items-center gap-3 ml-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/70 rounded-full border border-[#fbc2a9]/30">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-[#f5576c] to-[#F7BB97] flex items-center justify-center text-white font-semibold text-xs">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate">
                  {user.email.split("@")[0]}
                </span>
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                onClick={onLogout}
                className="cursor-pointer bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
              </motion.button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-[#f5576c] hover:opacity-80 transition"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-[#fff8f1]/95 backdrop-blur-md border-t border-[#fbc2a9]/30"
          >
            <div className="flex flex-col items-center gap-4 py-6">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNavigation(link.href)}
                  className={`text-base font-medium transition-colors ${
                    currentPage === link.label
                      ? "text-[#f5576c]"
                      : "text-gray-700 hover:text-[#f5576c]"
                  }`}
                >
                  {link.label}
                </button>
              ))}

              {user && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2 bg-white/70 rounded-full border border-[#fbc2a9]/30">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#f5576c] to-[#F7BB97] flex items-center justify-center text-white font-semibold text-sm">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {user.email.split("@")[0]}
                    </span>
                  </div>

                  <button
                    onClick={onLogout}
                    className="bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white shadow-md hover:opacity-90 px-6 py-2 rounded-lg flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}