// dashboard/classes/[id]/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Student {
  id: number;
  name: string;
  attendance: Record<string, boolean>;
  missingActivities: string[];
}

export default function ClassDashboardPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const classId = params.id;

  const [students, setStudents] = useState<Student[]>([]);
  const [newStudentName, setNewStudentName] = useState("");

  const addStudent = () => {
    if (!newStudentName) return;
    setStudents([
      ...students,
      { id: students.length + 1, name: newStudentName, attendance: {}, missingActivities: [] },
    ]);
    setNewStudentName("");
  };

  // Placeholder attendance toggle (to be replaced by QR scan)
  const toggleAttendance = (studentId: number, date: string) => {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId ? { ...s, attendance: { ...s.attendance, [date]: !s.attendance[date] } } : s
      )
    );
  };

  return (
    <div className="p-6 md:p-10 flex flex-col gap-6">
      <h1 className="text-2xl font-bold mb-4">Class {classId} Dashboard</h1>

      {/* Add Student */}
      <div className="flex gap-2 items-center mb-4">
        <input
          type="text"
          placeholder="Student name"
          value={newStudentName}
          onChange={(e) => setNewStudentName(e.target.value)}
          className="px-2 py-1 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#f5576c]"
        />
        <Button onClick={addStudent}>Add Student</Button>
      </div>

      {/* Students Table */}
      <div className="flex flex-col gap-2">
        {students.length === 0 && <p>No students yet.</p>}
        {students.map((student) => (
          <div
            key={student.id}
            className="flex flex-col md:flex-row items-center justify-between gap-3 p-3 bg-white/50 rounded shadow"
          >
            <div>{student.name}</div>
            <div className="flex gap-2 items-center">
              <span>Attendance Today:</span>
              <input
                type="checkbox"
                checked={student.attendance["2025-10-24"] || false}
                onChange={() => toggleAttendance(student.id, "2025-10-24")}
              />
              {/* Replace checkbox with QR scanner in production */}
            </div>
            <div className="flex gap-2 items-center">
              <span>Missing Activities:</span>
              <Button size="sm">Add</Button>
            </div>
          </div>
        ))}
      </div>

      <Button onClick={() => router.push("/dashboard/classes")}>Back to Classes</Button>
    </div>
  );
}
