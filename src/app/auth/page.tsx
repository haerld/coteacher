"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage(error.message);
    } else {
      if (isLogin) {
        router.replace("/dashboard");
      } else {
        setMessage("Sign-up successful! Check your email for verification.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-4 text-blue-700">
        {isLogin ? "Teacher Login" : "Teacher Sign Up"}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-64">
        <input
          className="border p-2 rounded"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="border p-2 rounded"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          {isLogin ? "Login" : "Sign Up"}
        </button>
      </form>

      <p
        className="mt-2 text-sm cursor-pointer text-blue-500 hover:underline"
        onClick={() => setIsLogin(!isLogin)}
      >
        {isLogin
          ? "Need an account? Sign Up"
          : "Already have an account? Login"}
      </p>

      {message && <p className="mt-3 text-red-500">{message}</p>}
    </div>
  );
}
