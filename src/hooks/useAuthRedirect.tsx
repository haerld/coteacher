"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * @param options.redirectIfFound
 * @param options.redirectIfNotFound
 */

export function useAuthRedirect({
  redirectIfFound,
  redirectIfNotFound,
}: {
  redirectIfFound?: string;
  redirectIfNotFound?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session && redirectIfFound) {
        router.replace(redirectIfFound);
      } else if (!session && redirectIfNotFound) {
        router.replace(redirectIfNotFound);
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, redirectIfFound, redirectIfNotFound]);

  return loading;
}
