"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function TestPage() {
  const [message, setMessage] = useState("Connecting to Supabase...");

  useEffect(() => {
    const checkConnection = async () => {
      const { data, error } = await supabase.from("classes").select("*").limit(1);
      if (error) {
        setMessage("Supabase connected but query failed (table might not exist yet).");
      } else {
        setMessage("✅ Supabase connection successful!");
      }
    };
    checkConnection();
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-lg">{message}</p>
    </div>
  );
}