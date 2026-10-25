export type PageGuidePage = "home" | "classes" | "plan" | "teach" | "library" | "attendance" | "community";
export type PageGuideStatus = { version: 3; pages: Partial<Record<PageGuidePage, { offered: boolean; completed: boolean }>> };
export type PageGuideStep = { id: string; title: string; body: string; targets: string[] };
export const pageGuideLabels: Record<PageGuidePage, string> = { home: "Today", classes: "Classes & learners", plan: "Plan lessons", teach: "Teaching guide", library: "Find resources", attendance: "Attendance", community: "Ask teachers" };

export function readPageGuideStatus(value: string | null): PageGuideStatus {
  const status: PageGuideStatus = { version: 3, pages: {} };
  try {
    const stored = JSON.parse(value || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return status;
    if (stored.version !== 3) {
      if (stored.dismissed === true || stored.completed === true || stored.version !== undefined && stored.version !== 2) {
        for (const page of Object.keys(pageGuideLabels) as PageGuidePage[]) status.pages[page] = { offered: true, completed: false };
      }
      return status;
    }
    for (const page of Object.keys(pageGuideLabels) as PageGuidePage[]) {
      const saved = stored.pages?.[page];
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) continue;
      status.pages[page] = { offered: saved.offered === true || saved.completed === true, completed: saved.completed === true };
    }
  } catch { return status; }
  return status;
}

export function markPageGuideOffered(status: PageGuideStatus, page: PageGuidePage): PageGuideStatus {
  return { version: 3, pages: { ...status.pages, [page]: { offered: true, completed: status.pages[page]?.completed === true } } };
}

export function completePageGuide(status: PageGuideStatus, page: PageGuidePage): PageGuideStatus {
  return { version: 3, pages: { ...status.pages, [page]: { offered: true, completed: true } } };
}

export function shouldOfferPageGuide(status: PageGuideStatus, page: PageGuidePage, ready: boolean, blocked: boolean): boolean {
  return ready && !blocked && !status.pages[page]?.offered;
}

export function pageGuideSteps(page: PageGuidePage, markers: string[]): PageGuideStep[] {
  const steps: PageGuideStep[] = [];
  const has = (marker: string) => markers.includes(marker);
  function add(marker: string, id: string, title: string, body: string, targets = [marker]) {
    if (has(marker)) steps.push({ id, title, body, targets });
  }
  if (page === "home") {
    if (!has("home-page")) return steps;
    add("home-page", "home-overview", "Start with today", "This page brings together your schedule and useful next actions. Choose a class action when you need it. You can explore other pages from the navigation and use Guide this page there too.", ["home-actions", "class-first", "home-page"]);
    add("sync-status", "home-sync", "Check where your work is saved", "The status above tells you whether work is saved on this device, waiting to sync, or synced online. Check it before closing your work. Ask Gabay is available when you want help.");
  } else if (page === "classes") {
    if (has("class-details")) add("class-details", "class-details", "Name your class and choose its grades", "Enter a class or section name, then select the grades and subjects you teach. For a new class, Continue to schedule opens the next step. You can change these details later; this guide will not fill or save them for you.");
    else if (has("class-schedule")) add("class-schedule", "class-schedule", "Choose your meeting times", "Select the days, start time and end time. Check the meeting summary. Add another meeting only if needed. Use the form’s Continue or Save button when you are ready.");
    else if (has("class-learners")) add("class-learners", "class-learners", "Add learners now or later", "Enter each learner’s name and grade. Sex is optional and fills the lesson-plan counts. A new class can be saved without names; return to Manage learners later. Only the form’s Save button saves these changes.");
    else if (has("class-page")) {
      if (!has("class-attendance") && !has("class-overview")) add("class-add", "class-start", "Set up your first class", "Choose Set up a class to add its name, grades and subjects. The next steps cover meeting times and optional learners. You make every change; Gabay only explains.");
      add("class-attendance", "class-attendance", "Attendance is ready at the top", "Take attendance opens this class’s roster. Plan a lesson and Find resources are beside it when you need them. This guide will not open or save anything for you.");
      add("class-overview", "class-overview", "Update one detail at a time", "Edit subjects, Manage learners and Edit meeting times each open a focused popup. Make your changes there and choose Save. Cancel leaves the saved class unchanged.");
      add("class-tabs", "class-tabs", "Find your class records", "Use Class details, Learners, Schedule and Lesson plans to view one part of your class at a time. Guide this page is available again whenever you need it.");
    }
  } else if (page === "plan") {
    if (has("plan-index")) add("plan-index", "plan-index", "Your lesson plans stay together", "Open a saved lesson to edit it, or choose New lesson plan. You can return here from All lesson plans inside an open lesson. Looking around does not create or delete a plan.");
    else if (has("plan-page")) {
      add("plan-setup-open", "plan-setup", "Give the lesson a starting point", "Choose the class, subject, topic and teaching date. Optional notes can explain materials or learning needs, without learner names. Check the time, language and grade levels before drafting.");
      if (has("plan-setup-open")) add("plan-draft", "plan-start", "Choose how to begin", "Draft with Gabay gives you an AI-generated starting point when signed in and connected. Review its accuracy before using it. Or choose I’ll write it myself. You can edit the lesson either way.", ["plan-draft", "plan-manual"]);
      add("plan-document", "plan-edit", "Edit your ILAW document", "Click the lesson text to edit it directly. Review Intentions, Learning Experience, Assessment and Ways Forward for every grade. The teacher decides what is correct and ready to use.", ["plan-intentions", "plan-document"]);
      add("plan-improve", "plan-improve", "Ask for changes without starting over", "Improve lesson with Gabay lets you describe a change to the whole lesson or one ILAW section. Review the suggestions before applying them. You can always keep editing the text yourself.");
      if (has("plan-save") || has("plan-saved")) steps.push({ id: "plan-save", title: "Save your reviewed lesson", body: "Save lesson keeps your changes. Save again after editing, and check the sync status before closing. Finishing this guide does not save your lesson.", targets: ["plan-save", "plan-saved"] });
      if (has("plan-pdf") || has("plan-word")) steps.push({ id: "plan-export", title: "Export PDF or editable Word", body: "Print / PDF opens the print dialog, where you can choose Save as PDF. Download Word gives you an editable Microsoft Word file. Both use and save the current lesson. Nothing downloads just by following this guide.", targets: ["plan-pdf", "plan-word"] });
      add("plan-teach", "plan-teach", "Use your plan in class", "Teach this lesson saves the current plan and opens a simpler teaching guide. It shows the activity, timing and each grade’s task. That page has its own optional guide.");
    }
  } else if (page === "teach") {
    if (!has("teach-page")) return steps;
    add("teach-current", "teach-current", "See what to teach right now", "This is the current lesson step: its time, your teaching focus and what each grade should do. With teacher and independent tasks help you manage the groups.");
    add("teach-steps", "teach-steps", "Move through the lesson at your pace", "Choose a lesson step from the list or use Previous and Continue. These controls change the view, not the plan’s text. Return to Edit plan if the activities need changing.");
    add("teach-notes", "teach-notes", "Open notes only when needed", "Materials, learning targets and assessments are available below the lesson. Open one section at a time. You can also take attendance when you are ready.");
    if (!steps.length) add("teach-page", "teach-overview", "Your classroom guide", "This page follows the saved lesson. If there are no activities yet, use Edit plan to add them. This guide does not create activities for you.");
  } else if (page === "attendance") {
    if (has("attendance-empty")) add("attendance-empty", "attendance-empty", "Start with a class roster", "Add a class and learner names in Classes & learners first. They will then appear here for attendance. No records are created by this guide.");
    else if (has("attendance-page")) {
      add("attendance-date", "attendance-date", "Check the class and date first", "Choose the correct class and teaching date before marking attendance. Today returns to the current date. Use the grade tabs when you want to work with one group.");
      add("attendance-records", "attendance-records", "Mark each learner’s status", "Check each learner’s status. You can mark a group present, then adjust individual learners. An absence note is optional. Do not assume the default marks are correct without checking.");
      add("attendance-save", "attendance-save", "Save after checking", "Choose Save attendance when the marks and date are correct. Check the sync status to see whether the changes have reached the cloud. Finishing this guide does not save attendance.");
    }
  } else if (page === "library") {
    if (has("resource-reader")) {
      add("resource-reader", "resource-reader", "Read the material before using it", "Preview the PDF here. Use Open full PDF when you need a larger view. Check that the content suits your learners.");
      add("resource-share", "resource-share", "Share the resource link", "Share link lets you pass this material to another teacher. The guide does not share anything for you.");
      add("resource-notes", "resource-notes", "Discuss this particular material", "Teacher notes are for questions and practical ideas about this resource. Keep learner details private. Use Ask teachers for a broader classroom question.");
    } else if (has("library-page")) {
      add("library-page", "library-browse", "Find a useful teaching material", "Browse the resources and use the subject and grade filters. Open a material to preview it and read teacher notes before using it.");
      add("resource-upload", "resource-upload", "Add a resource of your own", "Upload a resource lets you choose a PDF and describe its subject, grades and classroom use. Check the submission details and access settings before submitting. Online sharing requires signing in and a connection.");
    }
  } else if (page === "community" && has("community-page")) {
    if (has("community-signin")) add("community-signin", "community-signin", "Sign in to join other teachers", "Ask teachers is shared with signed-in teachers. Sign in when you want to read and join discussions. Your classes and learner records remain private to your workspace.");
    else {
      add("community-ask", "community-ask", "Ask a clear classroom question", "Choose Ask a question, describe what you need and attach a helpful resource if needed. Check the post before submitting and do not include private learner information.");
      add("community-discussions", "community-discussions", "Reply and help one another", "Open a discussion to read and reply. Use @mentions when needed; the bell brings replies and mentions together. This guide never posts or replies on your behalf.");
    }
  }
  return steps;
}
