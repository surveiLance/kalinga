export const sharedResourceMarker = /\n?\[\[kalinga-resource:([a-z0-9-]+)\]\]\s*$/i;

export function encodeCommunityMessage(body: string, resourceId: string) {
  return resourceId ? `${body.trim()}\n[[kalinga-resource:${resourceId}]]` : body.trim();
}

export function decodeCommunityMessage(body: string) {
  return { body: body.replace(sharedResourceMarker, "").trim(), resourceId: body.match(sharedResourceMarker)?.[1] || "" };
}
