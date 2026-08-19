import { getCurrentUser, getCurrentWorkspace, googleLoginUrl } from "../lib/api";
import { WorkspaceRealtimeHome } from "./workspace-realtime-home";

export default async function ResponseHomePage() {
  const user = await getCurrentUser();
  const workspaceState = user.authenticated ? await getCurrentWorkspace() : undefined;

  return (
    <WorkspaceRealtimeHome
      googleLoginUrl={googleLoginUrl()}
      initialUser={user}
      initialWorkspaceState={workspaceState}
    />
  );
}
