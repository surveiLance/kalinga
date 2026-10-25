"use client";

import type { ReactNode } from "react";
import { gradeList } from "@/lib/grades";
import type { TeachingClass } from "@/lib/teaching-types";

type Props = { classes: TeachingClass[]; selectedClass: TeachingClass; onSelectClass: (id: string) => void; onAddClass: () => void; onAttendance: () => void; onPlan: () => void; onResources: () => void; children?: ReactNode };

export function ClassWorkspaceHeader({ classes, selectedClass, onSelectClass, onAddClass, onAttendance, onPlan, onResources, children }: Props) {
  return <>
    <header className="class-compact-heading">
      <div className="class-compact-identity"><p className="eyebrow">CLASSES & LEARNERS</p><h1>{selectedClass.name}</h1><p>{gradeList(selectedClass.grades)} · {selectedClass.learners.length} {selectedClass.learners.length === 1 ? "learner" : "learners"}</p></div>
      <div className="class-compact-controls">
        {classes.length > 1 && <label><span>Class</span><select aria-label="Choose class" value={selectedClass.id} onChange={(event) => onSelectClass(event.target.value)}>{classes.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>}
        <button data-tour="class-add" className="secondary-button" type="button" onClick={onAddClass}>Add class</button>
        {children}
      </div>
    </header>
    <div className="class-primary-actions" role="group" aria-label="Class actions">
      <button className="primary-button" type="button" onClick={onAttendance}>Take attendance</button>
      <button className="secondary-button" type="button" onClick={onPlan}>Plan a lesson</button>
      <button className="secondary-button" type="button" onClick={onResources}>Find resources</button>
    </div>
  </>;
}
