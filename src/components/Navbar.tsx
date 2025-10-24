"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BookOpen, Sparkles, Menu, X } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/auth/login", label: "Login" },
    { href: "/auth/signup", label: "Sign Up" },
  ];

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 w-full z-50 bg-gradient-to-b from-[#fff5f5]/70 to-transparent backdrop-blur-md border-b border-[#fbc2a9]/20"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
        
        <Link href="/" className="flex items-center gap-2">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="p-2 rounded-full bg-gradient-to-r from-[#f5576c] to-[#F7BB97] shadow-lg shadow-[#f5576c]/30"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </motion.div>
          <span className="text-[#f5576c] text-lg font-semibold tracking-wide">
            CoTeacher
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(({ href, label }) => (
            <motion.div
              key={href}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <Link
                href={href}
                className={`text-sm font-medium transition-colors ${
                  pathname === href
                    ? "text-[#f5576c]"
                    : "text-gray-700 hover:text-[#f5576c]"
                }`}
              >
                {label}
              </Link>
            </motion.div>
          ))}

          <motion.div whileHover={{ scale: 1.05 }}>
            <Link href="/auth/signup">
              <Button
                variant="default"
                className="bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white shadow-lg shadow-[#f5576c]/30 hover:opacity-90 transition-all"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Get Started
              </Button>
            </Link>
          </motion.div>
        </div>

        <button
          className="md:hidden text-[#f5576c] hover:opacity-80 transition"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="md:hidden bg-[#fff8f1]/95 backdrop-blur-md border-t border-[#fbc2a9]/30"
          >
            <div className="flex flex-col items-center gap-4 py-6">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setIsOpen(false)}
                  className={`text-base font-medium transition-colors ${
                    pathname === href
                      ? "text-[#f5576c]"
                      : "text-gray-700 hover:text-[#f5576c]"
                  }`}
                >
                  {label}
                </Link>
              ))}

              <Link href="/auth/signup" onClick={() => setIsOpen(false)}>
                <Button className="bg-gradient-to-r from-[#f5576c] to-[#F7BB97] text-white shadow-md hover:opacity-90">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Get Started
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}
