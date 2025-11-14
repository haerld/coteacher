"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { QrCode, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { encrypt } from "@/lib/crypto";

export default function StudentPublicScanPage() {
  const router = useRouter();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const componentMounted = useRef(false);

  useEffect(() => {
    if (componentMounted.current) return;
    componentMounted.current = true;

    const elementId = "qr-reader-view";

    const html5Qr = new Html5Qrcode(elementId);
    scannerRef.current = html5Qr;

    html5Qr
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        () => {}
      )
      .catch((err) => {
        console.error("Scan error:", err);
        toast.error("Camera access failed. Check permissions or HTTPS.");
      });

    return () => {
      stopScanner();
    };
  }, []);

  async function stopScanner() {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current?.clear();
    } catch (err) {
      console.warn("Scanner stop error:", err);
    }
  }

  async function onScanSuccess(decoded: string) {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    await stopScanner();

    processToken(decoded.trim());
  }

  async function processToken(token: string) {
    try {
      let student = null;

      const { data: direct } = await supabase
        .from("students")
        .select("id, name")
        .eq("qr_token", token)
        .maybeSingle();

      student = direct;

      if (!student && token.includes("STUDENT:") && token.includes("CLASS:")) {
        const parsed = parseLegacy(token);

        if (parsed) {
          const { name, classCode } = parsed;

          const { data: classRow } = await supabase
            .from("classes")
            .select("id")
            .eq("class_code", classCode)
            .maybeSingle();

          if (classRow?.id) {
            const { data: byName } = await supabase
              .from("students")
              .select("id, name")
              .eq("name", name)
              .eq("class_id", classRow.id)
              .maybeSingle();

            student = byName;
          }
        }
      }

      if (!student) {
        toast.error("No student found for this QR.");
        isProcessingRef.current = false;
        return;
      }

      const encryptedId = encrypt(student.id);
      stopScanner();
      router.push(`/student/${encodeURIComponent(encryptedId)}`);

    } catch (err) {
      console.error(err);
      toast.error("Error processing QR");
    }
  }

  function parseLegacy(txt: string) {
    try {
      const parts = txt.split("|").reduce((acc: any, p) => {
        const [k, ...rest] = p.split(":");
        const v = rest.join(":");
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});
      if (parts.STUDENT && parts.CLASS) {
        return { name: parts.STUDENT, classCode: parts.CLASS };
      }
    } catch {}
    return null;
  }

  return (
    <div className="relative min-h-screen bg-amber-50 font-sans overflow-hidden">
 
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[380px] h-[380px] bg-[#f5576c]/30 blur-3xl rounded-full animate-blob1" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[420px] h-[420px] bg-[#F7BB97]/25 blur-3xl rounded-full animate-blob2" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto pt-28 p-4 sm:p-6">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#f5576c] to-[#F7BB97] bg-clip-text text-transparent">
            Student QR Scan
          </h1>
          <p className="text-gray-600 text-sm">
            Scan your student QR to view your attendance and activity summary.
          </p>
        </motion.div>

        <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-[#f5576c]/20 shadow-xl">

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f5576c] to-[#F7BB97] flex items-center justify-center">
                <QrCode className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-800">Scan QR Code</h2>
                <p className="text-xs text-gray-500">Camera will start automatically</p>
              </div>
            </div>

            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg text-gray-600 hover:text-[#f5576c]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </div>

          <div
            id="qr-reader-view"
            className="w-full sm:h-[80vh] rounded-xl overflow-hidden bg-black"
          ></div>

          <p className="text-xs text-gray-500 mt-3">
            Allow camera access to continue.
          </p>

        </div>
      </div>
    </div>
  );
}
