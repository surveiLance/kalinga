export function leaveLesson(dirty: boolean, confirm: (message: string) => boolean, onLeave: () => void) {
  if (dirty && !confirm("You have unsaved lesson changes. Leave without saving?")) return false;
  onLeave();
  return true;
}
export function deleteLesson(id: string, title: string, confirm: (message: string) => boolean, onDelete: (id: string) => void) {
  if (!id || !confirm(`Delete “${title.trim() || "Untitled lesson"}”? This removes the saved lesson and cannot be undone.`)) return false;
  onDelete(id);
  return true;
}
