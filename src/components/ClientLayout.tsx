"use client";

import { useEffect, useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Session } from "@supabase/supabase-js";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import { usePathname } from "next/navigation";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClientComponentClient();
  const [session, setSession] = useState<Session | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const showNavbar = [
    "/",
    "/auth/login",
    "/auth/signup",
    "/login",
    "/signup",
  ].includes(pathname);

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "linear-gradient(to right, #f5576c, #F7BB97)",
            color: "white",
            border: "none",
          },
        }}
      />

      {showNavbar && <Navbar />}

      <main>{children}</main>
    </>
  );
}
