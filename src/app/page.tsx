'use client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-[#ff9a9e] to-[#fad0c4]">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-5xl font-extrabold text-[#f5576c] mb-3 text-center"
      >
        Coteacher
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="text-lg text-gray-600 mb-10 text-center px-6 max-w-lg"
      >
        A smart companion for Hollie Marie — manage classes, track attendance using QR codes, 
        and monitor student activities effortlessly ehe.
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: -20  }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-sm text-gray-600 mb-2 text-center px-6 max-w-lg"
      >
        Join the conversation as
      </motion.p>

      <div className="flex gap-4">
        <motion.div
          initial={{ opacity: 0, y: -20  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <button
          onClick={() => router.push('/auth?mode=login')}
          className="px-6 py-3 bg-[#f5576c] text-white font-semibold rounded-lg hover:[#fad0c4] transition"
        >
          Student
        </button>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: -20  }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <button
          onClick={() => router.push('/auth?mode=signup')}
          className="px-6 py-3 bg-white border border-[#f5576c] text-[#f5576c] font-semibold rounded-lg hover:bg-blue-100 transition"
        >
          Teacher
        </button>
        </motion.div>
        
      </div>
    </div>
  );
}
